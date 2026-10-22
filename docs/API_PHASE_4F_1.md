# API PHASE 4F-1 — Backend Users / Accounts API + Account Linking

## 1. Scope
Chỉ backend. Tạo mới `/api/users` (GET list/detail, POST create, PUT update). Enforce invariant role/profile-type matching + cross-profile uniqueness ở cả endpoint mới VÀ ở 3 service hiện có (`studentService`, `lecturerService`, `companyMentorService`) vì đó là nơi DUY NHẤT KHÁC có thể set `user_id` (qua PUT trực tiếp). Không sửa `client/`, không đổi JWT, không đổi role enum, không thêm delete/lock/reset-password/refresh-token.

## 2. Users schema (không đổi)
```
users(id PK, full_name, email UNIQUE, password_hash, role ENUM(admin|student|lecturer|company_mentor),
      created_at, updated_at)
```
Không thêm cột `status`/`is_active`/`locked`. Không đổi ENUM.

## 3. API endpoints
```
GET    /api/users            — Admin only, hỗ trợ ?search=&role=
GET    /api/users/:id        — Admin only, 404 nếu không tồn tại
POST   /api/users            — Admin only, tạo account (+ optional link profile trong 1 transaction)
PUT    /api/users/:id        — Admin only, partial update (full_name/email/password)
```
Không có DELETE/PATCH role/reset-password/lock — xác nhận `DELETE /api/users/:id` → 404 (route không tồn tại, đúng Express default `notFoundHandler`).

## 4. Authorization
`router.use(requireAuth, requireRole('admin'))` áp dụng cho TOÀN BỘ router, không ngoại lệ, không route riêng cho non-admin, không `/api/users/me`.

| Test | Result |
|---|---|
| No token | 401 |
| Invalid token | 401 |
| Admin (mọi method) | 200/201 |
| Student (mọi method) | 403 |
| Lecturer (mọi method) | 403 |
| Company Mentor (mọi method) | 403 |

## 5. Safe response
DTO dùng lại nguyên `authService.toSafeUser()` (không viết DTO mới, không trùng lặp logic) — mọi response (`GET`/`POST`/`PUT`) chỉ trả `{id, fullName, email, role}`. Xác nhận bằng test thật: không có `password`/`password_hash`/`token` ở bất kỳ response nào trong toàn bộ test matrix (list, detail, create, update).

## 6. Create flow

Payload (snake_case, khớp convention toàn bộ API hiện có — xem ghi chú naming ở mục 9):
```json
{ "full_name": "...", "email": "...", "password": "...", "role": "student", "profile_id": 2 }
```
`profile_id` optional/nullable. Nếu có: phải khớp đúng bảng hồ sơ tương ứng `role` (`student→students`, `lecturer→lecturers`, `company_mentor→company_mentors`); `role=admin` + có `profile_id` → 400.

Transaction (atomic, `BEGIN...COMMIT`/`ROLLBACK`):
```
1. Validate email unique (409 nếu trùng)
2. Nếu có profile_id: validate role↔bảng khớp (400), hồ sơ tồn tại (400), hồ sơ chưa bị link (409)
3. bcrypt.hash(password, 10)
4. BEGIN
5. INSERT INTO users
6. Nếu có profile_id: SELECT ... FOR UPDATE (khóa row, chống race) → re-check tồn tại/chưa-link → UPDATE profile.user_id
7. COMMIT (hoặc ROLLBACK toàn bộ nếu bất kỳ bước nào ở 5-6 lỗi)
```
Test xác nhận: mọi kịch bản lỗi (email trùng, profile không tồn tại, profile đã bị link, role/profile sai loại, role=admin+profile_id) đều KHÔNG để lại user mồ côi — `SELECT COUNT(*) FROM users` không đổi sau mỗi lần fail.

