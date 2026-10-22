# API PHASE 2E — Internship Logs / Reports

Base URL: `http://localhost:5000/api`

**Mismatch check**: đối chiếu toàn bộ `LogFormModal.jsx`, `LecturerLogReviewModal.jsx`, `CompanyLogCommentModal.jsx`, `StudentLogsPage.jsx`, `LecturerLogsPage.jsx`, `ReportFormModal.jsx`, `LecturerReportReviewModal.jsx`, `CompanyReportCommentModal.jsx`, `StudentReportsPage.jsx`, `AdminReportsPage.jsx`, `AdminReportDetailPage.jsx` với `docs/DATABASE_DESIGN.md`/`schema.sql` — **không phát hiện mismatch nào**. **Schema changes: None. Migration: None.**

---

## Quyết định thiết kế quan trọng

### Internship Logs
1. **3 điểm update độc lập, không có form "sửa tất cả"**: Student sửa nội dung (khi chưa `reviewed`), Lecturer nhận xét + chuyển `reviewed`, Company chỉ thêm `company_comment`. → `PUT` là **partial update**, giống hệt cách tiếp cận đã dùng cho Internships ở Phase 2D.
2. **Khóa nội dung khi `status = 'reviewed'`** (đúng `isLocked` trong `StudentLogsPage.jsx`): áp dụng cho `log_date/title/content/result/difficulties/next_plan/note/progress/attachment`. **Không khóa** `lecturer_comment`/`company_comment` — bằng chứng: log seed `id=1` đã `reviewed` nhưng vẫn có cả `lecturer_comment` lẫn `company_comment`, và `LecturerLogReviewModal` cho phép "Sửa nhận xét" ngay cả khi đã reviewed.
3. **Chuyển trạng thái 1 chiều `submitted → reviewed`**: không có UI nào "un-review". Cho phép gửi lại `status: 'reviewed'` khi đã reviewed (no-op, đúng nút "Xem / Sửa nhận xét" cho lưu lại nhận xét), nhưng chặn `reviewed → submitted`.
4. **Tạo log chỉ khi Internship đang `in_progress`** (đúng `canAddLog` trong `StudentLogsPage.jsx`) — đây là rule khách quan dựa trên state của Internship liên quan (không phải role-based), nên được enforce ở API: `409` nếu Internship không ở `in_progress`.
5. **Xóa chỉ khi chưa `reviewed`** (đúng nút Xóa biến mất khi `isLocked`) — objective state rule, enforce `409` nếu đã `reviewed`.
6. Field `status`/`lecturer_comment`/`company_comment` **không set được lúc tạo** — luôn `submitted`/`null`/`null`, gửi giá trị khác → `400` (nhất quán với cách xử lý Internships sau lần sửa Phase 2D).

### Reports
1. **2 điểm update độc lập**: Lecturer/Admin đổi `status` + `reviewer_comment`; Company chỉ thêm `company_comment`. → `PUT` cũng là partial update.
2. **`report_type`/`file_name`/`submitted_at`/`internship_id` immutable sau khi tạo** — không có UI nào sửa các field này.
3. **`status` chỉ nhận 1 trong 3 giá trị `submitted/approved/rejected`** (đúng `LECTURER_SELECTABLE_STATUSES`/`ADMIN_SELECTABLE_STATUSES`) — **không** có transition map như Internship (chọn tự do trong 3 giá trị, không phụ thuộc status hiện tại). `draft` tồn tại trong ENUM (Database Design) nhưng không có UI nào set được, kể cả lúc tạo.
4. **Không có gate theo status Internship** khi tạo report (khác Logs) — `StudentReportsPage.jsx` không kiểm tra `internship.status`.
5. **Không có rule khóa edit/delete nào theo status** — khác Logs, Report luôn có thể review/comment lại.
6. **Không có UI xóa Report ở bất kỳ vai trò nào** (Admin/Lecturer/Company/Student) — endpoint `DELETE` vẫn được cung cấp cho đủ REST convention, không có business rule chặn (đã test, hoạt động không giới hạn).

### Về rule phụ thuộc vai trò (chưa có Auth/RBAC)
"Ai được sửa field nào" (Student/Lecturer/Company) là role-based và **không được enforce** ở phase này — API chấp nhận field của cả 3 nhóm trên cùng 1 endpoint PUT, đúng hướng dẫn "không tự giả lập role". Sẽ cần bổ sung ở phase Auth/RBAC.

---

## 1. Internship Logs — `/api/internship-logs`

