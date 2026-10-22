# API PHASE 4B-1 — Migrate Departments + Internship Periods from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `DepartmentsContext` và `InternshipPeriodsContext` từ mock data (`data/departments.js`, `data/internshipPeriods.js`) sang REST API thật (`GET/POST/PUT/DELETE /api/departments`, `/api/internship-periods`). Không migrate Students/Lecturers/Companies/CompanyMentors/Topics/Internships/InternshipLogs/Reports/Evaluations/Notifications/Settings/Users. Không sửa RBAC, schema, backend business rules (không phát hiện mismatch cần sửa).

## 2. Mismatch check
```
PASS
```
Đối chiếu field-by-field:
- Departments: `id, department_code, department_name, description, created_at, updated_at` — backend (`departmentService.js`, `schema.sql`) khớp 100% với frontend (`data/departments.js`, `DepartmentFormModal.jsx`, `DepartmentsPage.jsx`). Không có camelCase nào ở frontend cần mapper.
- Internship Periods: `id, period_code, period_name, start_date, end_date, status, description, created_at, updated_at` — khớp 100% với `data/internshipPeriods.js`, `PeriodFormModal.jsx`, `InternshipPeriodsPage.jsx`.
- Cả hai Context chỉ có 2 page tiêu thụ CRUD thật (`DepartmentsPage.jsx`, `InternshipPeriodsPage.jsx` dùng `addItem/updateItem/deleteItem/isFieldTaken`); 28 file còn lại chỉ đọc `items` (read-only, qua `.find()`/`.map()`/`.filter()` với optional chaining `?.` hoặc fallback `?? '—'`) — xác nhận không có nơi nào dereference trực tiếp không an toàn khi `items` tạm thời rỗng lúc đang load (đọc code toàn bộ 28 file trước khi sửa).

Không có mismatch nào yêu cầu dừng.

## 3. Backend contracts
```
GET    /api/departments            — mọi role đã đăng nhập (requireAuth)
GET    /api/departments/:id
POST   /api/departments            — requireRole('admin'), 409 nếu department_code trùng
PUT    /api/departments/:id        — requireRole('admin'), 409 nếu trùng code, 404 nếu không tồn tại
DELETE /api/departments/:id        — requireRole('admin'), 409 nếu còn students/lecturers tham chiếu

GET    /api/internship-periods            — mọi role đã đăng nhập
GET    /api/internship-periods/:id
POST   /api/internship-periods            — requireRole('admin'), validate start<end, status enum, 409 nếu period_code trùng
PUT    /api/internship-periods/:id        — requireRole('admin'), cùng validate, 404 nếu không tồn tại
DELETE /api/internship-periods/:id        — requireRole('admin'), 409 nếu còn internships tham chiếu
```
Cả hai đều hỗ trợ `?search=` (và `status=` cho period) nhưng **không được wire** vì Frontend tiếp tục filter client-side trên danh sách đã load (danh sách nhỏ, hành vi UI không đổi — mục 18 yêu cầu).

## 4. Frontend model mapping
Không cần mapper — field name đã khớp 1-1 cả hai chiều (snake_case cả frontend lẫn backend). `api/departmentApi.js`/`api/internshipPeriodApi.js` truyền thẳng payload/response qua `apiClient`, không transform.

## 5. API modules
```
client/src/api/departmentApi.js        — getAll, getById, create, update, remove
client/src/api/internshipPeriodApi.js  — getAll, getById, create, update, remove
```
Không có logic UI; chỉ map tên hàm ↔ endpoint, đi qua `apiClient` (Phase 4A).

## 6. Departments migration
```
DepartmentsContext.jsx → createApiResourceContext(departmentApi, 'Departments')
```
Provider mount → `GET /api/departments` → `setItems`. Không còn import `data/departments.js`.

## 7. Internship Periods migration
```
InternshipPeriodsContext.jsx → createApiResourceContext(internshipPeriodApi, 'InternshipPeriods')
```
Provider mount → `GET /api/internship-periods` → `setItems`. Không còn import `data/internshipPeriods.js`.

Cả hai dùng chung 1 factory mới `client/src/context/createApiResourceContext.jsx` (cùng tinh thần `createResourceContext.jsx` cũ cho mock, nhưng server-confirmed state) — tránh lặp lại logic loading/error/CRUD giống hệt nhau ở 2 file, và sẽ tái dùng được ở Phase 4B-2+.

## 8. Loading/error handling
Context expose:
```
items        — [] ban đầu, server-confirmed sau khi GET thành công
isLoading    — true cho tới khi GET initial hoàn tất (thành công hoặc lỗi)
isMutating   — true trong lúc create/update/delete đang chạy
error        — message lỗi gần nhất (initial load hoặc mutation), null nếu không có lỗi
```
`DepartmentsPage.jsx`/`InternshipPeriodsPage.jsx` hiển thị "Đang tải dữ liệu..." khi `isLoading`, banner lỗi khi `error`, disable nút Lưu + đổi label "Đang lưu..." trong modal khi `isMutating` (`DepartmentFormModal`/`PeriodFormModal` nhận thêm prop `submitError`/`isSubmitting`). Không có `catch { return [] }` nào biến lỗi API thành dữ liệu rỗng im lặng.

## 9. 401/403 handling
`apiClient` (Phase 4A) ném `UnauthorizedError`/`ApiError{status,message}`. Context bắt lỗi ở `addItem/updateItem/deleteItem`, set `error` và trả `{success:false, message, status}` — không throw ra ngoài, không tạo circular dependency `apiClient → AuthContext → apiClient`. Test thực tế: Student gọi `POST /departments` và `DELETE /internship-periods/1` đều nhận `403` từ backend, Context giữ nguyên state cũ (không optimistic), UI sẽ hiển thị lỗi qua `error`/`submitError` nếu action này được kích hoạt từ UI (trong thực tế menu Admin không hiện cho Student nên đường này chỉ test được qua HTTP trực tiếp, không qua click UI — đúng nguyên tắc "không dùng ẩn menu làm security" đã verify ở Phase 3B, nay xác nhận lại tầng Context/API cũng không bypass).

