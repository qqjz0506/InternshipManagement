# API PHASE 4B-2 — Migrate Students + Lecturers from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `StudentsContext` và `LecturersContext` sang REST API thật (`/api/students`, `/api/lecturers`). Không migrate Companies/CompanyMentors/Topics/Internships/InternshipLogs/Reports/Evaluations/Notifications/Settings/Users. Không sửa database schema, RBAC architecture, hay thêm refresh token/Redux/Zustand/Axios.

## 2. Mismatch check

```
PASS (có 1 mismatch phát hiện trong lúc đọc code, đã sửa tối thiểu — xem chi tiết dưới)
```

**Field-by-field:**
- Student: `id, user_id, student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class, status, created_at, updated_at` — khớp 100% giữa `data/students.js`, `StudentFormModal.jsx`, `StudentProfilePage.jsx` và `studentService.js`/`schema.sql`. Không cần mapper.
- Lecturer: `id, user_id, lecturer_code, full_name, email, phone, department_id, position, status, created_at, updated_at` — khớp 100% giữa `data/lecturers.js`, `LecturerFormModal.jsx` và `lecturerService.js`/`schema.sql`. Không cần mapper.
- Đối chiếu dữ liệu thật qua `GET /api/students`/`GET /api/lecturers` (Admin) với `data/students.js`/`data/lecturers.js` — **trùng khớp byte-for-byte** (id, user_id, mã, tên, khoa...) — xác nhận mock data được tác giả dự án cố tình xây song song với seed thật, nên việc các Context khác (Internships, Topics — vẫn mock) tham chiếu `student_id`/`lecturer_id` chéo sang dữ liệu thật vẫn nhất quán, không có rủi ro lệch id tiềm ẩn.

**Mismatch thực sự tìm thấy — CRUD semantics (PATCH vs PUT), không phải field mismatch:**
`AdminAccountsPage.jsx` (trang Quản lý Tài khoản) khi "liên kết" tài khoản mới tạo với một Student/Lecturer có sẵn, gọi `updateStudent(id, { user_id })` / `updateLecturer(id, { user_id })` — chỉ gửi đúng 1 field. Với mock Context cũ, `updateItem` merge nông (`{...item, ...changes}`) nên việc này hoạt động. Với backend thật, route PUT của Admin (`studentController.validatePayload`/`lecturerController.validatePayload`) yêu cầu **toàn bộ object** (`student_code`, `full_name`, `email`, `department_id`...) có mặt mỗi lần PUT — gửi thiếu sẽ bị `400`. Đây không phải lỗi field-name mismatch, mà là khác biệt ngữ nghĩa PATCH (mock) vs PUT-toàn-phần (backend thật), **chỉ xuất hiện ở đúng 2 dòng gọi này** trong toàn bộ 42 file tiêu thụ 2 Context (mọi form Admin khác — `StudentFormModal`/`LecturerFormModal` — vốn đã luôn gửi object đầy đủ vì lấy từ `initialData`, không bị ảnh hưởng).
**Fix tối thiểu áp dụng:** sửa 2 dòng gọi trong `AdminAccountsPage.jsx` để merge đầy đủ record hiện có (`{...target, user_id: newUser.id}`) trước khi gọi `updateStudent`/`updateLecturer`, thay vì chỉ gửi `{user_id}`. Không sửa Context/API module/backend cho việc này (CompanyMentorsContext vẫn mock, câu lệnh `updateMentor` tương ứng giữ nguyên vì chưa migrate).

**Bug phụ phát hiện khi test (ngoài phạm vi migrate, không phải business rule) — đã vá tối thiểu:**
`server/services/studentService.js` — cả `create()` và `update()` (nhánh Admin) thiếu `?? null` cho field `gender` trong mảng tham số SQL (mọi field optional khác đều có `?? null`/`?? 'active'`). Khi payload không có `gender`, `mysql2` ném `TypeError: Bind parameters must not contain undefined` → **500** thay vì lỗi validation rõ ràng. Lỗi này **không bị kích hoạt qua Frontend thật** (`StudentFormModal.jsx` luôn có `EMPTY_FORM.gender = 'Nam'` mặc định, không bao giờ gửi `undefined`), chỉ lộ ra khi tôi test trực tiếp bằng payload thiếu field để xác nhận hành vi PUT-toàn-phần. Đã vá bằng cách thêm `?? null` (giống hệt pattern 6 field khác trong cùng hàm) ở cả 2 vị trí (`create`, `update`) — 1 dòng mỗi chỗ, không đổi business rule/validation. **Lưu ý:** cột `gender` là `NOT NULL` trong schema nên nếu thực sự gửi thiếu, lỗi giờ là 500 "Column 'gender' cannot be null" (DB-level) thay vì TypeError — sạch hơn nhưng vẫn không phải 400 chuẩn; vì không reachable qua UI thật và việc thêm `required` check vào `validatePayload` là mở rộng phạm vi validation (không phải lỗi migrate), tôi KHÔNG tự ý thêm — ghi nhận ở mục "Known limitations".

