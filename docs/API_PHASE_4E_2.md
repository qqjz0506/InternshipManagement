# API PHASE 4E-2 — Migrate Notifications from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `NotificationsContext` sang REST API thật (`/api/notifications`) và 3 page tiêu thụ trực tiếp (`StudentNotificationsPage.jsx`, `LecturerNotificationsPage.jsx`, `CompanyNotificationsPage.jsx`). Không migrate Settings/Users/Accounts/Auth hay bất kỳ entity nào khác.

## 2. Mismatch check

```
PASS
```
Field-by-field: `id, user_id, title, content, type, is_read, created_at` khớp 100% giữa `data/notifications.js`, cả 3 page tiêu thụ và `notificationService.js`/`schema.sql`. `type` enum `['internship','assignment','report','reminder','evaluation','log']` khớp chính xác (kể cả `'log'` dù frontend label chỉ xuất hiện ở Lecturer/Company page, không phải Student page — đúng thực tế, không tự thêm label hay đổi enum). Đối chiếu dữ liệu thật qua `GET /api/notifications` (Admin) — khớp byte-for-byte với mock (13 notification, đúng `is_read` từng dòng). Không tự thêm `read_at`/`priority`/`sender_id`/notification templates/event engine nào.

Không có mismatch nào yêu cầu dừng. Ghi nhận 2 khác biệt cosmetic không ảnh hưởng chức năng (xem mục 14 Known limitations): `created_at` trả về dạng `DATETIME` đầy đủ (`"2025-02-05 00:00:00"`) thay vì chỉ ngày như mock (`"2025-02-05"`) — cột hiển thị trực tiếp không qua format nên UI giờ hiện cả giờ:phút:giây; `is_read` trả về `0`/`1` (TINYINT qua mysql2) thay vì `true`/`false` — nhưng mọi nơi dùng đều là truthy-check (`row.is_read ? ... : ...`, `!row.is_read`), không có so sánh `=== true` nào nên KHÔNG có bug như đã gặp ở Phase 4E-1 (`is_published`).

## 3. API module
```
client/src/api/notificationApi.js — getAll, getById, create, update, remove
```
Map 1-1 vào `GET/POST/PUT/DELETE /api/notifications`, không có logic UI, không duplicate fetch wrapper.

## 4. Context migration
```
NotificationsContext.jsx → createApiResourceContext(notificationApi, 'Notifications')
```
Tái dùng factory có sẵn (naming `items`/`addItem`/`updateItem`/`deleteItem` đã tương thích sẵn từ mock Context cũ). Thêm `isLoading`/`isMutating`/`error`.

## 5. Authorization
```
GET    /api/notifications      — mọi role; non-admin LUÔN bị ép user_id = chính mình, KHÔNG tin
                                   query param ?user_id= (IDOR protection, re-verify bằng JWT thật)
GET    /api/notifications/:id  — 403 nếu không phải chủ sở hữu (trừ Admin)
POST   /api/notifications      — CHỈ Admin (route-level, không UI nào khác tạo notification)
PUT    /api/notifications/:id  — chủ sở hữu hoặc Admin (chỉ field is_read, enforce ở service)
DELETE /api/notifications/:id  — CHỈ Admin
```
Không sửa `authMiddleware`/`authorizationMiddleware`/`scopeService`/route. Notification ownership đi trực tiếp qua `user_id`, KHÔNG qua Internship (đúng mô hình 1-N users→notifications, không giống Logs/Reports/Evaluations).

## 6. Mark-as-read behavior
```
StudentNotificationsPage.jsx / LecturerNotificationsPage.jsx / CompanyNotificationsPage.jsx:
  handleMarkRead(id)      → updateItem(id, { is_read: true })      (1 notification)
  handleMarkAllRead()     → Promise.all(...) cho mọi notification chưa đọc của chính mình
```
Giữ đúng behavior cũ (`false → true`, một chiều — không có UI nào cho đánh dấu ngược lại "chưa đọc"). Backend thực tế KHÔNG ép one-way ở tầng service (`payload.is_read ? 1 : 0` chấp nhận cả 2 chiều) nhưng Frontend không có UI gọi chiều ngược — không tự thêm.

**Bug async đã chặn trước khi xảy ra:** `handleMarkAllRead()` trước đây dùng `.forEach(... => updateItem(...))` — mỗi lần gọi là 1 Promise bị bỏ rơi (fire-and-forget), không có cách biết thành công/thất bại, không chặn double-click. Đã sửa thành `await Promise.all(...)`, thu thập toàn bộ kết quả, báo lỗi đầu tiên nếu có bất kỳ request nào fail, và disable nút trong lúc `isMutating`.

## 7. Validation
```
CREATE: user_id phải tồn tại (400 nếu không), title bắt buộc, type phải thuộc enum (400 nếu không)
UPDATE: phải có ít nhất 1 field hợp lệ để sửa (400 "Không có trường nào để cập nhật" nếu rỗng)
```