## 10. CRUD flow
```
CREATE: Form submit → Context.addItem (await) → POST → thành công: append vào items + đóng modal
                                                  → thất bại: KHÔNG đóng modal, hiện submitError
UPDATE: tương tự, PUT → thay thế item trong items bằng response server (không merge thủ công)
DELETE: confirm → Context.deleteItem (await) → thành công: xoá khỏi items
                                              → 409: giữ nguyên item trong state, window.alert(message)
```
Không có optimistic update ở bất kỳ bước nào — state chỉ đổi sau khi backend xác nhận thành công.

## 11. Mock dependency removal
```
DepartmentsContext.jsx          — không còn import data/departments.js
InternshipPeriodsContext.jsx    — không còn import data/internshipPeriods.js
data/departments.js             — vẫn còn trên đĩa, không còn nơi nào import (đã grep xác nhận)
data/internshipPeriods.js       — vẫn còn trên đĩa, không còn nơi nào import (đã grep xác nhận)
```
Không xoá 2 file data này (đúng mục 21 — giữ cho nhất quán quy tắc "không xóa data files", dù hiện không còn consumer).

## 12. Tests

| Test | Result |
|---|---|
| Departments GET | PASS (list 4 + detail id=1) |
| Departments POST | PASS (201, tạo rồi xoá sạch) |
| Departments PUT | PASS (200) |
| Departments DELETE | PASS (200, test record) |
| Department validation | PASS (400 thiếu department_name) |
| Department duplicate | PASS (409 trùng department_code) |
| Department FK restriction | PASS (409 — id=1 đang có Students/Lecturers) |
| Internship Period GET | PASS (list 3 + detail id=1) |
| Internship Period POST | PASS (201, tạo rồi xoá sạch) |
| Internship Period PUT | PASS (200) |
| Internship Period DELETE | PASS (200, test record) |
| Period validation | PASS (400 end_date trước start_date) |
| Period duplicate | PASS (409 trùng period_code) |
| Period FK restriction | PASS (409 — id=2 đang có Internships) |
| 403 Student POST /departments | PASS |
| 403 Student DELETE /internship-periods | PASS |
| Lint | PASS (39 warning, baseline không đổi, exit 0) |
| Build | PASS (188 modules, 0 lỗi) |
| Regression 2A-2F | PASS (health, students, lecturers, companies, company-mentors, topics, internships, internship-logs, reports, evaluations, notifications, settings đều 200 với token đúng role) |
| Regression 3A-3B | PASS (login 4 role, `/me`, 403 theo role đều đúng) |
| Regression 4A | PASS (login/me/401 không token/token sai vẫn đúng hành vi) |
| DB integrity | PASS (14/14 bảng, 19/19 FK, departments=4, internship_periods=3 — khớp seed gốc) |

**Lưu ý kỹ thuật trong quá trình test (không phải bug sản phẩm):** Khi gõ chuỗi tiếng Việt có dấu trực tiếp làm argument cho `curl` qua Bash trên Windows, ký tự bị mã hoá sai (`Đợt` → `�?t`). Xác minh bằng cách ghi payload ra file UTF-8 (`xxd` kiểm tra đúng byte `c4 90`/`e1 bb a3`) rồi gửi bằng `--data-binary @file` — backend trả về đúng "Đợt Test Encoding" nguyên vẹn. Đây là lỗi mã hoá của bản thân công cụ dòng lệnh test (Bash arg trên môi trường này), không phải lỗi `apiClient`/backend — frontend thật dùng `fetch` + `JSON.stringify` từ chuỗi JS trong trình duyệt nên không gặp vấn đề này.

## 13. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool trong môi trường này. Mục 12 (Frontend manual test checklist: mở trang, reload, create/edit/delete/search/filter qua UI thật) **chưa được xác minh qua thao tác chuột thật** — chỉ xác minh qua: (a) đọc code từng page/component tiêu thụ Context, (b) test HTTP trực tiếp cho toàn bộ CRUD/validation/409 ở trên, (c) `npm run build` thành công (không có lỗi runtime-breaking ở build time).

## 14. Known limitations
```
- isFieldTaken() vẫn chỉ là gợi ý UX client-side (check trên state đã load) — vẫn có race condition
  lý thuyết nếu 2 admin tạo cùng mã cùng lúc; backend 409 là nguồn sự thật cuối cùng, đã test PASS.
- apiClient's search/filter query params (?search=, ?status=) của 2 endpoint này chưa được wire —
  Frontend tiếp tục filter toàn bộ danh sách đã tải về (đúng quyết định mục 18, danh sách nhỏ).
- Chưa có UI xử lý riêng cho trường hợp 401 giữa phiên (token hết hạn khi đang thao tác Departments/
  Periods) — Context sẽ trả {success:false, message} như mọi lỗi khác, chưa tự động điều hướng về
  /login hay hiển thị toast riêng biệt cho "phiên hết hạn" (giữ đúng giới hạn đã nêu ở Phase 4A).
- Browser click-through chưa xác minh trực tiếp (không có tool).
```

## 15. Deferred work
Phase 4B-2 trở đi: migrate `StudentsContext`, `LecturersContext` theo đúng pattern `createApiResourceContext` đã thiết lập ở phase này (có thể cần field whitelist/ownership phức tạp hơn vì Student tự sửa field liên hệ — khác Departments/Periods vốn admin-only ghi).
