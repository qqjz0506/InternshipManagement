# PHASE INDEX — Danh mục tài liệu theo từng phase phát triển

Thứ tự theo đúng thứ tự phát triển thật. Mọi phase dưới đây đều có trạng thái **COMPLETE** (đã được duyệt trước khi chuyển phase kế tiếp) — không có phase nào bị bỏ ngang hoặc rollback.

## Tài liệu tham chiếu (không gắn với 1 phase cụ thể)

| Tài liệu | Nội dung |
|---|---|
| [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) | Thiết kế schema MySQL đầy đủ — 14 bảng, suy ra trực tiếp từ mock data/Context thật trước khi có backend |
| [`DATA_MIGRATION.md`](DATA_MIGRATION.md) | Ghi chú quá trình chuyển dữ liệu mock → seed MySQL |

## Backend nền tảng (Phase 1–3B)

| Phase | Tài liệu | Nội dung |
|---|---|---|
| 2A | [`API_PHASE_2A.md`](API_PHASE_2A.md) | Backend CRUD: Departments, Students, Lecturers |
| 2B | [`API_PHASE_2B.md`](API_PHASE_2B.md) | Backend CRUD: Companies, Company Mentors |
| 2C | [`API_PHASE_2C.md`](API_PHASE_2C.md) | Backend CRUD: Internship Periods, Topics |
| 2D | [`API_PHASE_2D.md`](API_PHASE_2D.md) | Backend CRUD: Internships (bảng trung tâm) |
| 2E | [`API_PHASE_2E.md`](API_PHASE_2E.md) | Backend CRUD: Internship Logs, Reports |
| 2F | [`API_PHASE_2F.md`](API_PHASE_2F.md) | Backend CRUD: Evaluations, Notifications, Settings |
| 3A | [`API_PHASE_3A.md`](API_PHASE_3A.md) | Authentication thật: JWT, bcrypt password hashing (thay mock `password` plaintext) |
| 3B | [`API_PHASE_3B.md`](API_PHASE_3B.md) | RBAC (`requireRole`) + Data-level Authorization (`scopeService`, ownership/scope theo role) |

## Frontend migration mock → REST API (Phase 4A–4F)

| Phase | Tài liệu | Nội dung |
|---|---|---|
| 4A | [`API_PHASE_4A.md`](API_PHASE_4A.md) | `apiClient.js` (API client nền tảng) + tích hợp Auth thật vào frontend |
| 4B-1 | [`API_PHASE_4B_1.md`](API_PHASE_4B_1.md) | Migrate Departments + Internship Periods sang REST API |
| 4B-2 | [`API_PHASE_4B_2.md`](API_PHASE_4B_2.md) | Migrate Students + Lecturers sang REST API |
| 4B-3 | [`API_PHASE_4B_3.md`](API_PHASE_4B_3.md) | Migrate Companies + Company Mentors sang REST API |
| 4B-4 | [`API_PHASE_4B_4.md`](API_PHASE_4B_4.md) | Migrate Topics sang REST API + fix RBAC cho Lecturer duyệt/từ chối đề tài (status-only, scoped) |
| 4C | [`API_PHASE_4C.md`](API_PHASE_4C.md) | Migrate Internships sang REST API (giữ nguyên interface Context cũ) |
| 4D-1 | [`API_PHASE_4D_1.md`](API_PHASE_4D_1.md) | Migrate Internship Logs sang REST API |
| 4D-2 | [`API_PHASE_4D_2.md`](API_PHASE_4D_2.md) | Migrate Reports sang REST API |
| 4E-1 | [`API_PHASE_4E_1.md`](API_PHASE_4E_1.md) | Migrate Evaluations sang REST API |
| 4E-2 | [`API_PHASE_4E_2.md`](API_PHASE_4E_2.md) | Migrate Notifications sang REST API |
| 4E-3 | [`API_PHASE_4E_3.md`](API_PHASE_4E_3.md) | Migrate Settings sang REST API (single-row, mapper camelCase↔snake_case) |
| 4F-0 | [`API_PHASE_4F_0.md`](API_PHASE_4F_0.md) | **Audit-only** (không code): Users/Accounts, account linking, password security |
| 4F-1 | [`API_PHASE_4F_1.md`](API_PHASE_4F_1.md) | Backend Users API (`/api/users`, Admin-only, atomic create+link transaction) |
| 4F-2 | [`API_PHASE_4F_2.md`](API_PHASE_4F_2.md) | Migrate UsersContext/AdminAccountsPage sang REST API (bỏ `MOCK_USERS`) |

