# PHASE 7C — FINAL DEMO READINESS & DEFENSE PREPARATION

> **Ghi chú (đợt kiểm tra trước bảo vệ, sau nhiều phase mới):** Mọi con số trong tài liệu này là **số liệu tại thời điểm Phase 7C**, không phải hiện trạng mới nhất — xem `README.md` Mục 15/18/19 và `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` để lấy số liệu/trạng thái hiện hành (bao gồm các bổ sung sau Phase 7C: thông báo tự động, upload file thật, điểm tổng kết, phân trang, thống kê server-side, database test riêng, Playwright E2E, khóa/mở tài khoản + mật khẩu tạm bắt buộc đổi). Tài liệu này giữ nguyên làm bản ghi lịch sử của Phase 7C.

Phase này **không thêm tính năng, không đổi schema/business rule**. Phạm vi: (A) rà soát 9 REQ 🟡 còn tồn đọng sau Phase 7B (số liệu "12" ghi ở các báo cáo trước — kể cả chính system prompt khởi tạo phase này — đã được đối chiếu lại và xác nhận sai, xem Mục A.0), (B–E) 4 tài liệu phục vụ demo và bảo vệ, (F) xác minh cuối cùng bằng kiểm tra thật.

## A.0. Đối chiếu số liệu "12 REQ 🟡" trước khi làm việc

Prompt khởi tạo Phase 7C (và các báo cáo Phase 7A/7B trước đó) ghi "12 REQ còn 🟡". Đếm trực tiếp từng dòng trong `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` (script đếm, không đếm tay) ra kết quả **9 dòng** mang nhãn 🟡 (thuần hoặc một phần) tại thời điểm cuối Phase 7B:

| Nhãn | Số dòng thật | REQ |
|---|---|---|
| 🟡 thuần | 7 | REQ-016, 021, 026, 027, 042, 043, 044 |
| ✅ (Admin) / 🟡 (3 role khác) | 2 | REQ-045, REQ-046 |
| **Tổng** | **9** | |

Đây là lỗi đếm thủ công khi tổng hợp ở các báo cáo trước, không phải do bảng bị sửa — đã sửa lại số liệu tổng hợp trong `REQUIREMENT_TRACEABILITY_MATRIX.md`. Toàn bộ Task A dưới đây rà soát đúng 9 REQ này.

## Task A — Rà soát 9 REQ 🟡

