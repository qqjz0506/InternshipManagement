# API PHASE 3A — Authentication + JWT

## 1. Scope

Phase này chỉ xử lý **xác thực danh tính** (ai đang gọi API): password hashing, login, JWT access token, middleware xác thực, `GET /api/auth/me`, và cập nhật Frontend để đăng nhập/khôi phục session qua backend thật thay vì `MOCK_USERS`/localStorage-plaintext.

**Chưa làm RBAC** — token có `role` nhưng chưa route nào dùng `role` để chặn truy cập (để Phase 3B).

## 2. Authentication architecture

```
Route (public)      POST /api/auth/login
Route (protected)   GET  /api/auth/me   → requireAuth middleware
      ↓
Controller (authController.js) — validate input, gọi service, trả response
      ↓
Service (authService.js) — tìm user, so khớp bcrypt, ký JWT, tạo DTO an toàn
      ↓
mysql2/promise → bảng users (password_hash)
```

`requireAuth` (`server/middleware/authMiddleware.js`) verify JWT, tra lại user từ DB (đảm bảo user còn tồn tại), gắn `req.user` (DTO đã loại `password_hash`) — **không có `requireRole()`/`requirePermission()` ở phase này.**

## 3. Password hashing

- Thư viện: `bcryptjs` (cost factor 10).
- Cột `users.password` **đổi tên thành `users.password_hash`** (migration an toàn, không mất dữ liệu — xem mục Database changes trong báo cáo cuối).
- Toàn bộ 10 tài khoản seed đã chuyển sang bcrypt hash, password gốc KHÔNG còn tồn tại dạng plaintext ở bất kỳ đâu trong DB.

## 4. JWT configuration

```env
JWT_SECRET=<chuỗi ngẫu nhiên dài, lưu trong server/.env, KHÔNG commit>
JWT_EXPIRES_IN=1d
```
Payload tối thiểu: `{ sub: user.id, role: user.role }` — không chứa email, không chứa password/password_hash.

## 5. `POST /api/auth/login`

Request:
```json
{ "email": "student@example.com", "password": "student123" }
```
Response thành công (`200`):
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJ...",
    "user": { "id": 2, "fullName": "Nguyễn Minh Anh", "email": "student@example.com", "role": "student" }
  }
}
```
Lỗi: `400` (thiếu email/password, email sai format), `401` (email không tồn tại HOẶC sai password — luôn cùng 1 message chung `"Email hoặc mật khẩu không chính xác."` để tránh user enumeration).

## 6. `GET /api/auth/me`

Header bắt buộc: `Authorization: Bearer <accessToken>`.
Response (`200`):
```json
{ "success": true, "message": "Lấy thông tin tài khoản thành công", "data": { "id": 2, "fullName": "...", "email": "...", "role": "student" } }
```
Lỗi: `401` nếu thiếu header/sai định dạng, token invalid, token hết hạn, hoặc user không còn tồn tại trong DB.

## 7. Authorization header

Format bắt buộc: `Authorization: Bearer <token>` — thiếu tiền tố `Bearer ` bị coi là thiếu token (`401`).

## 8. Error responses

Dùng đúng `AppError`/`errorHandler` đã có từ Phase 2 — format thống nhất `{success:false, message, error?}`, không lộ stack trace ở production.

## 9. Test accounts (plaintext chỉ dùng để test thủ công, KHÔNG lưu plaintext trong DB)

| Email | Password | Role |
|---|---|---|
| admin@example.com | admin123 | admin |
| student@example.com / student2@example.com / student3@example.com / student4@example.com | student123 | student |
| lecturer@example.com / lecturer2@example.com | lecturer123 | lecturer |
| company@example.com / company2@example.com / company3@example.com | company123 | company_mentor |

## 10. Security notes

- Password không bao giờ được trả về ở bất kỳ response nào (login, me) — đã verify thực tế.
- JWT payload không chứa password/password_hash — đã decode verify thực tế.
- `JWT_SECRET` đọc từ `.env`, không hard-code trong source; `.env` đã có trong `.gitignore` từ Phase 1.
- Message lỗi đăng nhập tổng quát hóa, không phân biệt "email không tồn tại" và "sai mật khẩu".

## 11. Known limitations

- **RBAC chưa triển khai** — mọi API Phase 2 (Students/Internships/...) hiện vẫn **không yêu cầu token**, chưa được bảo vệ bởi `requireAuth`. Đây là phạm vi Phase 3B.
- **Data-level authorization chưa triển khai** (Student chỉ xem hồ sơ của mình, Lecturer chỉ xem sinh viên mình phụ trách, v.v.) — Phase 3B.
- **Refresh token chưa triển khai** — chỉ có access token, hết hạn sau `JWT_EXPIRES_IN` phải đăng nhập lại.
- **Logout chỉ clear token ở Frontend** (xóa khỏi `localStorage` + state) — JWT stateless, không có endpoint logout/blacklist ở backend.
- Frontend login/session-restore **chưa được xác minh qua trình duyệt thật** (môi trường không có browser tool) — chỉ xác minh qua: (a) toàn bộ luồng API thật qua HTTP, (b) đọc lại code `AuthContext.jsx`/`ProtectedRoute.jsx`/`LoginPage.jsx` để xác nhận logic khớp đúng response shape thật của backend, (c) `npm run build`/`npm run lint` sạch, (d) Vite dev server khởi động không lỗi runtime.

## 12. Phase 3B (pending)

`requireRole(...)`, `requirePermission(...)`, data-level authorization (student/lecturer/company_mentor chỉ thao tác đúng phạm vi của mình), áp JWT bảo vệ cho các route Phase 2A-2F.
