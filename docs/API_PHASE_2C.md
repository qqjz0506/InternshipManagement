# API PHASE 2C — Internship Periods / Topics

Base URL: `http://localhost:5000/api`

Kiến trúc và response format giữ nguyên như Phase 2A/2B (`Route → Controller → Service → Database`, `pool.execute` tham số hóa, không ORM, `charset: 'utf8mb4'`).

**Schema changes**: có 1 thay đổi (`internship_periods.description`) — xem mục cuối.
**Migration**: 1 `ALTER TABLE` an toàn, không mất dữ liệu — xem mục cuối.

---

## 1. Internship Periods — `/api/internship-periods`

Schema thực tế (đã cập nhật): `id, period_code (UNIQUE), period_name, start_date, end_date, status ENUM('upcoming','ongoing','closed'), description (nullable), created_at, updated_at`.

### `GET /api/internship-periods`
Query params: `search` (khớp `period_code`/`period_name`, đúng `InternshipPeriodsPage.jsx`), `status`.
```
GET /api/internship-periods?search=TT2024&status=ongoing
```

### `GET /api/internship-periods/:id`
`200` / `400` (id sai) / `404` (`Internship period not found`).

### `POST /api/internship-periods`
Body (khớp đúng `PeriodFormModal.jsx`):
```json
{
  "period_code": "TT2025-2", "period_name": "Đợt thực tập HK2 2025-2026",
  "start_date": "2026-02-01", "end_date": "2026-06-15", "status": "upcoming",
  "description": "Mô tả (optional)"
}
```
Required: `period_code`, `period_name`, `start_date`, `end_date` (đúng format `YYYY-MM-DD`). Validate `start_date <= end_date` (đúng logic `PeriodFormModal` — chỉ lỗi khi `start_date > end_date`). `status` optional, enum nếu có. `description` optional.
- `201` / `400` (thiếu field, ngày sai format, ngày kết thúc trước ngày bắt đầu, status sai enum) / `409` (`period_code` trùng).

### `PUT /api/internship-periods/:id`
Body giống POST, không cho sửa `id`. `200` / `400` / `404` / `409`.

### `DELETE /api/internship-periods/:id`
- `200` — xóa được khi không có Internship nào dùng đợt này.
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa đợt thực tập đang có Hồ sơ thực tập sử dụng." }` (kiểm tra `internships.period_id`, cộng `ON DELETE RESTRICT`). **Không cascade.**
  - Lưu ý: `settings.default_internship_period_id` trỏ tới bảng này với `ON DELETE SET NULL` (con trỏ cấu hình mềm) — không kiểm tra/chặn theo tham chiếu này, đúng thiết kế đã duyệt.

---

## 2. Topics — `/api/topics`

Schema: `id, topic_code (UNIQUE), topic_name, description (nullable), suggested_by_student_id (nullable FK→students), company_id (nullable FK→companies), status ENUM('proposed','approved','rejected'), created_at, updated_at`.

### `GET /api/topics`
Query params: `search` (khớp `topic_code`/`topic_name`, đúng `TopicsPage.jsx`), `status`.

### `GET /api/topics/:id`
`200` / `400` / `404` (`Topic not found`). Không JOIN tên sinh viên/doanh nghiệp — client tự resolve, đúng convention các phase trước.

### `POST /api/topics`
Body (khớp đúng `TopicFormModal.jsx`):
```json
{
  "topic_code": "DT099", "topic_name": "Đề tài mới",
  "description": "Mô tả (optional)",
  "suggested_by_student_id": null, "company_id": null,
  "status": "proposed"
}
```
Required: `topic_code`, `topic_name`. `suggested_by_student_id`/`company_id` optional, validate tồn tại nếu có gửi. **Không ràng buộc loại trừ lẫn nhau** giữa 2 field này — đúng quyết định đã có ở `docs/DATABASE_DESIGN.md` mục I.4, đã test thực tế: gửi cả 2 cùng lúc vẫn được `201` bình thường.
- `201` / `400` (thiếu field, `suggested_by_student_id`/`company_id` không tồn tại, status sai enum) / `409` (`topic_code` trùng).

### `PUT /api/topics/:id`
Body giống POST, không cho sửa `id`. `200` / `400` (kể cả khi đổi FK sang giá trị không tồn tại) / `404` / `409`.

### `DELETE /api/topics/:id`
- `200` — xóa được khi không có Internship nào dùng đề tài này.
- `404` — không tìm thấy.
- `409` — `{ "message": "Không thể xóa đề tài đang được Hồ sơ thực tập sử dụng." }` (kiểm tra `internships.topic_id`, cộng `ON DELETE RESTRICT`). **Không cascade.**

---

## Schema change phát hiện trong phase này

**`internship_periods.description`** (TEXT NULL) — có trong `PeriodFormModal.jsx` (field CRUD thật, `addItem`/`updateItem` lưu vào Context state) nhưng bị bỏ sót ở Database Design ban đầu (chỉ đọc `data/internshipPeriods.js`, chưa đọc form modal) — cùng pattern với `departments.description` ở Phase 2A. Đã:
1. Cập nhật `docs/DATABASE_DESIGN.md` (bảng chi tiết, ERD, SQL schema, correction log).
2. Cập nhật `server/db/schema.sql`, `server/db/seed.sql` (3 record seed để `description = NULL`).
3. Chạy `ALTER TABLE internship_periods ADD COLUMN description TEXT NULL AFTER status;` lên DB đang chạy — **không mất dữ liệu**, verify bằng `DESCRIBE`/`SHOW CREATE TABLE` (UNIQUE/INDEX nguyên vẹn), row count vẫn 3, `description` nhận `NULL` đúng.
4. API hỗ trợ đầy đủ `description` ở GET/POST/PUT, không silently bỏ field.

`topics` không có schema change nào — đối chiếu Form/Page không phát hiện mismatch.

---

## Test summary
```
Internship Periods CRUD:  PASS (list/detail/404/create/update/delete + search/filter + date validation)
Topics CRUD:               PASS (list/detail/404/create/update/delete + search/filter + FK validation
                                  + xác nhận KHÔNG chặn khi gửi cả 2 nguồn suggested_by_student_id/company_id)
Regression Phase 2A/2B:    PASS (health, departments, students, lecturers, companies, company-mentors)
Data integrity:            PASS (14/14 bảng đúng row count, 19/19 FK, HEX xác nhận không bị lỗi encoding)
```
