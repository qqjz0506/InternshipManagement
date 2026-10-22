# API PHASE 4F-2 — Frontend Users / Accounts API Migration

## 1. Scope
Migrate `UsersContext` + `AdminAccountsPage`/`AccountFormModal`/`AccountDetailModal` từ mock (`MOCK_USERS`, session-only, plaintext password) sang `/api/users` thật (Phase 4F-1, đã approved). Không sửa `server/`. Không sửa AuthContext/authApi/apiClient/ProtectedRoute/LoginPage. Không thêm delete/lock/reset-password.

## 2. Mismatch check / API mapper

```
Response GET/POST/PUT /api/users đã là camelCase {id, fullName, email, role} (authService.toSafeUser()
map full_name -> fullName tại server) — KHÔNG cần mapper chiều đọc.
```

Mapper CHỈ cần cho chiều GHI (request body), đặt tại `client/src/api/userApi.js` (API boundary, đúng pattern Settings/Phase 4E-3):
- `createUser({fullName, email, password, role, linkedProfileId})` → gửi `{full_name, email, password, role, profile_id}` (chỉ thêm `profile_id` nếu `linkedProfileId` có giá trị).
- `updateUser(id, {fullName, email, password})` → gửi `{full_name, email, password?}` (partial, chỉ field có mặt).

`linkedProfileId` (frontend) ↔ `profile_id` (backend) chỉ đổi TÊN field, KHÔNG đổi domain giá trị — cả hai đều là ID của `students.id`/`lecturers.id`/`company_mentors.id`, không phải `users.id`. Test thực tế xác nhận: tạo user mới id=15, link vào `students.id=2` → `students.id=2.user_id = 15` (hai ID khác nhau, không bị nhầm lẫn domain).

## 3. Files modified
```
client/src/api/userApi.js                           — mới
client/src/context/UsersContext.jsx                  — viết lại, API-backed, KHÔNG dùng
                                                         createApiResourceContext (mục 4)
client/src/components/accounts/AccountFormModal.jsx  — bỏ pre-fill password, thêm submitError/
                                                         isSubmitting, password optional khi edit
client/src/pages/admin/AdminAccountsPage.jsx         — bỏ 2-bước create+link thủ công, dùng
                                                         createUser()/updateUser() trực tiếp (atomic
                                                         ở backend), thêm loading/error state
client/src/pages/admin/CompanyMentorsPage.jsx         — sửa destructuring useUsers() (items -> users)
client/src/data/mockUsers.js                          — xoá MOCK_USERS, giữ ROLE_LABELS/ROLE_HOME_PATH
```
`AccountDetailModal.jsx`: KHÔNG cần sửa — vốn đã chỉ đọc `account.user.fullName/email`, `roleLabel`, `extraFields` (không đọc password, không đọc field nào đổi shape).

## 4. Tại sao không dùng `createApiResourceContext`
Backend không có DELETE — nếu dùng factory generic, `deleteItem()` sẽ gọi `api.remove()` không tồn tại, lỗi runtime nếu lỡ gọi (không có, nhưng là 1 trap tiềm ẩn không cần thiết). Create/Update cũng có semantics riêng (password optional-on-update, role/profile_id immutable, linking atomic lúc tạo) không khớp interface generic `{getAll,create,update,remove}`. Viết Context tay, giữ đúng tinh thần (state shape, convention `{success, item?}`/`{success:false,message,status}`) nhưng không export `deleteItem`/`deleteUser`.

## 5. UsersContext interface
```
{ users, isLoading, isMutating, error, getById, createUser, updateUser, isFieldTaken }
```
Đổi tên `items`→`users`, `addItem`→`createUser`, `updateItem`→`updateUser` so với bản mock cũ (không còn ràng buộc phải giữ tên generic vì không dùng factory chung với entity khác nữa) — khớp đúng tên hàm của `userApi.js`. `AdminAccountsPage.jsx` và `CompanyMentorsPage.jsx` (2 consumer duy nhất) đã cập nhật theo.

## 6. Create flow
```
AccountFormModal → AdminAccountsPage.handleSubmit → UsersContext.createUser(formValues)
  → userApi.createUser() → POST /api/users (1 request DUY NHẤT)
```
Đã loại bỏ hoàn toàn logic cũ (`addUser()` rồi `updateStudent/updateLecturer/updateMentor()` thành 2+ bước) — backend đảm bảo atomic (Phase 4F-1 mục 6/10), frontend không tự lặp lại transaction.

