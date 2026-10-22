# API PHASE 2F — Evaluations / Notifications / Settings

Base URL: `http://localhost:5000/api`

**Mismatch check**: đối chiếu `LecturerEvaluationForm.jsx`, `CompanyEvaluationForm.jsx`, `AdminEvaluationsPage.jsx`, `AdminEvaluationDetailPage.jsx`, `StudentEvaluationsPage.jsx`, `LecturerEvaluationsPage.jsx`, `StudentNotificationsPage.jsx` (+ Lecturer/Company tương đương), `AdminSettingsPage.jsx`, `SettingsContext.jsx` với `docs/DATABASE_DESIGN.md`/`schema.sql` — **không phát hiện mismatch nào**. **Schema changes: None. Migration: None.**

Sau phase này, **toàn bộ 14 bảng đã có backend API tương ứng.**

---

## Quyết định thiết kế quan trọng

### Evaluations
1. **Khóa sửa điểm/nhận xét khi `is_published = true`** (đúng `disabled={isPublished}` ở cả 2 Form) — enforce `409`.
2. **`is_published` cho phép đổi CẢ 2 CHIỀU** qua API: Lecturer/Company chỉ publish (1 chiều), nhưng Admin (`AdminEvaluationDetailPage.jsx`) unpublish được — đây là rule phụ thuộc vai trò, chưa có Auth/RBAC nên **không thể phân biệt** ai đang gọi. API cho phép năng lực rộng nhất hiện có (Admin: cả 2 chiều), publish/unpublish luôn tự đồng bộ `published_at`. Sẽ cần thu hẹp lại khi có Auth/RBAC.
3. **Tạo mới chỉ khi Internship đang `in_progress` hoặc `completed`** (đúng `canEvaluate` trong `LecturerEvaluationsPage.jsx`/`CompanyEvaluationsPage.jsx`) — rule khách quan theo state Internship, không phải role-based → enforce `409`.
4. **Không có kiểm tra "Internship phải có lecturer_id/company_mentor_id"** trước khi tạo evaluation — Frontend không có rule này (evaluator name hiển thị "Chưa xác định" nếu thiếu), nên **không tự thêm**.
5. **Không có UI xóa Evaluation** — endpoint `DELETE` cung cấp cho đủ REST convention, không rule khóa.
6. `is_published`/`published_at` không set được lúc tạo — luôn `false`/`null`.

### Notifications
1. **Không có UI tạo/xóa Notification** — 2 endpoint này cung cấp cho đủ REST convention (schema/CRUD hoàn chỉnh), **không tự động sinh từ resource khác** (đúng yêu cầu, không event engine).
2. **`user_id`/`title`/`content`/`type` immutable sau khi tạo** — hành động thật duy nhất là "mark as read" (`updateItem(id, {is_read: true})`), nên `PUT` chỉ chấp nhận field `is_read`.
3. Không có endpoint `PATCH /:id/read` riêng — Frontend dùng đúng `updateItem` chung (partial update 1 field), nên dùng `PUT /api/notifications/:id` với body `{"is_read": true}` là đủ, không tạo endpoint dư thừa.
4. "Đánh dấu tất cả đã đọc" chỉ là vòng lặp gọi `updateItem` từng cái ở Frontend — không có bulk-endpoint tương ứng cần tạo.

### Settings
1. **`GET /api/settings` + `PUT /api/settings`** (không có id trong URL, không có POST/DELETE) — đúng single-row config, khớp `useSettings()` (không có khái niệm id ở Frontend).
2. **PUT nhận toàn bộ object** (không phải partial merge) — đúng `updateSettings(draft)` luôn gửi cả object.
3. **Field names giữ nguyên camelCase** (`systemName`, `systemDescription`, `defaultInternshipPeriodId`, `allowStudentRegistration`) thay vì snake_case như các resource khác — đây là ngoại lệ có chủ đích vì `SettingsContext.jsx` là object JS thuần (không phải bản ghi bảng thô như mọi entity khác), khớp chính xác shape `draft` mà Frontend đang dùng.
4. **`FRONTEND_VERSION` không phải là field của Settings** — không có cột DB tương ứng, gửi field này (hoặc `version`) trong PUT → `400` rõ ràng, không silently ignore.
5. **`id` immutable** — gửi trong PUT → `400`.

