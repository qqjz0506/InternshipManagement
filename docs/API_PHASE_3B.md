# API PHASE 3B — RBAC + Data-level Authorization

**Mismatch check: PASS.** Đối chiếu `users→students/lecturers/company_mentors` (qua `user_id`) và `internships.{student_id,lecturer_id,company_mentor_id,company_id}` với `docs/DATABASE_DESIGN.md`/`schema.sql` — khớp 100% với giả định trong yêu cầu. Phát hiện bổ sung quan trọng (không phải mismatch, chỉ là xác nhận qua đọc code thật): `LecturerProfilePage.jsx`/`CompanyProfilePage.jsx` là **read-only** (không có form tự sửa), nên Lecturer/Company Mentor **không** được cấp PUT self-edit; `StudentProposeTopicModal.jsx` cho Student **tạo Topic trực tiếp** (không chỉ Admin).

## 1. Authorization architecture

```
JWT (authMiddleware, Phase 3A)
  ↓ req.user = { id, fullName, email, role }
requireRole(...roles)        — RBAC thuần role, 403 nếu sai role (server/middleware/authorizationMiddleware.js)
  ↓
Controller                   — truyền req.user xuống service
  ↓
Service                      — data-level authorization: resolve profile sở hữu (scopeService.js),
  ↓                            lọc/chặn theo ownership, field whitelist theo role
Database (pool.execute)
```
Ownership resolution dùng chung qua `server/services/scopeService.js` (`getStudentProfile`, `getLecturerProfile`, `getCompanyMentorProfile`, `resolveOwnProfileIds`, `isOwnInternship`, `assertOwnInternshipById`) — tránh lặp lại query ở 13 resource khác nhau.

## 2. Files created
```
server/middleware/authorizationMiddleware.js   — requireRole(...roles)
server/services/scopeService.js                — ownership resolution helpers dùng chung
docs/API_PHASE_3B.md
```

## 3. Files modified
```
server/routes/*.js (13 file)              — thêm requireAuth + requireRole theo đúng ma trận mục 5
server/controllers/*.js (10 file)         — truyền req.user xuống service (students, lecturers,
                                             company_mentors, internships, internship_logs, reports,
                                             evaluations, notifications, topics, settings không đổi)
server/services/*.js (9 file)             — thêm ownership/scope logic (students, lecturers,
                                             company_mentors, internships, internship_logs, reports,
                                             evaluations, notifications; departments/companies/
                                             internship_periods/settings không cần đổi service)
```
Không sửa Frontend (route guard `ProtectedRoute`/`App.jsx` đã đúng theo role từ Phase 1, xác nhận qua đọc code, không cần sửa gì thêm — mục 20).

## 4. Schema changes
Không có.

## 5. RBAC matrix (role → permission mức cao)

| Resource | Admin | Student | Lecturer | Company Mentor |
|---|---|---|---|---|
| departments/companies/internship_periods | CRUD | R | R | R |
| topics | CRUD | R + C (chỉ cho chính mình) | R | R |
| students | CRUD | R (chính mình) + U (field liên hệ, chính mình) | R (SV mình phụ trách) | R (SV mình phụ trách) |
| lecturers | CRUD | R (lecturer của mình) | R (chính mình, read-only) | R (lecturer của mình) |
| company_mentors | CRUD | R (mentor của mình) | R (mentor của mình) | R (chính mình, read-only) |
| internships | CRUD | R/C/U (hồ sơ của mình, field+status hạn chế) | R (hồ sơ mình phụ trách) | R (hồ sơ mình phụ trách) |
| internship_logs | CRUD | R/C/U/D (log của mình, nội dung) | R/U (lecturer_comment+status, hồ sơ mình phụ trách) | R/U (company_comment, hồ sơ mình phụ trách) |
| reports | CRUD | R/C (báo cáo của mình) | R/U (status+reviewer_comment, hồ sơ mình phụ trách) | R/U (company_comment, hồ sơ mình phụ trách) |
| evaluations | CRUD | R (published, của mình) | R/C/U (evaluator_role=lecturer, publish 1 chiều, hồ sơ mình phụ trách) | R/C/U (evaluator_role=company, publish 1 chiều, hồ sơ mình phụ trách) |
| notifications | CRUD | R/U (is_read, của chính mình) | R/U (của chính mình) | R/U (của chính mình) |
| settings | R/U | R | R | R |

## 6. Ownership model

```
Student:         users.id --(user_id)--> students.id --(student_id)--> internships
Lecturer:        users.id --(user_id)--> lecturers.id --(lecturer_id)--> internships
Company Mentor:  users.id --(user_id)--> company_mentors.id --(company_mentor_id)--> internships
                                                                    company_mentors.company_id --> companies
```
Logs/Reports/Evaluations sở hữu gián tiếp qua `internship_id` → Internship → ownership ở trên (`scopeService.assertOwnInternshipById`). Notifications sở hữu trực tiếp qua `user_id = req.user.id`.

## 7. IDOR protection — đã test thực tế qua HTTP

