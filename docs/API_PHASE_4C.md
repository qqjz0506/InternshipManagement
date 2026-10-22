# API PHASE 4C — Migrate Internships from Mock Data to REST API

## 1. Mismatch check

```
PASS
```
Field-by-field: `id, student_id, period_id, company_id, company_mentor_id, lecturer_id, topic_id, start_date, end_date, status, progress, created_at, updated_at` khớp 100% giữa `data/internships.js`, toàn bộ form/modal liên quan (`InternshipCreateModal`, `AssignLecturerModal`, `AssignCompanyModal`, `AssignTopicModal`, `StudentInternshipRegisterModal`, `StudentProposeCompanyModal`) và `internshipService.js`/`schema.sql`. Đối chiếu dữ liệu thật qua `GET /api/internships` (Admin) — khớp byte-for-byte với mock (12 bản ghi, đúng mọi FK/status/progress).

**Phát hiện quan trọng nhất (không phải mismatch, mà là đặc điểm kiến trúc phải tôn trọng):** Backend `internshipService.update()` dùng **PARTIAL update (merge)**, KHÁC với mọi entity đã migrate trước đó (Department/Period/Student/Lecturer/Company/CompanyMentor/Topic đều full-replace PUT). Điều này khớp chính xác với cách `InternshipsContext.updateInternship(id, changes)` (mock cũ) hoạt động — nên **không có mismatch PATCH-vs-PUT nào cần sửa** ở phase này (khác hẳn Phase 4B-2/4B-3 phải sửa `AdminAccountsPage`/`CompanyMentorFormModal`). Toàn bộ 10 điểm gọi `updateInternship(id, {...partial...})` trong Frontend tiếp tục hoạt động đúng không cần đổi payload shape.

Không có mismatch nào yêu cầu dừng hoặc đổi schema.

## 2. Files created
```
client/src/api/internshipApi.js
docs/API_PHASE_4C.md
```

## 3. Files modified
```
client/src/context/InternshipsContext.jsx       (viết lại hoàn toàn, API thật, giữ nguyên interface cũ)
client/src/pages/student/StudentInternshipPage.jsx
client/src/pages/admin/InternshipsPage.jsx
client/src/pages/admin/InternshipDetailPage.jsx
client/src/components/internships/InternshipCreateModal.jsx
client/src/components/internships/AssignLecturerModal.jsx
client/src/components/internships/AssignCompanyModal.jsx
client/src/components/internships/AssignTopicModal.jsx
client/src/components/internships/StudentInternshipRegisterModal.jsx
client/src/components/internships/StudentProposeCompanyModal.jsx
```
Không sửa backend/schema (không có mismatch nào yêu cầu). Không sửa `InternshipLogsContext`/`ReportsContext`/`EvaluationsContext`/`NotificationsContext`/`SettingsContext`/`UsersContext` hay bất kỳ file nào thuộc các Context đó.

## 4. API contract
```
client/src/api/internshipApi.js — getAll, getById, create, update, remove
```
Map 1-1 vào `GET/POST/PUT/DELETE /api/internships`, không có logic UI. `update(id, payload)` forward đúng payload PARTIAL như đã nhận — không tự gộp full object (khác convention các entity full-replace trước đó, vì backend ở đây vốn đã là partial).

## 5. Context migration
`InternshipsContext.jsx` viết lại hoàn toàn (KHÔNG dùng `createApiResourceContext` vì interface cũ dùng tên riêng `internships`/`addInternship`/`updateInternship`/`deleteInternship`/`isDuplicateRegistration`, khác `items`/`addItem`/`updateItem`/`deleteItem` của factory — giữ nguyên tên để không phá 12 file consumer). Thêm mới: `isLoading`, `isMutating`, `error` (chưa có ở bản mock). `isDuplicateRegistration` vẫn hoạt động đúng trên danh sách ĐÃ LOAD (đã bị backend scope theo role) vì 2 nơi gọi hàm này (`StudentInternshipRegisterModal` qua Student tự check, `InternshipCreateModal` qua Admin thấy toàn bộ) đều chỉ cần đúng phạm vi đó.

## 6. Frontend callers audited
Grep toàn bộ `useInternships(`, `addInternship(`, `updateInternship(`, `deleteInternship(` — 12 file tiêu thụ, trong đó 3 file có mutation thật:

