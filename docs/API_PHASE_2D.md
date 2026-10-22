# API PHASE 2D — Internships (entity trung tâm)

Base URL: `http://localhost:5000/api`

**Schema changes: None. Migration: None.** Đối chiếu toàn bộ Frontend (`InternshipsContext.jsx`, `InternshipsPage.jsx`, `InternshipCreateModal.jsx`, `InternshipDetailPage.jsx`, `AssignLecturerModal.jsx`, `AssignCompanyModal.jsx`, `AssignTopicModal.jsx`, `StudentInternshipPage.jsx`, `StudentInternshipRegisterModal.jsx`, `StudentProposeCompanyModal.jsx`) với `docs/DATABASE_DESIGN.md`/`schema.sql` — không phát hiện mismatch nào về field/enum/schema.

---

## Quyết định thiết kế quan trọng (đọc trước khi dùng API)

### 1. CREATE — `student_id` + `period_id` bắt buộc, các field khác OPTIONAL nhưng validate đầy đủ
`InternshipCreateModal.jsx` (Admin) và `StudentInternshipRegisterModal.jsx` (Student) gửi **cùng một shape request tối thiểu** (`{student_id, period_id}`) — không có ambiguity nào giữa 2 flow, nên **dùng chung 1 endpoint** `POST /api/internships`, không tách riêng.

**[Cập nhật sau review]**: `company_id`, `company_mentor_id`, `lecturer_id`, `topic_id`, `start_date`, `end_date`, `progress` là OPTIONAL — không gửi/gửi `null` thì giữ mặc định (`null`/`0`), nhưng nếu gửi kèm một giá trị thì **phải validate đầy đủ** giống hệt các rule ở PUT (FK tồn tại, company↔mentor consistency, date format + `start≤end`, `progress` 0-100) — **không còn silently bỏ qua giá trị sai**. Riêng `status`: hồ sơ luôn phải bắt đầu ở `'pending'` (business rule bảo vệ quy trình duyệt, đúng `addInternship()`) — gửi `status: 'pending'` thì được chấp nhận (no-op), gửi bất kỳ giá trị nào khác → `400`.

### 2. UPDATE — PUT là PARTIAL update (giống `updateInternship(id, changes)`), không phải full-replace
Không có form "sửa toàn bộ Internship" nào tồn tại. Thực tế Frontend có **5 điểm gọi update độc lập**, mỗi điểm chỉ đổi một nhóm field: đổi trạng thái (+ progress khi hoàn thành), sửa tiến độ, phân công giảng viên, phân công DN+mentor, chọn đề tài. Vì vậy `PUT /api/internships/:id` chỉ validate/ghi đè đúng field nào **có mặt** trong body — field vắng mặt giữ nguyên giá trị cũ. Đây không phải suy đoán — đây là hành vi thật của `InternshipsContext.updateInternship()`.

### 3. `student_id`/`period_id` là immutable sau khi tạo
Không có UI nào cho sửa 2 field này sau khi tạo hồ sơ. **[Cập nhật sau review]**: PUT gửi kèm field này — **bất kể giá trị** (kể cả gửi trùng giá trị hiện tại) — đều bị từ chối `400` với message nêu rõ field immutable, không còn silently no-op khi giá trị trùng khớp.

### 4. Rule không được enforce (chỉ là filter UI, không phải business rule cứng)
- **Giảng viên cùng khoa với sinh viên**: `AssignLecturerModal.jsx` chỉ *gợi ý* giảng viên cùng khoa (có checkbox "Hiển thị tất cả các khoa" để bỏ qua filter ngay trong modal) — không phải rule cứng, **API không chặn** chọn giảng viên khác khoa.
- **Đợt thực tập đã đóng (`status='closed'`)**: `StudentInternshipRegisterModal.jsx` chỉ ẩn các đợt đã đóng khỏi dropdown khi Student tự đăng ký, nhưng `InternshipCreateModal.jsx` (Admin) không có filter này. Vì Phase 2D chưa có Auth/RBAC nên API không thể phân biệt "ai đang gọi", và đây chỉ là filter hiển thị của 1 form chứ không phải rule ở tầng Context/DB — **API không chặn** tạo hồ sơ vào đợt đã đóng.
- **EDITABLE_STATUSES (`pending`/`approved`) cho Student tự đổi company/topic**: đây là rule chỉ áp dụng cho **Student**, thực hiện bằng cách ẩn nút trong `StudentInternshipPage.jsx` — Admin (`InternshipDetailPage.jsx`) không có rule này khi phân công company/mentor/topic. Vì chưa có Auth/RBAC để phân biệt vai trò người gọi, **API không enforce rule theo vai trò** trong phase này — hành vi API hiện tại khớp với quyền hạn rộng hơn (Admin).