| REQ | Nội dung | Trạng thái trước 7C | Bằng chứng code | Test trước 7C | Thiếu chức năng hay chỉ thiếu test? | Cần sửa trước demo? | Khuyến nghị / Hành động |
|---|---|---|---|---|---|---|---|
| REQ-016 | Student tự sửa field liên hệ chính mình | 🟡 | `server/services/studentService.js` hàm `update()`, `STUDENT_SELF_EDITABLE_FIELDS` (dòng 7), kiểm tra ownership dòng 172-180 | Code review + Manual HTTP (3B) | **Chỉ thiếu test** — logic đã đúng: whitelist 5 field, 403 nếu field khác, 403 nếu sửa hồ sơ người khác | Không bắt buộc, nhưng rẻ và an toàn để làm | **Đã làm**: thêm `server/tests/studentSelfEdit.test.js` (3 test: sửa hợp lệ + khôi phục, field ngoài whitelist 403, sửa người khác 403) → nâng **✅** |
| REQ-021 | Admin tạo hồ sơ thực tập cho bất kỳ sinh viên | 🟡 | `server/services/internshipService.js` hàm `create()` — khi `currentUser.role !== 'student'` thì không ép `student_id`, vẫn chạy đủ validate (period/company/mentor/topic tồn tại, duplicate, status cố định `pending`) | Manual HTTP (2D/4C) | **Chỉ thiếu test** | Không bắt buộc | **Đã làm**: thêm `server/tests/internshipAdminLifecycle.test.js` (Admin tạo cho `students.id=12` — sinh viên seed chưa có hồ sơ nào, dùng `period_id=3` — đợt chưa có đăng ký — tránh đụng dữ liệu seed thật) → nâng **✅** |
| REQ-026 | Xóa hồ sơ thực tập (chỉ khi `pending`) | 🟡 | `server/services/internshipService.js` hàm `remove()` dòng 375-385 — reject 409 nếu `status !== 'pending'`; route giới hạn role ở `internshipRoutes.js` | Code review only | **Chỉ thiếu test** | Không bắt buộc | **Đã làm**: cùng file `internshipAdminLifecycle.test.js` (DELETE khi `in_progress` → 409 không xóa; Student DELETE → 403; DELETE hồ sơ vừa tạo khi còn `pending` → 200) → nâng **✅** |
| REQ-027 | Student ghi nhật ký (chỉ khi `in_progress`) | 🟡 | `server/services/internshipLogService.js` hàm `create()` dòng 68-120 — ép ownership nếu role=student, check `internship.status === 'in_progress'`, reject `lecturer_comment`/`company_comment`/`status` khi tạo | Code review only (các case *từ chối* đã có test từ Phase 7B, nhưng case *thành công* (happy path) chưa có) | **Chỉ thiếu test** (riêng case thành công) | Không bắt buộc | **Đã làm**: thêm 1 test vào `server/tests/internshipLogsAuthorization.test.js` — Student A tạo log hợp lệ trên `internships.id=1` (`in_progress`, đúng hồ sơ của mình) → 201 `status=submitted`, sau đó tự xóa lại (log chưa `reviewed`) → nâng **✅** |
| REQ-042 | Xem/sửa cấu hình hệ thống | 🟡 | `server/services/settingsService.js` hàm `update()` — `IMMUTABLE_FIELDS` reject, validate `systemName`/`allowStudentRegistration` | `tests/crudSmoke.test.js` chỉ test GET | **Chỉ thiếu test** (riêng nhánh PUT) | Không bắt buộc | **Đã làm**: thêm `server/tests/settingsAuthorization.test.js` (Student PUT → 403; gửi field immutable `id` → 400; Admin sửa `allowStudentRegistration` hợp lệ + khôi phục) → nâng **✅**. **Phát hiện phụ (không phải lỗi, ghi nhận minh bạch)**: GET/PUT `/settings` trả **snake_case** (`system_name`...) nhưng PUT request body lại cần **camelCase** (`systemName`...) — mismatch 2 chiều đã biết từ Phase 4E-3, xử lý ở `client/src/api/settingsApi.js` bằng 1 mapper duy nhất. Không sửa — đây là hành vi đã chốt, sửa lúc này rủi ro vỡ frontend ngay trước demo. |
| REQ-043 | Ẩn nút "Đăng ký thực tập" khi `allowStudentRegistration=false` | 🟡 | `client/src/pages/student/StudentInternshipPage.jsx` dòng 89 — `settings.allowStudentRegistration ? <Button/> : <p>...</p>` | Code review only | **Chỉ thiếu test** — nhưng đây là logic JSX thuần frontend, môi trường hiện tại không có React Testing Library/jsdom cài sẵn (chỉ có `node:test` cho pure-logic), và không có browser automation. Viết thêm infra test chỉ cho 1 dòng JSX là chi phí không tương xứng ở giai đoạn này. | **Không** — code review xác nhận đúng, rủi ro thấp (component nhỏ, điều kiện rõ ràng) | Giữ **🟡**. Khuyến nghị: xác minh thủ công qua browser trước buổi bảo vệ (đã đưa vào `DEMO_READINESS_CHECKLIST.md`) — tắt `allowStudentRegistration` ở Admin Settings, F5 trang Student Internship, xác nhận nút biến mất, rồi bật lại. |
| REQ-044 | Thống kê tổng hợp theo Khoa/Đợt/Doanh nghiệp (derived từ Context) | 🟡 | `client/src/pages/admin/AdminStatisticsPage.jsx` — tính toán thuần từ `students`/`internships`/`reports`/`evaluations` đã load qua Context, không gọi API riêng | Code review only (Full System Gap Audit) | **Chỉ thiếu test** — là phép tính `filter`/`reduce` thuần trên dữ liệu đã có, không có business rule mới. Tách thành pure function riêng để unit-test được sẽ là **refactor**, nằm ngoài nguyên tắc "không tự ý thêm/đổi code chỉ để số liệu đẹp hơn" của phase này. | **Không** | Giữ **🟡** có chủ đích. Khuyến nghị cho phase sau (không làm ngay): tách logic tính toán ra 1 module `statisticsUtils.js` thuần, rồi viết `node:test` theo đúng pattern `providerAccess.test.js`. |
| REQ-045 | Xuất thông tin thực tập (.xlsx) | ✅ (Admin) / 🟡 (Student/Lecturer/Mentor) | Backend: `exportService.js`, scope giống `GET /internships`, đã PASS qua `exportService.test.js`. Frontend: **chỉ `AdminStatisticsPage.jsx` có nút xuất** — không có nút/route export ở `StudentInternshipPage`, `LecturerStudentsPage`, `CompanyStudentsPage` | `exportService.test.js` (backend) | **Thực sự thiếu UI** (không phải thiếu test) cho 3 role — backend đã sẵn sàng và đã kiểm chứng | **Không** — thêm UI mới = thêm tính năng, vi phạm nguyên tắc "không tự ý thêm tính năng mới" của Phase 7C | Giữ **🟡** cho phần UI 3 role. Nếu hội đồng hỏi "Student có xuất được Excel không" → trả lời đúng thực tế: "Backend hỗ trợ đầy đủ và đã test (`exportService.test.js`), nhưng UI hiện tại chỉ làm cho Admin — có thể demo qua gọi API trực tiếp (Postman/curl với JWT Student) nếu cần, xem `DEFENSE_QA.md`." Đề xuất bổ sung UI ở phase phát triển tiếp theo nếu được yêu cầu. |
| REQ-046 | Xuất đánh giá/nhận xét (.xlsx) | ✅ (Admin) / 🟡 (3 role khác) | Tương tự REQ-045 — `exportService.js` export evaluations, lọc đúng `is_published` | `exportService.test.js` | **Thực sự thiếu UI** cho 3 role | **Không** | Giữ **🟡**, cùng khuyến nghị như REQ-045. |