```
Student A → Student B profile (GET/DELETE)        → 403
Student A → Student B internship (GET/PUT)         → 403
Student A → Student B internship log (GET)         → 403
Student A → Student B report (GET)                 → 403
Student A → Student B (unpublished) evaluation     → 403
Student A → Student B notification (GET/PUT)       → 403
Student A → notifications?user_id=<B> (query bypass)→ bị ép về user_id của A, KHÔNG trả dữ liệu B
Lecturer A → Lecturer B internship/student (GET)   → 403
Lecturer A → Lecturer B evaluation (GET)            → 403
Lecturer A → tạo evaluation cho internship B        → 403
Lecturer A → ép evaluator_role='company'            → 403
Company Mentor A → Company Mentor B internship      → 403
Student → tạo Internship/Topic dưới danh nghĩa SV khác → 403 (student_id/suggested_by_student_id bị ép)
```

## 8. HTTP authorization tests

| Test | Expected | Actual | Result |
|---|---:|---:|---|
| Admin GET /students (list) | 200 | 200 | PASS |
| Admin GET bất kỳ student/internship | 200 | 200 | PASS |
| Admin PUT /settings | 200 | 200 | PASS |
| Student own profile/internship (GET) | 200 | 200 | PASS |
| Student other profile/internship (GET) | 403 | 403 | PASS |
| Student DELETE own profile | 403 | 403 | PASS |
| Student PUT /settings | 403 | 403 | PASS |
| Student POST /departments | 403 | 403 | PASS |
| No token GET /students | 401 | 401 | PASS |
| Lecturer own scope (internship/student) | 200 | 200 | PASS |
| Lecturer outside scope | 403 | 403 | PASS |
| Lecturer PUT internship (không có quyền) | 403 | 403 | PASS |
| Company Mentor own scope | 200 | 200 | PASS |
| Company Mentor outside scope | 403 | 403 | PASS |
| Student self-edit field cho phép (phone) | 200 | 200 | PASS |
| Student self-edit field cấm (full_name) | 403 | 403 | PASS |
| Student tự đề xuất Topic | 201 | 201 | PASS |
| Student đề xuất Topic mạo danh SV khác | 403 | 403 | PASS |
| Lecturer tạo evaluation ngoài phạm vi | 403 | 403 | PASS |
| Lecturer publish eval của mình | 200 | 200 | PASS |
| Lecturer unpublish eval của mình | 403 | 403 | PASS |
| Admin unpublish bất kỳ eval | 200 | 200 | PASS |

## 9. IDOR tests
Đầy đủ danh sách ở mục 7 — toàn bộ chạy qua HTTP thật (curl + JWT thật của 2 tài khoản khác nhau mỗi role: `student@example.com`/`student2@example.com`, `lecturer@example.com`/`lecturer2@example.com`, `company@example.com`/`company2@example.com`), không phải suy luận tĩnh.

## 10. Regression
```
Phase 2A: PASS
Phase 2B: PASS
Phase 2C: PASS
Phase 2D: PASS
Phase 2E: PASS
Phase 2F: PASS
Phase 3A: PASS
```
(health, login, GET list mỗi resource với token admin, 1 delete-referenced-409 tiêu biểu mỗi nhóm — toàn bộ qua HTTP thật, không có resource nào bị phá business logic cũ.)

## 11. Database integrity
```
14/14 tables
19/19 foreign keys
seed preserved — users vẫn 10, mọi bảng khác đúng row count gốc
no test data left — internship 2 (dùng để test publish 1 chiều) đã khôi phục đúng status 'approved'/
  progress 10 ban đầu; student 1's phone khôi phục đúng giá trị gốc; mọi record test (topic, evaluation)
  đã tạo-rồi-xóa sạch trong phiên test.
```

## 12. Frontend
```
npm run lint: PASS (39 warning, không đổi so với baseline Phase 3A — không sửa Frontend)
npm run build: PASS (185 modules, 0 lỗi)
Browser click-through: NOT VERIFIED (môi trường không có browser tool — không claim đã test qua UI thật)
```

## 13. Known limitations
```
- Account Management (/api/users CRUD) CHƯA tồn tại dưới dạng REST API ở backend hiện tại (chỉ dùng
  nội bộ cho Auth) — section 12 của yêu cầu áp dụng "nếu có CRUD" nhưng hiện chưa có nên không có gì
  để bảo vệ thêm; không tự ý tạo mới resource này vì ngoài phạm vi Phase 3B.
- 403 được dùng thống nhất cho MỌI trường hợp ownership-fail (kể cả khi resource không tồn tại), theo
  đúng convention đã chọn ở mục 14 của yêu cầu (không phân biệt 403/404 để tránh lộ thông tin tồn tại
  của resource) — 404 chỉ còn ý nghĩa khi chính chủ thể hợp lệ (Admin, hoặc đúng chủ sở hữu) truy vấn
  1 id thực sự không tồn tại.
- Chưa có cơ chế refresh token / revoke token (giữ nguyên phạm vi Phase 3A, không mở rộng).
- Lecturer/Company Mentor vẫn chưa có khả năng tự sửa profile (đúng hiện trạng Frontend — read-only),
  nếu sau này Frontend bổ sung form tự sửa thì backend cần thêm field whitelist tương ứng.
```

## 14. Final verdict
```
PHASE 3B COMPLETE
```