## Hoàn thiện & chất lượng (Phase 5–6C)

| Phase | Tài liệu | Nội dung |
|---|---|---|
| 5 | [`API_PHASE_5.md`](API_PHASE_5.md) | Export Excel (.xlsx): thông tin thực tập + đánh giá/nhận xét, scope/IDOR, bảo vệ đánh giá chưa công bố |
| 6A | [`PHASE_6A_ROLE_AWARE_PROVIDER_LOADING.md`](PHASE_6A_ROLE_AWARE_PROVIDER_LOADING.md) | Role-aware/auth-aware Provider loading (fix `UsersProvider` gọi API vô điều kiện) |
| 6B | [`PHASE_6B_AUTOMATED_TESTING.md`](PHASE_6B_AUTOMATED_TESTING.md) | Automated backend regression test suite (`node:test`, 86 test) |
| 6C | [`PHASE_6C_DOCUMENTATION.md`](PHASE_6C_DOCUMENTATION.md) | Tài liệu dự án: `README.md`, `ARCHITECTURE.md`, `API_INDEX.md`, `PHASE_INDEX.md` (tài liệu này) |
| 7A | [`PHASE_7A_FINAL_AUDIT.md`](PHASE_7A_FINAL_AUDIT.md) | **Audit-only** (không code): kiểm toán toàn diện yêu cầu nghiệp vụ, truy vết, API/bảo mật, database, test, demo readiness — kèm [`REQUIREMENT_TRACEABILITY_MATRIX.md`](REQUIREMENT_TRACEABILITY_MATRIX.md) và [`PHASE_7A_EVIDENCE_LOG.md`](PHASE_7A_EVIDENCE_LOG.md) |
| 7B | [`PHASE_7B_SECURITY_AND_REGRESSION.md`](PHASE_7B_SECURITY_AND_REGRESSION.md) | Sửa F-03 (lộ stack trace), F-06 (AccountDetailModal), F-05 (Topbar search); xóa dead code (12 file `data/*.js` + `PlaceholderPage.jsx`); +30 automated test (workflow Internship, phân công, field-whitelist Logs/Reports, error handling) — 116/116 PASS |
| 7C | [`PHASE_7C_FINAL_PREPARATION.md`](PHASE_7C_FINAL_PREPARATION.md) | Chuẩn bị demo/bảo vệ: rà soát 9 REQ 🟡 tồn đọng (sửa lại số liệu "12" sai từ các báo cáo trước), +10 automated test (student self-edit, admin internship lifecycle, settings, log creation) nâng 5 REQ lên ✅ — 126/126 PASS; kèm [`FINAL_DEMO_SCRIPT.md`](FINAL_DEMO_SCRIPT.md), [`DEMO_READINESS_CHECKLIST.md`](DEMO_READINESS_CHECKLIST.md), [`DEFENSE_QA.md`](DEFENSE_QA.md), [`DEFENSE_PRESENTATION_OUTLINE.md`](DEFENSE_PRESENTATION_OUTLINE.md) |

## Quy ước đặt tên

- `API_PHASE_<tên>.md`: phase có thay đổi code backend và/hoặc frontend liên quan tới API.
- `PHASE_<tên>_<mô_tả>.md`: phase không gắn trực tiếp với 1 API domain cụ thể (role-aware loading, testing, documentation).
- Không có file nào bị xóa/đổi tên giữa các phase — lịch sử đầy đủ được giữ nguyên trong `docs/`.