---

## Endpoints

```
GET    /api/internships
GET    /api/internships/:id
POST   /api/internships
PUT    /api/internships/:id
DELETE /api/internships/:id
```

### `GET /api/internships`
Query params (đúng filter/search thật của `InternshipsPage.jsx`):
- `search` — khớp `students.student_code`/`students.full_name` (JOIN `students` chỉ để lọc, response vẫn là cột thô của `internships`, không thêm field JOIN vào output — đúng convention các phase trước).
- `status`, `period_id`, `company_id`, `lecturer_id`.

### `GET /api/internships/:id`
`200` / `400` (id sai) / `404` (`Internship not found`).

### `POST /api/internships`
Tối thiểu:
```json
{ "student_id": 3, "period_id": 3 }
```
Đầy đủ (mọi field ngoài `student_id`/`period_id` đều optional):
```json
{
  "student_id": 3, "period_id": 3,
  "company_id": 1, "company_mentor_id": 1, "lecturer_id": 2, "topic_id": 3,
  "start_date": "2026-01-01", "end_date": "2026-06-01", "progress": 15
}
```
- `student_id`/`period_id`: bắt buộc, phải tồn tại, **UNIQUE(student_id, period_id)**.
- `company_id`/`lecturer_id`/`topic_id`/`company_mentor_id`: nếu gửi (khác `null`) phải tồn tại; `company_mentor_id` còn phải thuộc đúng `company_id` gửi kèm (không có `company_id` mà vẫn gửi `company_mentor_id` → `400`).
- `start_date`/`end_date`: format `YYYY-MM-DD`, nếu cả 2 có mặt thì `start_date ≤ end_date`.
- `progress`: 0–100 nếu có gửi, mặc định `0`.
- `status`: chỉ chấp nhận không gửi hoặc gửi đúng `'pending'` — giá trị khác → `400`.
- `201` / `400` (thiếu/sai id, FK không tồn tại, mentor sai company, ngày sai, progress ngoài range, status khác 'pending') / `409` (đã có hồ sơ trong đợt này).

### `PUT /api/internships/:id` (partial)
Body: bất kỳ subset nào của `company_id, company_mentor_id, lecturer_id, topic_id, status, progress, start_date, end_date` (tất cả field FK chấp nhận `null` để gỡ phân công).

| Field | Validate |
|---|---|
| `company_id` | Nếu khác `null`: phải tồn tại trong `companies` (`400` nếu không) |
| `lecturer_id` | Nếu khác `null`: phải tồn tại trong `lecturers` (`400` nếu không) |
| `topic_id` | Nếu khác `null`: phải tồn tại trong `topics` (`400` nếu không) |
| `company_mentor_id` | Nếu khác `null`: phải tồn tại trong `company_mentors` **và** `mentor.company_id` phải khớp `company_id` hiệu lực (giá trị mới nếu có đổi trong cùng request, hoặc giá trị hiện tại nếu không đổi) — đúng Database Design mục H.3. Sai → `400` |
| Đổi `company_id` mà không gửi kèm `company_mentor_id`, và mentor hiện tại không thuộc company mới | `400` — yêu cầu gửi kèm `company_mentor_id` mới |
| `status` | Phải nằm trong `ALLOWED_TRANSITIONS[status hiện tại]` (đúng `utils/internshipStatus.js`) — sai → `409` |
| `status = "completed"` | **Luôn ép `progress = 100`**, kể cả khi body có gửi `progress` khác (đúng `handleStatusChange` trong `InternshipDetailPage.jsx`) |
| `progress` (khi không đi kèm chuyển sang `completed`) | Phải trong khoảng 0–100 (`400` nếu sai); bị khóa (`409`) nếu status **hiện tại** ∈ {`completed`,`cancelled`,`rejected`} — đúng `canEditProgress` |
| `start_date`/`end_date` | Format `YYYY-MM-DD`; nếu cả 2 có mặt (hiệu lực), `start_date ≤ end_date` |
| `student_id`/`period_id` | Immutable — gửi giá trị khác hiện tại → `400` |
| body rỗng / không field nào hợp lệ | `400` ("Không có trường nào để cập nhật.") |

