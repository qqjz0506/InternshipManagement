# API PHASE 2A — Departments / Students / Lecturers

Base URL: `http://localhost:5000/api`

Kiến trúc: `Route → Controller → Service → Database` (`mysql2/promise`, parameterized query, không dùng ORM). Toàn bộ response theo format thống nhất:

```json
// Success
{ "success": true, "message": "...", "data": {} }

// Error
{ "success": false, "message": "...", "error": "... (chỉ xuất hiện khi NODE_ENV != production)" }
```

---

## 1. Departments — `/api/departments`

Schema thực tế (đã cập nhật `docs/DATABASE_DESIGN.md` — xem "Correction log"): `id, department_code (UNIQUE), department_name, description (nullable), created_at, updated_at`.

### `GET /api/departments`
Query params: `search` (optional) — khớp `department_code` hoặc `department_name` (LIKE, không phân biệt hoa thường theo collation `utf8mb4_unicode_ci`).

```
GET /api/departments?search=CNTT
```
Response `200`:
```json
{
  "success": true,
  "message": "Departments retrieved successfully",
  "data": [
    { "id": 1, "department_code": "CNTT", "department_name": "Công nghệ thông tin", "description": null, "created_at": "2026-09-30 02:48:32", "updated_at": "2026-09-30 02:48:32" }
  ]
}
```
Không phân trang (đúng frontend hiện tại phân trang phía client, không cần server-side).

### `GET /api/departments/:id`
- `200` — trả record.
- `400` — `id` không phải số nguyên dương.
- `404` — `{ "success": false, "message": "Department not found" }`.

### `POST /api/departments`
Body:
```json
{ "department_code": "CNTT", "department_name": "Công nghệ thông tin", "description": "Mô tả (optional)" }
```
- `201` — tạo thành công, trả record vừa tạo (kèm `id` mới).
- `400` — thiếu `department_code` hoặc `department_name`.
- `409` — `department_code` đã tồn tại: `{ "message": "Mã khoa đã tồn tại." }`.

### `PUT /api/departments/:id`
Body giống POST. Không cho sửa `id`.
- `200` — cập nhật thành công.
- `400` — thiếu field bắt buộc / id không hợp lệ.
- `404` — không tìm thấy department.
- `409` — đổi `department_code` trùng với department khác.

### `DELETE /api/departments/:id`
- `200` — xóa thành công (không còn Student/Lecturer nào tham chiếu).
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa khoa/bộ môn đang có Sinh viên hoặc Giảng viên thuộc về." }` — kiểm tra chủ động (`COUNT` trên `students`/`lecturers`) **trước** khi DELETE, cộng thêm `ON DELETE RESTRICT` ở DB làm lớp bảo vệ thứ hai (bắt lỗi errno 1451 nếu có).

---

## 2. Students — `/api/students`

Schema thực tế: `id, user_id (nullable, UNIQUE), student_code (UNIQUE), full_name, gender ENUM('Nam','Nữ','Khác'), date_of_birth, phone, email, address, department_id (FK), major, class, status ENUM('active','inactive'), created_at, updated_at`.

### `GET /api/students`
Query params (tất cả optional, kết hợp AND):
- `search` — khớp `student_code` HOẶC `full_name` HOẶC `email` (đúng search hiện tại của `StudentsPage.jsx`)
- `department_id` — lọc theo khoa
- `status` — `active` | `inactive`

```
GET /api/students?search=Nguyễn&department_id=1&status=active
```
Response `200`: `data` là mảng student.

### `GET /api/students/:id`
`200` / `400` (id sai định dạng) / `404` (`Student not found`).

### `POST /api/students`
Body:
```json
{
  "student_code": "21110099",
  "full_name": "Nguyễn Văn A",
  "gender": "Nam",
  "date_of_birth": "2003-01-01",
  "phone": "0901234567",
  "email": "a@student.edu.vn",
  "address": "Hà Nội",
  "department_id": 1,
  "major": "Công nghệ thông tin",
  "class": "DHKTPM17A",
  "status": "active",
  "user_id": null
}
```
Required: `student_code`, `full_name`, `email` (đúng format), `department_id` (phải tồn tại). `gender`/`status` optional nhưng nếu gửi phải đúng 1 trong các giá trị ENUM. `user_id` optional — **frontend hiện tại không có input này trong form** (đúng mục 11 của yêu cầu — không bắt buộc FE gửi), nhưng API vẫn chấp nhận và validate nếu có.

- `201` — tạo thành công.
- `400` — thiếu field bắt buộc / email sai định dạng / phone sai định dạng / `department_id` không tồn tại / `user_id` không tồn tại / `gender`, `status` sai enum.
- `409` — `student_code` trùng, hoặc `user_id` đã được liên kết với student khác.

### `PUT /api/students/:id`
Body giống POST. Không cho sửa `id`. Validate giống POST (trừ so trùng `student_code` sẽ loại trừ chính bản ghi đang sửa).
- `200` / `400` / `404` / `409` (trùng `student_code`, hoặc `user_id` đã thuộc student khác).

### `DELETE /api/students/:id`
- `200` — xóa thành công.
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa sinh viên đang có Hồ sơ thực tập." }` (kiểm tra `internships.student_id`, cộng `ON DELETE RESTRICT` ở DB).

---

## 3. Lecturers — `/api/lecturers`

Schema thực tế: `id, user_id (nullable, UNIQUE), lecturer_code (UNIQUE), full_name, email, phone, department_id (FK), position, status ENUM('active','inactive'), created_at, updated_at`.

### `GET /api/lecturers`
Query params: `search` (khớp `lecturer_code`/`full_name`/`email`), `department_id`, `status`.

### `GET /api/lecturers/:id`
`200` / `400` / `404` (`Lecturer not found`).

### `POST /api/lecturers`
Body:
```json
{
  "lecturer_code": "GV099",
  "full_name": "Nguyễn Văn B",
  "email": "b@edu.vn",
  "phone": "0911112222",
  "department_id": 1,
  "position": "Giảng viên",
  "status": "active",
  "user_id": null
}
```
Required: `lecturer_code`, `full_name`, `email` (đúng format), `department_id` (phải tồn tại). `user_id` optional, validate như Students.
- `201` / `400` (thiếu field, email/phone sai format, `department_id`/`user_id` không tồn tại, `status` sai enum) / `409` (`lecturer_code` trùng, hoặc `user_id` đã liên kết lecturer khác).

### `PUT /api/lecturers/:id`
Giống POST, không cho sửa `id`.
- `200` / `400` / `404` / `409`.

### `DELETE /api/lecturers/:id`
- `200` — xóa thành công.
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa giảng viên đang được phân công cho Hồ sơ thực tập." }` (kiểm tra `internships.lecturer_id`, cộng `ON DELETE RESTRICT`).

---

## Ghi chú chung

- Mọi query đều dùng `pool.execute(sql, params)` (prepared statement, tham số hóa) — không nối chuỗi trực tiếp từ `req.query`/`req.body` vào SQL.
- Không có transaction trong phase này — mỗi request chỉ động vào đúng 1 bảng chính (đúng mục 9 của yêu cầu, chưa có thao tác đa bảng).
- `error` field trong response lỗi chỉ xuất hiện khi `NODE_ENV !== 'production'` (kế thừa `errorHandler.js` từ Phase 1) — production sẽ không có field này.
- Không có endpoint nào trong phase này đụng tới `Companies`, `CompanyMentors`, `Internships`, JWT/Authentication.
