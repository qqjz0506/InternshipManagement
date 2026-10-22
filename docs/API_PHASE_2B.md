# API PHASE 2B — Companies / Company Mentors

Base URL: `http://localhost:5000/api`

Kiến trúc và response format giữ nguyên như Phase 2A (`Route → Controller → Service → Database`, `pool.execute` tham số hóa, không ORM).

---

## 1. Companies — `/api/companies`

Schema: `id, company_code (UNIQUE), company_name, tax_code (UNIQUE), address, phone, email, website, representative, status ENUM('active','inactive'), created_at, updated_at`.

### `GET /api/companies`
Query params: `search` (khớp `company_code`/`company_name`/`tax_code`, đúng `CompaniesPage.jsx`), `status`.
```
GET /api/companies?search=FPT&status=active
```

### `GET /api/companies/:id`
`200` / `400` (id sai) / `404` (`Company not found`). Không JOIN — trả nguyên bảng `companies`, đúng convention Phase 2A (Students/Lecturers cũng không JOIN `department_name`).

### `POST /api/companies`
Body (khớp đúng `CompanyFormModal.jsx`):
```json
{
  "company_code": "DN099", "company_name": "Công ty ABC", "tax_code": "0101234567",
  "address": "Hà Nội", "phone": "0241234567", "email": "contact@abc.vn",
  "website": "https://abc.vn", "representative": "Nguyễn Văn A", "status": "active"
}
```
Required: `company_code`, `company_name`, `tax_code`, **`address`** (form bắt buộc dù cột DB nullable). `email`/`phone` chỉ validate format nếu có nhập.
- `201` / `400` (thiếu field bắt buộc, email/phone sai format) / `409` (`company_code` hoặc `tax_code` trùng — kiểm tra độc lập, báo đúng field nào trùng).

### `PUT /api/companies/:id`
Body giống POST, không cho sửa `id`. `200` / `400` / `404` / `409`.

### `DELETE /api/companies/:id`
- `200` — xóa được khi không có Company Mentor hoặc Internship nào tham chiếu.
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa doanh nghiệp đang có Người hướng dẫn hoặc Hồ sơ thực tập liên quan." }` (kiểm tra chủ động `company_mentors.company_id` VÀ `internships.company_id`, cộng `ON DELETE RESTRICT` ở DB làm lớp cuối). **Không cascade.**

---

## 2. Company Mentors — `/api/company-mentors`

Schema: `id, user_id (nullable, UNIQUE), company_id (FK), full_name, email (UNIQUE), phone, position, status ENUM('active','inactive'), created_at, updated_at`.

### `GET /api/company-mentors`
Query params: `search` (khớp `full_name`/`email`, đúng `CompanyMentorsPage.jsx`), `company_id` (đúng filter "Doanh nghiệp" trên trang).

### `GET /api/company-mentors/:id`
`200` / `400` / `404` (`Company mentor not found`). Không JOIN company_name/user email — client tự resolve qua `GET /api/companies/:id`, đúng convention Phase 2A.

### `POST /api/company-mentors`
Body (khớp đúng `CompanyMentorFormModal.jsx` — **không có input `user_id`** trong form, nhưng API vẫn nhận nếu gửi):
```json
{ "full_name": "Trần Văn A", "email": "a@company.vn", "phone": "0900000000", "company_id": 1, "position": "Trưởng nhóm", "status": "active" }
```
Required: `full_name`, `email` (đúng format), `company_id` (phải tồn tại). Không có field code — `email` là định danh unique duy nhất (đúng thiết kế, không có `mentor_code`).
- `201` / `400` (thiếu field, email/phone sai format, `company_id` không tồn tại, `user_id` không tồn tại nếu có gửi) / `409` (`email` trùng, hoặc `user_id` đã liên kết mentor khác).
- Không tự tạo `users` — Admin phải tạo/liên kết tài khoản riêng (ngoài phạm vi API này).

### `PUT /api/company-mentors/:id`
Body giống POST.

**Behavior đặc biệt khi đổi `company_id`** (đúng business rule đã duyệt ở `docs/DATABASE_DESIGN.md` mục H.14, khớp `CompanyMentorsPage.jsx` hiện tại): nếu `company_id` mới khác `company_id` cũ, mọi `Internship` đang có `company_mentor_id` = mentor này sẽ bị **gỡ phân công** (`company_mentor_id = NULL`) — thực hiện trong 1 **transaction** (UPDATE `company_mentors` + UPDATE `internships` cùng commit/rollback). Response trả về số hồ sơ bị ảnh hưởng qua `message`:
```json
{ "success": true, "message": "Company mentor updated successfully. Đã gỡ phân công khỏi 1 hồ sơ thực tập do đổi doanh nghiệp.", "data": { ... } }
```
Nếu `company_id` không đổi, `message` không có ghi chú này. **Không tự ý cascade update `internships.company_id`** — chỉ gỡ `company_mentor_id`, đúng phạm vi nghiệp vụ đã duyệt.

- `200` / `400` / `404` / `409` (email trùng, `company_id` không tồn tại, `user_id` không tồn tại/đã bị chiếm).

### `DELETE /api/company-mentors/:id`
- `200` — xóa được khi không có Internship nào tham chiếu. Nếu mentor có `user_id`, **KHÔNG đụng đến bảng `users`** — tài khoản liên kết vẫn nguyên vẹn 100% (đã test thực tế: xóa mentor có `user_id` xong, `users` row tương ứng không đổi 1 byte nào, tổng số `users` không đổi).
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa người hướng dẫn đang được phân công cho hồ sơ thực tập." }` (kiểm tra `internships.company_mentor_id`, cộng `ON DELETE RESTRICT`). **Không cascade.**

---

## Ghi chú chung

- Cả 2 resource đều dùng `pool.execute(sql, params)` — tham số hóa 100%, không nối chuỗi.
- Transaction chỉ dùng đúng 1 chỗ (Company Mentor update khi đổi `company_id`) vì đây là thao tác đa bảng duy nhất trong phase này — không tạo transaction thừa cho các thao tác 1-bảng khác.
- Không có endpoint nào đụng tới Internships/Periods/Topics/Reports/Evaluations/Notifications/Settings/JWT trong phase này.