## 7. Create success/failure
- Success: `createUser()` trả `{success:true, item}` → `UsersContext` tự thêm vào `users` state → modal đóng → danh sách cập nhật ngay (không `window.location.reload()`). Vì `unlinkedByRole` tính từ `StudentsContext/LecturersContext/CompanyMentorsContext` (đã migrate thật từ Phase 4B-2/4B-3, không đổi ở phase này), muốn profile vừa link biến mất khỏi danh sách "chưa liên kết" cần các Context đó phản ánh `user_id` mới — xác nhận qua test trực tiếp DB rằng `student.user_id` đã được set đúng; trong phiên làm việc thực tế, Admin cần F5 hoặc các Context đó refetch để thấy profile biến mất khỏi dropdown (không có cơ chế tự invalidate cross-Context trong kiến trúc hiện tại của dự án — đây là hạn chế đã tồn tại từ trước, không phải riêng Users, xem mục 15).
- Failure (400/403/409/500): KHÔNG mutate `users` state, modal KHÔNG tự đóng, lỗi hiển thị qua `submitError` (prop truyền vào `AccountFormModal`, cùng pattern `StudentFormModal`/`StudentsPage` đã dùng), Admin sửa và submit lại được.

## 8. Edit flow / password handling
- Role, liên kết hồ sơ: vẫn khóa cứng trên UI (field disabled) — khớp đúng backend immutable (400 nếu gửi).
- Password: KHÔNG pre-fill (backend không bao giờ trả `password`/`password_hash`) — field luôn bắt đầu rỗng, label đổi thành "Mật khẩu mới (để trống nếu không đổi)". Để trống khi submit → `userApi.updateUser()` KHÔNG đưa `password` vào payload → backend giữ nguyên `password_hash` cũ. Nhập mật khẩu mới → gửi `password`, backend tự bcrypt hash.
- Test thật: sửa tên/email không kèm password → login bằng password cũ vẫn OK. Sửa kèm password mới → login bằng password cũ 401, password mới 200.

## 9. Password security (frontend)
Xác nhận bằng grep toàn bộ `client/src`: không còn `MOCK_USERS`, không có `password` nào tồn tại ngoài phạm vi: state cục bộ của `AccountFormModal`/`LoginPage` (trong lúc nhập) và payload request (`userApi.js`). `UsersContext` state (`users`) chỉ chứa `{id, fullName, email, role}` — không có trường password nào. Không có `localStorage`/`sessionStorage` nào ghi password ở bất kỳ đâu trong dự án (grep xác nhận).

## 10. Role/profile UI
- Tạo mới: role=admin → ẩn hẳn phần chọn hồ sơ liên kết (giữ nguyên UI cũ, `formData.role !== 'admin'` guard đã có sẵn). Nếu Admin không chọn hồ sơ, `linkedProfileId` gửi `null`, `userApi.createUser()` không thêm `profile_id` vào payload (backend không reject vì field không có mặt, không phải `null` tường minh gây lỗi khác — đã test).
- Available profile list: KHÔNG tạo endpoint mới, tiếp tục derive từ `students/lecturers/company_mentors` filter `!profile.user_id` (code đã có sẵn từ trước, không đổi) — đúng chỉ đạo mục 10 của phase.

## 11. HTTP test matrix (mô phỏng đúng wire format `userApi.js` sẽ gửi)

| Test | Result |
|---|---|
| Create student + link profile (user.id=15, profile.id=2 — ID KHÁC NHAU, test chủ đích mục 46) | PASS |
| Login bằng account vừa tạo | PASS |
| `/api/auth/me` trả đúng id/fullName/email/role, không password | PASS |
| Student scope resolve đúng `student.id=2` (không nhầm `user.id=15`) | PASS |
| Student mới KHÔNG truy cập được `/api/users` | PASS (403) |
| Profile vừa link biến mất khỏi "chưa liên kết" (`user_id IS NULL`) | PASS (verify DB) |
| Edit: đổi fullName+email, không gửi password | PASS, login password cũ vẫn OK |
| Edit: đổi password | PASS, login password cũ 401, password mới 200 |
| Admin tự sửa `full_name` của chính mình | PASS — session/JWT hiện tại không bị ảnh hưởng (`requireAuth` re-query DB mỗi request, không cache) |
| Lint | PASS (40 warning — khớp baseline, không tăng) |
| Build | PASS (189 modules, 0 lỗi) |