## 7. Update flow
Partial merge (khác với full-replace của Student/Lecturer/CompanyMentor) — **bắt buộc** vì password là optional-on-update (không gửi = giữ nguyên `password_hash`). Chỉ 3 field có thể sửa: `full_name`, `email`, `password`. Payload rỗng hoặc không chứa field hợp lệ nào → 400 "Không có trường nào để cập nhật" (đúng pattern đã dùng ở Notifications).

## 8. Password hashing
`bcrypt.hash(password, 10)` — cùng cost factor với seed data (`$2b$10$...`). Không bao giờ lưu plaintext, không bao giờ trả `password`/`password_hash` ra ngoài. Xác nhận trực tiếp qua DB: `password_hash` của user vừa tạo là chuỗi bcrypt hợp lệ, khác hoàn toàn plaintext gửi lên. Login bằng password mới thành công, login bằng password cũ (sau khi đổi) thất bại 401. Không có rule độ dài tối thiểu mới — khớp đúng `AccountFormModal.jsx` hiện tại (chỉ `isRequired`, không có minLength).

## 9. Role immutability + naming note
`role` không thể sửa qua `PUT /api/users/:id` — nằm trong `UPDATE_IMMUTABLE_FIELDS`, reject 400 cứng nếu có mặt trong payload (không silently ignore). Không có API đổi role nào khác.

**Ghi chú naming `profile_id`**: AdminAccountsPage.jsx (mock, chưa migrate) hiện dùng field nội bộ `linkedProfileId` (camelCase, generic — không tách `student_id`/`lecturer_id`/`company_mentor_id` riêng). Backend mới dùng `profile_id` (snake_case) để nhất quán với convention của 12 entity khác đã có (toàn bộ input body hiện tại đều snake_case khớp tên cột DB). Việc map `linkedProfileId` (frontend) ↔ `profile_id` (backend) sẽ làm ở API boundary (`client/src/api/userApi.js`) khi migrate Phase 4F-2, đúng pattern mapper đã dùng cho Settings ở Phase 4E-3 — không đổi convention backend chỉ để khớp 1 Context mock sắp bị thay thế hoàn toàn.

## 10. Profile linking
Chỉ qua `POST /api/users` (tạo mới + link 1 lần). Không có `/link`/`/unlink` riêng. Không cho relink sau khi tạo — `PUT /api/users/:id` reject cứng nếu có `profile_id`.

## 11. Cross-profile invariant (enforce ở CẢ 2 nơi)
Hàm mới `userService.assertUserCanLinkProfileType(userId, expectedRole)`:
- Kiểm tra `users.role === expectedRole` (400 nếu sai).
- Kiểm tra `userId` chưa xuất hiện ở `user_id` của 2 bảng hồ sơ còn lại (409 nếu có).

Được gọi ở:
- `userService.create()` (qua `PROFILE_TABLE_BY_ROLE[role]` lookup — tự nhiên đảm bảo đúng bảng vì role chọn bảng).
- `studentService.validateReferences()`, `lecturerService.validateReferences()`, `companyMentorService.validateReferences()` — áp dụng cho CẢ con đường cũ (Admin sửa trực tiếp Student/Lecturer/CompanyMentor qua `PUT /api/students|lecturers|company-mentors/:id` với `user_id` trong payload, đã tồn tại từ Phase 2B/3B) để đóng đúng gap đã ghi nhận ở Phase 4F-0 (mục 14.2/14.3) một cách nhất quán toàn hệ thống, không chỉ ở endpoint mới.

**Đã verify trước khi bật rule này**: dữ liệu seed hiện tại (4 student, 2 lecturer, 3 mentor có `user_id`) đều role-consistent và không có user nào bị link chéo — bật rule không gây regression.

## 12. Validation
```
full_name   — required, non-empty
email       — required, format hợp lệ, unique (409 nếu trùng) — không tự lowercase (users.email có
              collation utf8mb4_unicode_ci — so sánh/UNIQUE vốn đã case-insensitive ở tầng DB, không
              cần thêm normalize ở app layer, khớp đúng "không tự invent nếu chưa có")
password    — required (create), optional (update), không có rule độ dài
role        — required (create), phải thuộc 4 giá trị enum, KHÔNG sửa được (update)
profile_id  — optional, phải là ID hợp lệ, phải tồn tại đúng bảng theo role, chưa bị link, KHÔNG
              sửa được (update)
```

