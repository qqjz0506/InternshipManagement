# API INDEX — Danh mục domain API

Tiền tố chung: `/api`. Response JSON dạng `{ success, message, data }` (trừ 2 endpoint export trả file nhị phân `.xlsx`). Đây là danh mục tổng quan — chi tiết đầy đủ từng endpoint/field/test nằm ở tài liệu phase tương ứng (xem [`PHASE_INDEX.md`](PHASE_INDEX.md)).

Ký hiệu quyền: **mọi route (trừ `POST /auth/login` và `GET /health*`) đều yêu cầu `requireAuth`** (JWT hợp lệ) — cột "Quyền" dưới đây chỉ ghi thêm ràng buộc role/scope phía trên `requireAuth`.

| Domain | Route prefix | Mục đích | Quyền | Tài liệu chi tiết |
|---|---|---|---|---|
| Health | `/api/health` | Health check (app, DB connection) | Công khai (không cần token) | — |
| Auth | `/api/auth` | Đăng nhập, lấy thông tin tài khoản đang đăng nhập | `POST /login` công khai; `GET /me` cần token | `API_PHASE_3A.md` |
| Departments | `/api/departments` | Khoa/Bộ môn | GET: mọi role; POST/PUT/DELETE: admin | `API_PHASE_2A.md`, `API_PHASE_4B_1.md` |
| Students | `/api/students` | Hồ sơ sinh viên | GET: scoped theo role (hỗ trợ `?page=&pageSize=` optional, xem README Mục 14); POST: admin; PUT: admin (full) hoặc chính Student (field liên hệ); DELETE: admin | `API_PHASE_2A.md`, `API_PHASE_3B.md`, `API_PHASE_4B_2.md` |
| Lecturers | `/api/lecturers` | Hồ sơ giảng viên | GET: scoped; POST/PUT/DELETE: admin | `API_PHASE_2A.md`, `API_PHASE_4B_2.md` |
| Companies | `/api/companies` | Doanh nghiệp | GET: mọi role; POST/PUT/DELETE: admin | `API_PHASE_2B.md`, `API_PHASE_4B_3.md` |
| Company Mentors | `/api/company-mentors` | Người hướng dẫn doanh nghiệp | GET: scoped; POST/PUT/DELETE: admin | `API_PHASE_2B.md`, `API_PHASE_4B_3.md` |
| Internship Periods | `/api/internship-periods` | Đợt thực tập | GET: mọi role; POST/PUT/DELETE: admin | `API_PHASE_2C.md`, `API_PHASE_4B_1.md` |
| Topics | `/api/topics` | Đề tài thực tập | GET: mọi role; POST: admin + student (tự đề xuất); PUT: admin (full) hoặc lecturer (chỉ `status`, scoped theo internship phụ trách); DELETE: admin | `API_PHASE_2C.md`, `API_PHASE_4B_4.md` (+ Topic Approval RBAC fix) |
| Internships | `/api/internships` | **Hồ sơ thực tập — bảng trung tâm** | GET: scoped (hỗ trợ `?page=&pageSize=` optional); POST: admin + student (tự đăng ký); PUT: admin (full) hoặc student (3 field giới hạn, chỉ khi status đầu quy trình); DELETE: admin (chỉ status `pending`) | `API_PHASE_2D.md`, `API_PHASE_3B.md`, `API_PHASE_4C.md` |
| Internship Logs | `/api/internship-logs` | Nhật ký thực tập hàng tuần | GET: scoped (hỗ trợ `?page=&pageSize=` optional); POST: admin + student; PUT: field-whitelist theo role (student/lecturer/company_mentor), khóa khi `status='reviewed'`; DELETE: admin + student (khóa khi đã reviewed) | `API_PHASE_2E.md`, `API_PHASE_4D_1.md` |
| Reports | `/api/reports` | Báo cáo thực tập (tuần/tổng kết) | GET: scoped (hỗ trợ `?page=&pageSize=` optional); POST: admin + student; PUT: field-whitelist theo role (lecturer/company_mentor); DELETE: admin | `API_PHASE_2E.md`, `API_PHASE_4D_2.md` |
| Evaluations | `/api/evaluations` | Đánh giá thực tập | GET: scoped (**student chỉ thấy `is_published=1`**); POST/PUT: admin + lecturer + company_mentor (evaluator suy từ internship, không có `evaluator_id`); DELETE: admin | `API_PHASE_2F.md`, `API_PHASE_3B.md`, `API_PHASE_4E_1.md` |
| Notifications | `/api/notifications` | Thông báo theo tài khoản | GET: scoped (chỉ của chính mình); POST: admin; PUT: chủ sở hữu hoặc admin (chỉ `is_read`); DELETE: admin | `API_PHASE_2F.md`, `API_PHASE_4E_2.md` |
| Settings | `/api/settings` | Cấu hình hệ thống (single-row) | GET: mọi role; PUT: admin | `API_PHASE_2F.md`, `API_PHASE_4E_3.md` |
| Users | `/api/users` | Tài khoản đăng nhập (account, tách biệt khỏi hồ sơ nghiệp vụ) | **Toàn bộ method: admin only** (không có `/users/me` — dùng `/auth/me`) | `API_PHASE_4F_0.md` (audit), `API_PHASE_4F_1.md` (backend), `API_PHASE_4F_2.md` (frontend) |
| Exports | `/api/exports` | Xuất Excel (.xlsx): thông tin thực tập, đánh giá/nhận xét | GET: mọi role, scope giống đúng GET tương ứng (`/internships`, `/evaluations`) | `API_PHASE_5.md` |
| Statistics | `/api/statistics` | Thống kê tổng hợp (KPI + breakdown theo khoa/đợt/doanh nghiệp/trạng thái), tính bằng SQL `GROUP BY` ở server | `GET /summary`: Admin only | — |

## Field immutability (tổng hợp nhanh — chi tiết ở tài liệu từng phase)

| Entity | Field immutable khi UPDATE (reject 400 nếu gửi) |
|---|---|
| Internships | `student_id`, `period_id` |
| Internship Logs | `internship_id` |
| Reports | `internship_id`, `report_type`, `file_name`, `submitted_at` |
| Evaluations | `internship_id`, `evaluator_role` |
| Notifications | `user_id`, `title`, `content`, `type` |
| Settings | `id`, `version`, `FRONTEND_VERSION`, `frontend_version` |
| Users | `id`, `role`, `profile_id`, `password_hash` |

## Danh sách endpoint KHÔNG tồn tại (tránh giả định sai)

```
Không có: DELETE /api/users/:id
Không có: PATCH /api/users/:id/role
Không có: POST /api/users/:id/reset-password
Không có: POST /api/auth/register, /api/auth/refresh, /api/auth/logout, /api/auth/change-password
Không có: /api/exports/internship-package.xlsx (combined — optional ở Phase 5, không implement)
Không có endpoint PDF/CSV export nào
```