## 12. Sự cố phát hiện trong lúc test (đã khắc phục ngay)
Khi test "Admin tự sửa full_name", đã vô tình gõ `-d '{"full_name":"Quản trị viên"}'` trực tiếp làm tham số dòng lệnh Bash (vi phạm quy tắc chuẩn của dự án: không gõ văn bản có dấu tiếng Việt trực tiếp làm argument Bash) — làm hỏng encoding `users.id=1.full_name` thành `"Qu?n tr? vi?n"`. Phát hiện ngay qua response, khắc phục bằng file `.sql` UTF-8 (`UPDATE users SET full_name = 'Quản trị viên' WHERE id = 1`) chạy qua `mysql --default-character-set=utf8mb4`, verify lại khớp byte-for-byte với giá trị seed gốc. Đây là lần thứ 4 trong dự án gặp sự cố encoding cùng nguyên nhân (trước đó: Phase 4B-1, Topic Approval RBAC fix, Phase 4E-3) — luôn xử lý bằng đúng quy trình UTF-8-file đã chuẩn hóa.

## 13. Database integrity
```
14/14 tables
19/19 foreign keys
users = 10 (user test id=15 đã xoá qua SQL — không có DELETE API, đúng như Phase 4F-1)
students = 14 (student.id=2.user_id khôi phục về NULL)
lecturers = 10, company_mentors = 7, notifications = 13 — không đổi
Không còn cross-profile link nào tồn đọng
Không có email trùng
settings.system_name/system_description vẫn đúng tiếng Việt (verify lại bằng
  --default-character-set=utf8mb4 — 1 lần kiểm tra thiếu flag này trước đó hiển thị ký tự lỗi trên
  console nhưng dữ liệu thật không hề bị ảnh hưởng, chỉ là display artifact của mysql.exe)
```

## 14. Regression
```
GET /api/health, /api/health/db: PASS
Login + /api/auth/me cho cả 4 role seed: PASS
Backend Phase 4F-1 không bị đụng tới, toàn bộ test matrix của 4F-1 vẫn còn nguyên giá trị (không
  re-run lại toàn bộ vì server không đổi, chỉ re-verify health+auth làm smoke test)
```

## 15. Lint/build
```
npm run lint:  40 warning (khớp baseline xác lập từ Phase 4E-3/4F-1, không tăng — 2 warning "mới" ở
  UsersContext.jsx/AccountFormModal.jsx cùng class với warning đã tồn tại ở bản cũ của chính 2 file
  này trước khi sửa, không phải loại cảnh báo mới)
npm run build: 189 modules, 0 lỗi (thêm userApi.js nhưng tổng module count không đổi so với lần build
  trước — đã verify bằng cách tìm literal "profile_id" trong bundle, xác nhận code userApi.js có
  thực sự được đưa vào build, không phải bị bỏ sót)
```

## 16. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool trong môi trường này (đã xác nhận lại qua ToolSearch, nhất quán với mọi phase trước). Đã bù đắp bằng mức độ nghiêm ngặt tối đa có thể: test HTTP thật mô phỏng CHÍNH XÁC wire format mà `userApi.js`/`UsersContext.jsx` sẽ gửi (không chỉ test API trần như Phase 4F-1, mà test đúng payload shape sau khi qua mapper), test tình huống `user.id ≠ profile.id` tường minh (mục 46), đọc lại toàn bộ component code để xác nhận luồng prop/state (`submitError`/`isSubmitting`/`isLoading` wiring) khớp đúng pattern đã dùng ở `StudentsPage`/`StudentFormModal`. Đây KHÔNG thay thế cho click-through thật — nếu người dùng có thể mở `http://localhost:5173` để xác nhận trực quan, nên làm thêm bước đó trước khi coi phase này là hoàn thiện tuyệt đối.

## 17. Known limitations
```
- Sau khi tạo/link account mới, các Context Students/Lecturers/CompanyMentors không tự động refetch
  — nên dropdown "hồ sơ chưa liên kết" trong modal Tạo tài khoản TIẾP THEO (lần mở modal sau) có thể
  chưa phản ánh ngay profile vừa bị link, trừ khi trang được tải lại hoặc các Context đó tự refetch
  qua điều hướng. Đây là hạn chế kiến trúc có từ trước (không có cơ chế invalidate cross-Context nào
  trong dự án, kể cả trước Phase 4F-2), không phải lỗi riêng của Users migration — không tự thêm cơ
  chế invalidate mới vì ngoài phạm vi tối thiểu của phase này.
- AccountDetailModal.jsx đọc `account.linkedLabel` nhưng AdminAccountsPage spread field tên `label`
  (không phải `linkedLabel`) vào row — đây là mismatch PRE-EXISTING từ trước Phase 4F-2 (không liên
  quan đến migration Users), khiến dòng "Đối tượng liên kết" trong modal chi tiết luôn hiển thị rỗng.
  Ghi nhận nhưng KHÔNG sửa vì ngoài phạm vi phase này (không phải do Users API migration gây ra, và
  sửa UI không nằm trong chỉ đạo của phase).
- Browser click-through chưa xác minh trực tiếp (không có tool) — xem mục 16.
```