### Tổng kết Task A

- **5/9 REQ** (016, 021, 026, 027, 042) backend-testable, logic đã đúng từ trước — chỉ thiếu automated test → **đã bổ sung test thật, nâng lên ✅**, không sửa 1 dòng business logic nào.
- **2/9 REQ** (043, 044) là logic frontend thuần, chỉ có thể xác minh chắc chắn qua browser hoặc refactor để unit-test được — cả hai đều ngoài phạm vi an toàn của phase này (thêm infra test / refactor code sát ngày bảo vệ) → giữ 🟡, đưa vào checklist xác minh thủ công.
- **2/9 REQ** (045, 046 — phần "3 role khác") là **thiếu UI thật**, không phải thiếu test → không tự ý xây UI mới, giữ 🟡, chuẩn bị câu trả lời phản biện rõ ràng.
- **Không phát hiện lỗi nghiêm trọng (P0/P1) nào mới** trong quá trình rà soát 9 REQ này.

## Task F — Xác minh cuối cùng

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Backend test suite (`cd server && npm test`) | **126/126 PASS**, 0 fail, 0 skip, ~12.6s | 116 (Phase 7B) + 10 test mới (Phase 7C: 3 `studentSelfEdit`, 3 `internshipAdminLifecycle`, 1 thêm vào `internshipLogsAuthorization`, 3 `settingsAuthorization`) |
| Frontend lint (`cd client && npm run lint`) | 40 warning | Baseline không đổi (giống Phase 7B) |
| Frontend build (`cd client && npm run build`) | 192 module, 0 lỗi | |
| Health check | `GET /api/health` → `{"success":true,"message":"Backend is running"}`; `GET /api/health/db` → `{"success":true,"message":"Database connection is working"}` | Verify qua instance backend đang chạy sẵn trên cổng 5000 |
| Database integrity (chỉ đọc, `COUNT(*)` trực tiếp) | `students=14, internships=12, internship_logs=3, reports=2, evaluations=2, users=10, settings=1` — khớp baseline trước khi chạy test; `students.id=1.phone` và `settings.allow_student_registration` đã khôi phục đúng giá trị gốc | Không dùng `information_schema.TABLE_ROWS` |
| Browser E2E | **KHÔNG CHẠY** | Không có browser automation tool trong môi trường này — đúng như mọi phase trước, không tuyên bố PASS |

## Tài liệu đã tạo trong Phase 7C

- `docs/FINAL_DEMO_SCRIPT.md`
- `docs/DEMO_READINESS_CHECKLIST.md`
- `docs/DEFENSE_QA.md`
- `docs/DEFENSE_PRESENTATION_OUTLINE.md`
- `docs/PHASE_7C_FINAL_PREPARATION.md` (tài liệu này)

## File đã tạo/sửa (code + test)

**Test mới:**
- `server/tests/studentSelfEdit.test.js`
- `server/tests/internshipAdminLifecycle.test.js`
- `server/tests/settingsAuthorization.test.js`

**Test sửa (thêm 1 case):**
- `server/tests/internshipLogsAuthorization.test.js` (+1 test: tạo log hợp lệ)

**Cấu hình:**
- `server/package.json` (script `test` — thêm 3 file mới vào danh sách chạy)

**Tài liệu sửa:**
- `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` (nâng 5 REQ lên ✅, sửa lại số liệu tổng hợp sai ở các phase trước, ghi chú minh bạch)

**Không có code business logic nào bị sửa.** Không đổi schema, không reseed, không xóa dữ liệu.

## FINAL VERDICT: PHASE 7C COMPLETE