## 13. Error contract
```
400 — validation (role/email/password/profile_id sai định dạng, role/profile mismatch, immutable
      field trong payload update, payload rỗng)
401 — thiếu/sai token
403 — sai role (route-level, áp dụng cho MỌI non-admin, mọi method)
404 — user không tồn tại, hoặc route không tồn tại (DELETE)
409 — email trùng, profile đã bị link, user đã link profile khác loại
```
Không expose SQL raw/password_hash ở bất kỳ message nào — xác nhận qua toàn bộ test. (Ghi nhận ở mục 22: `err.stack` vẫn xuất hiện trong response khi `NODE_ENV !== 'production'` — đây là hành vi TOÀN HỆ THỐNG đã có từ trước, không phải thứ Phase 4F-1 thêm vào hay thuộc phạm vi sửa của phase này.)

## 14. Auth integration
`POST /api/auth/login` + `GET /api/auth/me` test lại với cả 4 role seed — PASS, response shape không đổi, không có password/hash. `authService` vẫn dùng `bcrypt.compare(plaintext, password_hash)`, không có code path nào so sánh plaintext trực tiếp.

## 15. IDOR/security tests

| Test | Result |
|---|---|
| Student/Lecturer/Mentor tự PUT role=admin lên chính mình | PASS (403 route-level, không tới được service) |
| Student POST tạo account role=admin | PASS (403) |
| Student/Lecturer/Mentor GET list/detail | PASS (403 cả 3) |
| No token / invalid token | PASS (401 cả hai) |

## 16. Transaction rollback tests

| Kịch bản | Kết quả | users count sau |
|---|---|---|
| Email trùng | 409, không insert | không đổi |
| Email sai format | 400 (chặn ở controller, chưa tới service) | không đổi |
| Role không hợp lệ | 400 (chặn ở controller) | không đổi |
| Thiếu password | 400 (chặn ở controller) | không đổi |
| profile_id không tồn tại | 400, rollback | không đổi |
| profile đã bị link (409) | 409, rollback | không đổi |
| role=admin + profile_id | 400 (chặn trước BEGIN) | không đổi |
| role/profile sai loại (qua PUT student/lecturer/mentor hiện có) | 400, không ghi `user_id` | profile vẫn NULL |

Xác nhận bằng `SELECT COUNT(*) FROM users` sau toàn bộ chuỗi test lỗi = đúng số lượng mong đợi (10 seed + đúng 4 user tạo thành công, không thừa không thiếu).

## 17. Update / field injection tests

| Test | Result |
|---|---|
| Update full_name only | PASS (chỉ field đó đổi) |
| Update email only | PASS |
| Update password only | PASS (login bằng password mới thành công, password cũ 401) |
| Duplicate email | PASS (409) |
| Invalid email format | PASS (400) |
| Payload rỗng | PASS (400 "Không có trường nào để cập nhật") |
| User không tồn tại | PASS (404) |
| Inject `id` | PASS (400, immutable) |
| Inject `role` | PASS (400, immutable) |
| Inject `profile_id` | PASS (400, immutable) |
| Inject `password_hash` | PASS (400, immutable) |
| Inject `student_id`/`lecturer_id`/`company_mentor_id` (field lạ, không map vào field nào) | PASS (400 "không có trường hợp lệ" — không có DB write nào xảy ra, an toàn) |

## 18. Account linking regression