| File | Mutation | Thay đổi |
|---|---|---|
| `StudentInternshipPage.jsx` | `addInternship` (đăng ký), `updateInternship` x3 (đổi DN, chọn đề tài có sẵn, gắn đề tài mới tạo) | Toàn bộ chuyển `async/await`; không đóng modal/navigate trước khi backend xác nhận; thêm `registerError`/`companyError`/`topicError` |
| `InternshipsPage.jsx` | `addInternship` (Admin tạo hồ sơ) | `handleCreate` async, chỉ `navigate` sau khi có `result.item.id` thật từ backend |
| `InternshipDetailPage.jsx` | `updateInternship` x6 (đổi trạng thái, sửa tiến độ, phân công GV/DN/đề tài), `deleteInternship` | Toàn bộ 7 handler chuyển async, disable nút khi `isMutating`, lỗi hiện qua `window.alert`/`submitError` theo từng modal, không optimistic update |

9 file còn lại chỉ đọc `internships` (qua `useMyInternship`/`useMyAssignedInternships`/`useMyMentoredInternships` hoặc trực tiếp) — không cần sửa, hoạt động đúng với dữ liệu đã scope từ backend (filter client-side trên danh sách đã scope là no-op, không phải lỗ hổng).

**Bug async tiềm ẩn đã chặn trước khi xảy ra:** `handleRegister`/`handleCreate` trước đây dùng `const created = addInternship(...)` đồng bộ rồi dùng ngay `created.id` — nếu không sửa sẽ lặp lại đúng lỗi đã gặp ở Phase 4B-4 (Promise bị dùng như object). Đã sửa `await` trước khi dùng kết quả ở cả 2 nơi.

## 7. RBAC
```
GET    /api/internships     — mọi role (scope trong service)
GET    /api/internships/:id — scope + 403 nếu ngoài phạm vi
POST   /api/internships     — Admin hoặc Student (tự đăng ký)
PUT    /api/internships/:id — Admin (toàn quyền) hoặc Student (3 field, trạng thái đầu, chính mình)
DELETE /api/internships/:id — chỉ Admin
```
Không sửa `authMiddleware`/`authorizationMiddleware`/`scopeService`/route — đúng policy đã có từ Phase 3B, chỉ verify lại bằng HTTP thật.

## 8. Data-level authorization
Test bằng JWT thật (không suy luận tĩnh) — xem bảng mục 13. Student/Lecturer/Company Mentor đều chỉ thấy đúng phạm vi (`student_id`/`lecturer_id`/`company_mentor_id` của chính mình); query-param (`?lecturer_id=`, `?company_id=`) không vượt qua được scope ép từ JWT.

## 9. Student ownership
```
Student A GET/PUT/DELETE hồ sơ của Student B → 403
Student A POST spoof student_id=B           → 403, không tạo hồ sơ dưới danh nghĩa B
Student A PUT student_id/period_id (của chính mình) → 403 (immutable, kể cả gửi đúng giá trị cũ)
Student A PUT field ngoài 3 field cho phép  → 403
```

## 10. Lecturer scope
```
Lecturer A GET danh sách → chỉ internship có lecturer_id = chính mình
Lecturer A GET internship của Lecturer B → 403
Lecturer A PUT bất kỳ → 403 (route không cho Lecturer PUT internship — đúng policy hiện tại, không mở rộng)
Query bypass ?lecturer_id=<B> → trả [] (không leak)
```

## 11. Company Mentor scope
```
Company Mentor A GET danh sách → chỉ internship có company_mentor_id = chính mình
Company Mentor A GET internship của Mentor B → 403
Company Mentor A PUT bất kỳ → 403 (route không cho Company Mentor PUT internship)
Query bypass ?company_id=<chung công ty với Mentor B> → trả [] (không leak sang mentor khác cùng công ty)
```

## 12. Status/business rules
```
STATUS_VALUES: pending, approved, in_progress, completed, rejected, cancelled (không đổi)
ALLOWED_TRANSITIONS (không đổi, đồng bộ frontend/backend):
  pending → approved, rejected, cancelled
  approved → in_progress, cancelled
  in_progress → completed, cancelled
  completed → (none)
  rejected → pending
  cancelled → pending
CREATE: luôn bắt đầu 'pending' — gửi status khác → 400
company_mentor_id phải thuộc đúng company_id hiệu lực (tạo mới VÀ cập nhật) — giữ nguyên rule Phase 2D
DELETE chỉ khi status = 'pending'
```
Không tự tạo status/transition mới — toàn bộ test theo đúng `ALLOWED_TRANSITIONS` đã có.