Backend server phải được restart (`node server.js`, không chạy qua `nodemon`/watch) để nhận bản vá này — đã xác nhận qua `tasklist`/`Get-CimInstance Win32_Process` trước khi restart.

## 3. Student backend contract
```
GET    /api/students            — mọi role (scoped: Admin=tất cả, Student=chính mình, Lecturer/CompanyMentor=SV mình phụ trách qua JOIN internships)
GET    /api/students/:id        — canAccessStudent() 403 nếu ngoài scope
POST   /api/students            — requireRole('admin')
PUT    /api/students/:id        — requireRole('admin','student'); Admin=full replace; Student=chỉ 5 field whitelist (email, phone, address, gender, date_of_birth), field khác bị 403, chỉ sửa được chính mình
DELETE /api/students/:id        — requireRole('admin'), 409 nếu còn Internship tham chiếu
```

## 4. Lecturer backend contract
```
GET    /api/lecturers           — mọi role (scoped: Admin=tất cả, Lecturer=chính mình, Student/CompanyMentor=GV liên quan qua JOIN internships)
GET    /api/lecturers/:id       — canAccessLecturer() 403 nếu ngoài scope
POST   /api/lecturers           — requireRole('admin')
PUT    /api/lecturers/:id       — requireRole('admin') DUY NHẤT — Lecturer KHÔNG có self-edit (đúng LecturerProfilePage.jsx read-only, xác nhận lại ở Phase 4B-2)
DELETE /api/lecturers/:id       — requireRole('admin'), 409 nếu còn Internship tham chiếu
```

## 5. Ownership model
```
users --(user_id)--> students --(student_id)--> internships
users --(user_id)--> lecturers --(lecturer_id)--> internships
```
Toàn bộ ownership/field-whitelist/scoping đã được **backend enforce hoàn toàn từ Phase 3B** — `StudentsContext`/`LecturersContext` (Phase 4B-2) chỉ cần pass-through CRUD qua `createApiResourceContext` (tái dùng nguyên bản từ Phase 4B-1, không viết logic riêng), vì:
- GET đã tự scope theo role ở service layer — Context không cần tự lọc gì thêm.
- Student self-edit: `StudentProfilePage.jsx` vốn đã chỉ gửi đúng 5 field whitelist (từ trước Phase 4B-2) — backend tự reject field khác, Context không cần biết whitelist là gì.
- Lecturer không có self-edit: không có trang nào gọi `updateItem` cho Lecturer ngoài `LecturersPage.jsx` (Admin).

Đây là lý do mục 25 của yêu cầu ("không ép logic ownership vào generic Context") **không áp dụng** ở đây — không có ownership logic nào cần đặt ở Context vì nó không tồn tại ở tầng Context, toàn bộ nằm ở backend.

## 6. Student field whitelist
Đối chiếu `STUDENT_SELF_EDITABLE_FIELDS` (`studentService.js`) = `['email', 'phone', 'address', 'gender', 'date_of_birth']` với 5 field mà `StudentProfilePage.jsx` gửi (`phone, email, address, gender, date_of_birth`) — **khớp 100%, không mismatch**. Field bị khoá (`student_code, full_name, department_id, class, major, status, user_id, id`) đều bị backend reject 403 nếu Student cố gửi (test ở mục 10).

## 7. API modules
```
client/src/api/studentApi.js   — getAll, getById, create, update, remove
client/src/api/lecturerApi.js  — getAll, getById, create, update, remove
```
Không có logic UI/ownership — chỉ map tên hàm ↔ endpoint qua `apiClient`.

## 8. Context migration
```
StudentsContext.jsx   → createApiResourceContext(studentApi, 'Students')
LecturersContext.jsx  → createApiResourceContext(lecturerApi, 'Lecturers')
```
Không còn import `data/students.js`/`data/lecturers.js` để populate state (2 file mock vẫn giữ nguyên trên đĩa, không còn consumer — đã grep xác nhận).

## 9. Loading/error handling
Giống pattern 4B-1: `items, isLoading, isMutating, error`. Áp dụng cho:
- `StudentsPage.jsx`/`LecturersPage.jsx` (Admin CRUD) — loading banner, error banner, disable nút Lưu khi `isMutating`, không đóng modal nếu mutation fail (thêm `submitError`/`isSubmitting` vào `StudentFormModal`/`LecturerFormModal`).
- `StudentProfilePage.jsx` (self-edit) — chuyển `handleSubmit` thành async, hiện `submitError` nếu PUT thất bại, disable nút "Lưu thay đổi" khi đang gửi, không còn hiện "Đã lưu" khi request chưa thành công (trước đây set message ngay lập tức, không chờ kết quả — đã sửa).