| Kịch bản | Kết quả |
|---|---|
| Tạo user role=student + link Student A (profile có sẵn, `user_id` trước đó NULL) | PASS — link thành công trong transaction |
| Tạo user role=lecturer + link Lecturer A | PASS |
| Tạo user role=company_mentor + link Mentor A | PASS |
| Tạo user role=admin, không link profile | PASS (admin không cần profile) |
| Login bằng account vừa tạo + `GET /api/auth/me` | PASS — đúng id/fullName/email/role, không password |
| Ownership hoạt động đúng sau khi link (GET /api/students, /api/internships bằng JWT mới) | PASS — scope resolve đúng qua `user_id` vừa gán |
| Student account (role=student) → cố link vào Lecturer profile (qua `PUT /api/lecturers/:id`) | PASS — reject 400 |
| Lecturer account → cố link vào Student profile | PASS — reject 400 |
| Mentor account → cố link vào Student profile | PASS — reject 400 |
| Profile đã có `user_id` → cố link cho user khác | PASS — reject 409, không silently overwrite |

## 19. Database integrity
```
14/14 tables
19/19 foreign keys
users = 10 (4 user test đã xóa qua SQL sau khi test xong — không có API DELETE nào tồn tại)
students = 14, lecturers = 10, company_mentors = 7, notifications = 13 — tất cả khớp baseline
Không còn cross-profile link nào tồn đọng (verify bằng UNION query — kết quả rỗng)
3 profile đã link trong lúc test (students.id=2, lecturers.id=2, company_mentors.id=3) đã được khôi
  phục về user_id = NULL đúng trạng thái seed gốc
```

## 20. Regression
```
Auth (login + /me) cho cả 4 role seed: PASS
Admin resource counts (12 entity + settings): PASS, khớp baseline tuyệt đối
Student scope (students/internships/internship-logs/reports/evaluations/notifications): PASS
Lecturer scope (lecturers/internships/internship-logs/reports/evaluations): PASS
Company Mentor scope (company-mentors/internships/internship-logs/reports/evaluations): PASS
```

## 21. Lint/build
```
npm run lint:  40 warning (frontend không đổi trong phase này — đúng baseline đã xác nhận ở 4E-3)
npm run build: 189 modules, 0 lỗi (frontend không đổi)
Backend: node server.js khởi động thành công, GET /api/health + /api/health/db đều PASS
```

## 22. Browser status
```
NOT VERIFIED
```
Phase backend-only, không cần browser. HTTP + DB test trực tiếp là bằng chứng chính.

## 23. Known limitations
```
- err.stack vẫn xuất hiện trong response body khi NODE_ENV != 'production' — hành vi toàn hệ thống
  có từ trước (middleware/errorHandler.js), không phải thứ Phase 4F-1 thêm vào, ngoài phạm vi sửa
  (không nằm trong danh sách file được phép sửa của phase này).
- profile_id dùng naming snake_case riêng của backend, khác với linkedProfileId (camelCase) hiện có
  trong AdminAccountsPage.jsx mock — sẽ cần 1 mapper ở client/src/api/userApi.js khi migrate Phase
  4F-2 (đúng pattern đã áp dụng cho Settings ở Phase 4E-3).
- Role/profile cross-check (assertUserCanLinkProfileType) thêm 1-2 query nhỏ vào validateReferences
  của Student/Lecturer/CompanyMentor service — không ảnh hưởng hành vi hiện có (đã verify dữ liệu
  seed không có vi phạm), chỉ thêm 1 lớp bảo vệ mới cho các trường hợp tương lai.
- Không có cơ chế tìm "hồ sơ chưa link" qua API Users (ví dụ liệt kê students/lecturers/mentors chưa
  có user_id) — AdminAccountsPage hiện tự tính `unlinkedByRole` từ Student/Lecturer/CompanyMentor
  Context sẵn có; Phase 4F-2 cần giữ nguyên cách tiếp cận này (gọi 3 API hiện có, lọc user_id IS NULL
  phía client hoặc qua query param có sẵn), không cần thêm field/endpoint mới ở Phase 4F-1.
- Browser click-through chưa xác minh (không có tool, và phase này backend-only).
```