### `GET /api/internship-logs?internship_id=`
Chỉ hỗ trợ filter `internship_id` — đúng duy nhất pattern thật của mọi trang đang dùng (`StudentLogsPage`/`LecturerLogsPage` đều lọc theo tập `internship_id`, không có search/status filter nào trên UI).

### `GET /api/internship-logs/:id`
`200` / `400` / `404`.

### `POST /api/internship-logs`
```json
{ "internship_id": 1, "log_date": "2026-02-01", "title": "...", "content": "...", "result": "...", "difficulties": "...", "next_plan": "...", "note": "...", "progress": 10 }
```
Required: `internship_id` (tồn tại + Internship phải `in_progress`), `log_date` (format), `title`, `content`. Optional: `result/difficulties/next_plan/note/attachment` (text), `progress` (0-100, mặc định 0). `status`/`lecturer_comment`/`company_comment` không set được.
- `201` / `400` (thiếu field, internship không tồn tại, progress sai range, status khác 'submitted') / `409` (Internship không `in_progress`).

### `PUT /api/internship-logs/:id` (partial)
- `internship_id`: immutable → `400`.
- Field nội dung (`log_date/title/content/result/difficulties/next_plan/note/progress/attachment`): chặn nếu log hiện tại `status='reviewed'` → `409`.
- `status`: chỉ nhận `'reviewed'` (từ `submitted` hoặc `reviewed`); `'submitted'` khi đang `reviewed` → `409`.
- `lecturer_comment`, `company_comment`: luôn cho phép, không phụ thuộc status.
- `200` / `400` / `404` / `409`.

### `DELETE /api/internship-logs/:id`
`200` (khi `status != 'reviewed'`) / `404` / `409` (khi đã `reviewed`).

---

## 2. Reports — `/api/reports`

### `GET /api/reports`
Query params (đúng `AdminReportsPage.jsx`): `internship_id`, `status`, `search` (student_code/full_name/company_name qua JOIN `internships`+`students`+`companies`), `lecturer_id`, `company_id`, `period_id` (qua JOIN `internships`).

### `GET /api/reports/:id`
`200` / `400` / `404`.

### `POST /api/reports`
```json
{ "internship_id": 1, "report_type": "weekly", "file_name": "bao-cao-tuan-1.pdf" }
```
Required: `internship_id` (tồn tại, không gate theo status), `report_type` (enum `weekly`/`final`), `file_name`. `submitted_at` do server tự sinh (ngày hiện tại) — gửi field này → `400`. `status`/`reviewer_comment`/`company_comment` không set được lúc tạo.
- `201` / `400` (thiếu field, internship không tồn tại, report_type sai enum, gửi `submitted_at`, status khác 'submitted').

### `PUT /api/reports/:id` (partial)
- `internship_id`/`report_type`/`file_name`/`submitted_at`: immutable → `400`.
- `status`: chỉ nhận 1 trong `submitted/approved/rejected` (không `draft`, không transition map) → `400` nếu sai.
- `reviewer_comment`, `company_comment`: luôn cho phép.
- `200` / `400` / `404`.

### `DELETE /api/reports/:id`
`200` / `404` — không có business rule chặn (chưa có UI nào cần xóa Report).

---

## FK & Cascade
`internship_logs.internship_id` / `reports.internship_id` → `internships.id`, `ON DELETE CASCADE` (giữ nguyên, đã duyệt). Đã test thực tế: tạo Internship + 1 log + 1 report, xóa Internship qua `DELETE /api/internships/:id`, xác nhận cả log lẫn report bị xóa theo, không sót lại.

## HTTP tests — tóm tắt (đầy đủ ở trên)
Toàn bộ chạy qua HTTP thật: GET list/detail/404, POST valid + mọi validation (required/FK/enum/range/status-not-settable), PUT partial + business rule (lock nội dung khi reviewed, one-way transition, immutable field), DELETE + lock rule (Logs) / không giới hạn (Reports), CASCADE test — **tất cả PASS**.

## Regression Phase 2A/2B/2C/2D
Health, Departments, Students, Lecturers, Companies, Company Mentors, Internship Periods, Topics, Internships (GET + status-transition + delete-rule) — **tất cả PASS**, không resource nào bị ảnh hưởng.

## Data integrity
14/14 bảng đúng row count gốc, 19/19 FK nguyên vẹn, 3 `internship_logs` + 2 `reports` + 12 `internships` seed gốc đối chiếu khớp 100%, không sót test data.