## 13. Tests

| Test | Result |
|---|---|
| No token | PASS (401) |
| Invalid token | PASS (401) |
| Admin GET list/detail | PASS |
| Admin POST (valid) | PASS (201) |
| Admin POST status=approved/in_progress/completed/rejected/cancelled | PASS (400 cả 5) |
| Admin POST duplicate (student+period) | PASS (409) |
| Admin POST invalid student/period FK | PASS (400 cả 2) |
| Admin PUT immutable student_id/period_id | PASS (400 cả 2) |
| Admin PUT invalid status transition | PASS (409) |
| Admin PUT valid status transition | PASS (200) |
| Admin PUT mentor không thuộc company đã chọn | PASS (400) |
| Admin PUT mentor đúng company | PASS (200) |
| Admin DELETE non-pending | PASS (409) |
| Admin DELETE pending (sau khi cycle về đúng trạng thái) | PASS (200) |
| Student A GET own | PASS (200) |
| Student A GET/PUT/DELETE Student B | PASS (403 cả 3) |
| Student A query-param bypass | PASS (vẫn scope đúng, không leak) |
| Student A POST spoof student_id | PASS (403) |
| Student A PUT immutable student_id/period_id | PASS (403 cả 2) |
| Lecturer A GET own scope | PASS |
| Lecturer A GET Lecturer B | PASS (403) |
| Lecturer A query bypass | PASS (trả rỗng) |
| Lecturer A PUT | PASS (403, route-level) |
| Company Mentor A GET own scope | PASS |
| Company Mentor A GET Mentor B | PASS (403) |
| Company Mentor A query bypass | PASS (trả rỗng) |
| Company Mentor A PUT | PASS (403, route-level) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |

## 14. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1:  PASS (departments=4, periods=3)
Phase 4B-2:  PASS (students=14, lecturers=10)
Phase 4B-3:  PASS (companies=10, company_mentors=7)
Phase 4B-4 + Topic Approval RBAC fix: PASS (topics=10, student spoof topic vẫn 403, Lecturer đọc
  topics vẫn 200)
```

## 15. Database integrity
```
14/14 tables
19/19 foreign keys
internships = 12 — khớp byte-for-byte với seed gốc (verify từng dòng qua SELECT trực tiếp MySQL,
  không chỉ tin response JSON)
Tất cả bảng khác không đổi (departments=4, periods=3, students=14, lecturers=10, companies=10,
  company_mentors=7, topics=10)
no test data left (internship test id=18 tạo-test-rồi-xoá sạch, các bản ghi tạm dùng để test
  transition/FK — id 1 và 18 — đã cycle đúng qua ALLOWED_TRANSITIONS về lại trạng thái hợp lệ trước
  khi xoá)
```

## 16. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 cảnh báo/lỗi mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 17. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 12 file tiêu thụ `useInternships` (không có dereference crash khi `internships` rỗng lúc loading — `InternshipDetailPage.jsx` được thêm `isLoading` guard riêng để tránh flash "không tìm thấy" sai trong lúc đang tải), test HTTP thật cho toàn bộ CRUD/ownership/IDOR/business-rule/status-transition, test DB trực tiếp (so khớp từng dòng, không chỉ tin response), và `npm run build` thành công.

## 18. Known limitations
```
- Không có flow "unassign" lecturer/company/mentor riêng cho Lecturer/Company Mentor tự thao tác —
  đúng hiện trạng (chỉ Admin được PUT internship ngoài phạm vi Student tự sửa 3 field).
- InternshipDetailPage.jsx hiện show "Đang tải dữ liệu..." toàn trang trong lúc GET /api/internships
  ban đầu chạy (không chỉ riêng record đang xem) — chấp nhận được vì đây vẫn là cách duy nhất để biết
  chắc "chưa tìm thấy" là do chưa tải xong hay do thực sự không tồn tại, nhất quán với cách các trang
  danh sách khác đã làm ở Phase 4B-1→4B-4.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