---

## 1. Evaluations — `/api/evaluations`

### `GET /api/evaluations`
Query params: `internship_id`, `evaluator_role`, `is_published` — đúng field thật dùng để lọc/tra cứu evaluation trong Frontend.

### `POST /api/evaluations`
```json
{ "internship_id": 7, "evaluator_role": "lecturer", "attitude_score": 8, "skill_score": 7.5, "progress_score": 8, "discipline_score": 9, "overall_score": 8.1, "comment": "..." }
```
- 5 điểm bắt buộc, mỗi điểm 0-10; `internship_id` tồn tại + status `in_progress`/`completed`; UNIQUE(`internship_id`,`evaluator_role`).
- `201` / `400` (thiếu điểm, sai range, sai `evaluator_role`, internship không tồn tại) / `409` (trùng, hoặc internship chưa đúng status).

### `PUT /api/evaluations/:id` (partial)
`internship_id`/`evaluator_role` immutable (`400`). Điểm/`comment` khóa khi `is_published=true` (`409`). `is_published` đổi tự do 2 chiều, tự đồng bộ `published_at`.

### `DELETE /api/evaluations/:id`
`200`/`404`, không giới hạn.

---

## 2. Notifications — `/api/notifications`

### `GET /api/notifications?user_id=`
### `POST /api/notifications` — `user_id` phải tồn tại, `type` đúng 1 trong 6 giá trị ENUM.
### `PUT /api/notifications/:id` — chỉ nhận `is_read`; field khác → `400` immutable.
### `DELETE /api/notifications/:id` — không giới hạn.

---

## 3. Settings — `/api/settings`

### `GET /api/settings` → trả nguyên object cấu hình (1 dòng duy nhất, `id=1`).
### `PUT /api/settings`
```json
{ "systemName": "...", "systemDescription": "...", "defaultInternshipPeriodId": 2, "allowStudentRegistration": true }
```
- `systemName` bắt buộc non-empty (khớp `NOT NULL` của DB). `defaultInternshipPeriodId`: `null` hợp lệ, hoặc phải tồn tại trong `internship_periods` (`400` nếu không). `allowStudentRegistration` phải là boolean.
- Gửi `id`/`version`/`FRONTEND_VERSION`/`frontend_version` → `400`.
- `200` / `400`.

---

## FK & Cascade
`evaluations.internship_id → internships.id` (`CASCADE`, đã duyệt) — chưa cần test riêng vì Phase 2D/2E đã test cascade tương tự trên cùng internship; `notifications.user_id → users.id` (`CASCADE`) — validate tồn tại khi tạo; `settings.default_internship_period_id → internship_periods.id` (`SET NULL`, đã duyệt, không đổi).

## HTTP tests — PASS toàn bộ
Evaluations: GET/POST(lecturer+company valid, missing score, invalid internship_id/role, score <0/>10, internship sai status, duplicate)/PUT(immutable, khóa khi published, publish/unpublish, sửa lại sau unpublish)/DELETE — **PASS**.
Notifications: GET/POST(invalid user_id, invalid type, valid)/PUT(mark-read, immutable field)/DELETE — **PASS**. (1 lỗi test-methodology tự phát hiện: gửi tiếng Việt qua `curl -d` inline bị lỗi encoding do Windows/Bash argv — không phải lỗi backend, đã xác nhận lại bằng file thì đúng, đã dọn record lỗi.)
Settings: GET, PUT(valid, invalid boolean, invalid FK period, gửi `id`, gửi `FRONTEND_VERSION`, GET-sau-PUT khớp dữ liệu, khôi phục về giá trị gốc) — **PASS**.

## Regression Phase 2A→2E
Health, Departments, Students, Lecturers, Companies, Company Mentors, Internship Periods, Topics, Internships, Internship Logs, Reports — **PASS** toàn bộ.

## Data integrity
14/14 bảng đúng row count gốc (users 10, departments 4, students 14, lecturers 10, companies 10, company_mentors 7, internship_periods 3, topics 10, internships 12, internship_logs 3, reports 2, evaluations 2, notifications 13, settings 1). 19/19 FK nguyên vẹn. 2 evaluation seed gốc đối chiếu khớp 100%. Settings khôi phục đúng giá trị ban đầu, luôn đúng 1 dòng `id=1`.