## 10. 401/403 handling
Không đổi kiến trúc Phase 4A (`apiClient` → `ApiError`/`UnauthorizedError`, không circular dependency). Test thực tế bằng JWT thật:
- Student A GET/PUT Student B → `403`, không optimistic update, state giữ nguyên.
- Lecturer A GET/PUT Lecturer B → `403`.
- Lecturer A PUT chính mình → `403` (đúng thiết kế — Lecturer không có self-edit).

## 11. CRUD
Pattern giống 4B-1: Form → Context (await) → API → thành công mới cập nhật state/đóng modal; 409 (FK) giữ nguyên item + `window.alert`.

## 12. IDOR tests
| Test | Expected | Actual |
|---|---|---|
| Student A GET Student B | 403 | 403 |
| Student A PUT Student B | 403 | 403 |
| Student A PUT self, field cấm (`student_code`) | 403 | 403 |
| Student A PUT self, cố gửi `student_id` (mạo danh) | 403 (field không nằm trong whitelist) | 403 |
| Student A PUT self, field hợp lệ (`phone`) | 200 | 200 (đã khôi phục giá trị gốc sau test) |
| Lecturer A GET Lecturer B | 403 | 403 |
| Lecturer A PUT Lecturer B | 403 | 403 |
| Lecturer A PUT chính mình | 403 (không có self-edit) | 403 |

## 13. Mock dependency status
```
Departments → API
Internship Periods → API
Students → API
Lecturers → API
Others (Companies, CompanyMentors, Topics, Internships, InternshipLogs, Reports, Evaluations,
        Notifications, Settings, Users) → vẫn mock
```

## 14. Regression
```
Phase 2A-2F: PASS (health, 12 resource GET list đều 200 với token admin)
Phase 3A:    PASS (login 4 role, /me có/không token)
Phase 3B:    PASS (403 role-based giữ nguyên, ví dụ Student POST /departments)
Phase 4A:    PASS (login/me/401 hành vi không đổi)
Phase 4B-1:  PASS (departments=4, internship-periods=3 không đổi sau khi restart server để vá bug)
```

## 15. Database integrity
```
14/14 tables
19/19 foreign keys
students = 14 (khớp seed gốc)
lecturers = 10 (khớp seed gốc)
departments = 4, internship_periods = 3 (không đổi)
no test data left (students id 16/17, lecturer id 12 tạo-test-rồi-xoá sạch)
student id=1 phone khôi phục đúng giá trị gốc 0901234567 sau test self-edit
encoding tiếng Việt đúng (xác nhận qua SELECT trực tiếp MySQL)
```

## 16. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, không có warning/error mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 17. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 42 file tiêu thụ `useStudents`/`useLecturers` (không có dereference crash khi `items` rỗng lúc loading — mọi nơi dùng `.find()`/`?.`/fallback `?? '—'`), test HTTP thật cho toàn bộ CRUD/ownership/IDOR, và `npm run build` thành công.

## 18. Known limitations
```
- gender vẫn là NOT NULL ở schema nhưng validatePayload không bắt buộc field này — nếu gọi API
  trực tiếp (không qua Frontend) mà thiếu gender, giờ nhận lỗi 500 "Column 'gender' cannot be null"
  (rõ ràng hơn TypeError cũ nhưng chưa phải 400 chuẩn). Không reachable qua Frontend thật
  (StudentFormModal luôn có default 'Nam'). Không tự ý thêm required-check vào validatePayload vì
  đó là mở rộng phạm vi validation, ngoài phạm vi "migrate Context sang API" của Phase 4B-2.
- Việc liên kết tài khoản (AdminAccountsPage) với Student/Lecturer hiện là fire-and-forget (không
  await kết quả updateStudent/updateLecturer) — nếu PUT thất bại (hiếm, vì đã merge đủ field), lỗi
  chỉ phản ánh qua Context.error chung, không có thông báo riêng tại modal tạo tài khoản. Chấp nhận
  được vì đây không phải luồng chính của phase, và hành vi trước đó (mock) còn không có concept lỗi.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```

## 19. Deferred work
Phase 4B-3 (nếu có) nên xử lý Companies + CompanyMentors — lưu ý CompanyMentor có khả năng tự sửa field liên hệ tương tự Student (cần đối chiếu lại whitelist thật ở backend), và `AdminAccountsPage.jsx`'s `updateMentor(id, {user_id})` call sẽ gặp đúng mismatch PATCH-vs-PUT đã tìm thấy ở phase này nếu CompanyMentorsContext migrate sang `createApiResourceContext` mà không sửa trước — cần fix tương tự (merge full record) tại thời điểm đó.