`200` (thành công) / `400` / `404` / `409`.

### `DELETE /api/internships/:id`
Chỉ cho phép khi `status = 'pending'` — đúng `InternshipDetailPage.jsx` (nút "Xóa hồ sơ" chỉ hiện khi `status === 'pending'`). Trạng thái khác → `409`. Khi xóa, `internship_logs`/`reports`/`evaluations` **CASCADE tự động** theo đúng thiết kế đã duyệt (weak entity) — **không** cascade `students`/`companies`/`lecturers`/`topics`/`internship_periods` (các bảng đó có RESTRICT bảo vệ ngược, không bị ảnh hưởng bởi thao tác này). `notifications` không có FK tới `internships` nên không liên quan.

- `200` / `404` / `409` (status không phải `pending`).

---

## HTTP tests đã chạy (qua HTTP thật)

```
GET list (search/filter), GET detail, GET 404                                    → PASS
POST valid, POST duplicate (student,period) → 409, POST invalid student_id → 400,
POST invalid period_id → 400, POST kèm field thừa (company_id/status/progress)
  → xác nhận bị BỎ QUA hoàn toàn, record tạo ra đúng mặc định                     → PASS
PUT assign lecturer valid/invalid                                                 → PASS
PUT assign company+mentor: mentor đúng company → OK; mentor SAI company → 400     → PASS
PUT assign topic valid/invalid                                                    → PASS
PUT đổi company_id một mình khi mentor cũ không còn khớp → 400                    → PASS
PUT status: pending→in_progress (bất hợp lệ) → 409; pending→approved → 200        → PASS
PUT progress: hợp lệ khi status=approved → 200; ngoài range 0-100 → 400           → PASS
PUT status approved→in_progress→completed: progress tự động = 100                → PASS
PUT progress sau khi completed → 409 (khóa)                                       → PASS
PUT sửa student_id (immutable) → 400; PUT body rỗng → 400; PUT nonexistent → 404  → PASS
DELETE internship completed → 409 (chặn đúng rule status=pending)                 → PASS
DELETE internship pending không có dependent → 200                                → PASS
DELETE internship pending CÓ log+report+evaluation gắn kèm (test qua SQL trực
  tiếp) → 200, xác nhận CASCADE tự xóa cả 3 bảng con                              → PASS
DELETE nonexistent → 404                                                          → PASS
```

## Regression Phase 2A/2B/2C
```
Health (2), Departments, Students, Lecturers, Companies, Company Mentors,
Internship Periods, Topics — GET list + DELETE-referenced (409) đều PASS.
```

## Data integrity
- **14/14 bảng** đúng row count gốc sau khi cleanup toàn bộ test data (kể cả 1 record test kẹt ở trạng thái `completed` — không có transition nào đưa nó quay lại `pending` để xóa qua API do đúng đúng thiết kế `ALLOWED_TRANSITIONS.completed = []`, nên đã xóa trực tiếp bằng SQL vì là dữ liệu test 100% do phiên làm việc này tạo ra).
- **19/19 FK** nguyên vẹn.
- **12 record `internships` gốc** đối chiếu từng giá trị (`student_id, period_id, company_id, company_mentor_id, lecturer_id, topic_id, status, progress`) — khớp chính xác 100% với `seed.sql`, không bị ảnh hưởng bởi bất kỳ thao tác test nào.