## 8. Immutable fields
```
user_id, title, content, type — đều bị reject CỨNG (400) nếu có mặt trong payload UPDATE, test field-
  injection riêng từng field, cả 4 đều PASS.
created_at — KHÔNG nằm trong danh sách guard 400 tường minh, nhưng UPDATE SQL thực tế chỉ
  `SET is_read = ?` (không dùng payload.created_at trong câu lệnh) → gửi created_at không gây lỗi
  NHƯNG cũng KHÔNG thực sự ghi đè được giá trị (đã verify: created_at trước/sau test giống hệt nhau).
  Đây là khác biệt nhỏ về cách xử lý (silent-ignore thay vì 400 tường minh) so với 4 field kia, nhưng
  KHÔNG phải lỗ hổng bảo mật/toàn vẹn dữ liệu (không có ghi thực sự xảy ra), và không ảnh hưởng bất kỳ
  luồng thật nào (Frontend chỉ bao giờ gửi đúng `{is_read}`). Không tự sửa backend để thêm guard này
  vào vì đây không phải mismatch ảnh hưởng chức năng thật — chỉ ghi nhận ở Known limitations (mục 14).
```

## 9. HTTP test matrix

| Test | Result |
|---|---|
| No token / invalid token | PASS (401 cả hai) |
| Admin GET all (13) | PASS |
| Student A GET own (3 notification) | PASS |
| Student A query ?user_id=<B> | PASS (vẫn chỉ thấy của mình — query bị bỏ qua hoàn toàn) |
| Student A GET B's detail | PASS (403) |
| Lecturer A GET own / query bypass / GET B's detail | PASS (cả ba) |
| Mentor A GET own / query bypass / GET B's detail | PASS (cả ba) |
| Student A POST (cho chính mình hoặc cho B) | PASS (403 route-level, cả hai) |
| Admin POST invalid user_id/type | PASS (400 cả hai) |
| Admin POST valid | PASS (201) |
| Student A mark own as read | PASS (200) |
| Student A mark B's as read | PASS (403) |
| Student A inject user_id/title/content/type | PASS (400 cả bốn) |
| Student A PUT rỗng | PASS (400) |
| Student A DELETE | PASS (403 route-level) |
| Admin DELETE (cleanup) | PASS (200) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |

## 10. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1 → 4B-4 + Topic Approval RBAC fix: PASS (departments=4, periods=3, students=14,
  lecturers=10, companies=10, company_mentors=7, topics=10 — không đổi)
Phase 4C:    PASS (internships=12, không đổi)
Phase 4D-1:  PASS (internship_logs=3, không đổi)
Phase 4D-2:  PASS (reports=2, không đổi)
Phase 4E-1:  PASS (evaluations=2, eval #1 vẫn is_published=1, publish-lock giữ nguyên)
```

## 11. Database integrity
```
14/14 tables
19/19 foreign keys
notifications = 13 — khớp seed gốc byte-for-byte (verify từng dòng is_read qua SQL trực tiếp)
Tất cả bảng khác không đổi
no test data left (notification id=16 tạo-test-rồi-xoá sạch)
FK notifications.user_id → users ON DELETE CASCADE — xác nhận qua đọc schema.sql, không sửa, không
  test thực tế vì không có endpoint xóa User nào tồn tại trong hệ thống (đúng phạm vi — Users/Accounts
  chưa migrate).
```

## 12. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 cảnh báo/lỗi mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 13. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 6 file tiêu thụ `useNotifications` (grep xác nhận không còn consumer nào import trực tiếp `data/notifications.js`), test HTTP thật cho toàn bộ scope/IDOR/query-bypass/field-injection/mark-as-read (JWT thật của 2 Student, 2 Lecturer, 2 Company Mentor + Admin), test DB trực tiếp (COUNT(*) thật + so khớp từng dòng), và `npm run build` thành công.

## 14. Known limitations
```
- created_at hiển thị dạng DATETIME đầy đủ (giờ:phút:giây) thay vì chỉ ngày như mock cũ — cosmetic,
  không sửa vì sẽ cần thêm logic format ngày mới (ngoài phạm vi tối thiểu của phase).
- created_at không nằm trong danh sách immutable-field guard 400 tường minh ở backend (khác
  user_id/title/content/type) nhưng cũng không thực sự ghi đè được (UPDATE SQL không dùng field này)
  — không phải lỗ hổng, chỉ là inconsistency nhỏ trong cách báo lỗi, không sửa vì đây là thay đổi
  backend ngoài phạm vi "mismatch ảnh hưởng chức năng thật".
- Không có Admin UI quản lý Notification (tạo/sửa/xóa) — đúng hiện trạng Frontend, không tự dựng UI
  mới trong phase này (endpoint create/delete vẫn tồn tại cho đủ REST convention, đã test qua HTTP
  trực tiếp bằng Admin token).
- Không có mark-as-unread (true→false) UI — đúng hiện trạng, không tự thêm.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
