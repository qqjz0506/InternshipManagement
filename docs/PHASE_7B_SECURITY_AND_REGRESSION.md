# PHASE 7B — Security Hardening, Bug Fixes & Regression Tests

> **Ghi chú (đợt kiểm tra trước bảo vệ, sau nhiều phase mới):** Mọi con số trong tài liệu này là **số liệu tại thời điểm Phase 7B**, không phải hiện trạng mới nhất — xem `README.md` Mục 15/18/19 và `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` để lấy số liệu/trạng thái hiện hành.

Dựa trên `docs/PHASE_7A_FINAL_AUDIT.md` (Finding F-03, F-06, F-05, F-07) và `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` (các REQ 🟡 ưu tiên cao).

## 1. Lỗi đã sửa

### 1.1. F-03 — `err.stack` bị lộ trong response lỗi (P2)
**File:** `server/middleware/errorHandler.js`.
**Trước:** chỉ ẩn `err.stack` khi `process.env.NODE_ENV === 'production'` — không ai set biến này ở môi trường dev/demo local, nên stack trace **luôn** bị lộ trên mọi response lỗi trong thực tế.
**Sau:** mặc định AN TOÀN vô điều kiện — `error` (stack) chỉ xuất hiện khi có cờ tường minh `DEBUG_ERRORS=true` trong `.env` (KHÔNG set ở `.env`/`.env.example` thật, mặc định luôn tắt). Đồng thời: với lỗi KHÔNG lường trước (không phải `AppError`, luôn là 500 — ví dụ exception driver MySQL thật), `message` trả về client cũng được thay bằng câu chung `"Đã xảy ra lỗi máy chủ."` thay vì lộ message gốc (có thể chứa chi tiết SQL/driver nội bộ) — log đầy đủ (bao gồm message gốc + stack) vẫn được ghi ở server qua `console.error(err)` để debug, không mất thông tin phục vụ phát triển.
**KHÔNG đổi:** mọi `AppError` nghiệp vụ (400/401/403/404/409 với message tiếng Việt do code tự viết) giữ ĐÚNG NGUYÊN message như trước — xác nhận bằng test (`tests/errorHandling.test.js`, case "AppError nghiệp vụ vẫn giữ đúng message cụ thể") frontend không bị ảnh hưởng.
**Đã KHÔNG làm:** không chỉ thêm `NODE_ENV=production` vào `.env` rồi bỏ qua — logic mặc định-an-toàn được sửa tận gốc trong code, hoạt động đúng dù `NODE_ENV` không được set ở đâu cả (đã verify bằng test thật).

### 1.2. F-06 — `AccountDetailModal` đọc sai field (P3)
**File:** `client/src/components/accounts/AccountDetailModal.jsx`.
**Sửa:** `account.linkedLabel` → `account.label` (đúng field `AdminAccountsPage.jsx` thực sự spread vào row). 1 dòng, không đổi API contract/logic liên kết profile.
**Verify:** build/lint PASS, không có component khác đọc `linkedLabel` (grep xác nhận).

### 1.3. F-05 — Ô tìm kiếm Topbar bị disable vĩnh viễn (P3)
**File:** `client/src/components/layout/Topbar.jsx`.
**Sửa:** bỏ `<input disabled>` không có chức năng thật, giữ nguyên `<div className="topbar-search" />` rỗng để không đổi layout (`.topbar` dùng `justify-content: space-between` với đúng 2 phần tử con — xóa hẳn div sẽ đẩy phần user/logout sang trái, đổi giao diện; giữ div rỗng tránh điều này mà không cần sửa CSS).
**Không triển khai** global search mới — đúng chỉ đạo.

### 1.4. Dead code (P3 — F-07 một phần)
Đã xóa (xác minh KHÔNG còn import trực tiếp/gián tiếp/dynamic import/script/test/build-config nào trước khi xóa — xem Mục 6):
```
client/src/data/companies.js, companyMentors.js, departments.js, evaluations.js,
  internshipLogs.js, internshipPeriods.js, internships.js, lecturers.js, notifications.js,
  reports.js, students.js, topics.js   (12 file)
client/src/pages/PlaceholderPage.jsx   (1 file)
```
**Giữ lại:** `client/src/data/mockUsers.js` (vẫn export `ROLE_LABELS`/`ROLE_HOME_PATH` đang được dùng thật ở `AdminAccountsPage.jsx`, `AccountFormModal.jsx`, `LoginPage.jsx`, `Topbar.jsx`). **Giữ lại** CSS class `.placeholder-page` trong `App.css` vì `UnauthorizedPage.jsx` vẫn đang dùng class này cho chính nó (không phụ thuộc component `PlaceholderPage.jsx` đã xóa).

## 2. File đã thay đổi/xóa

```
Sửa:
  server/middleware/errorHandler.js
  server/.env.example                              (thêm DEBUG_ERRORS, để trống)
  server/package.json                                (cập nhật script "test")
  client/src/components/accounts/AccountDetailModal.jsx
  client/src/components/layout/Topbar.jsx
  docs/REQUIREMENT_TRACEABILITY_MATRIX.md            (cập nhật 6 REQ + thêm REQ-051)

Xóa:
  client/src/data/{companies,companyMentors,departments,evaluations,internshipLogs,
    internshipPeriods,internships,lecturers,notifications,reports,students,topics}.js
  client/src/pages/PlaceholderPage.jsx

Mới:
  server/tests/internshipWorkflow.test.js
  server/tests/internshipLogsAuthorization.test.js
  server/tests/reportsAuthorization.test.js
  server/tests/errorHandling.test.js
  docs/PHASE_7B_SECURITY_AND_REGRESSION.md           (tài liệu này)
```
Không sửa schema, không sửa seed data, không đổi API contract/response shape (ngoài việc ẨN field `error` khi không ở debug mode — field này được xác nhận KHÔNG được frontend đọc ở bất kỳ đâu, xem Mục 5).

## 3. Test mới (30 test, 4 file)

### `tests/internshipWorkflow.test.js` (10 test) — REQ-022, REQ-023, REQ-025
```
- Transition sai (pending->in_progress, bỏ qua approved) -> 409
- completed là trạng thái cuối, không chuyển đi đâu được (kể cả Admin) -> 409
- Round-trip hợp lệ pending->rejected->pending (đúng ALLOWED_TRANSITIONS thật, không tự suy ra)
- Lecturer/Company Mentor không có quyền PUT /internships (403 route-level)
- Student không tự đổi status (ngoài 3 field whitelist) -> 403
- Student bị khóa sửa company/mentor/topic khi internship không còn pending/approved -> 409
- Student không sửa được internship của người khác -> 403 (không phải 404 — không lộ tồn tại)
- Assignment: mentor không thuộc company đã chọn -> 400, không ghi DB
- Assignment: đổi company không kèm mentor mới (mentor cũ không khớp company mới) -> 400
- Assignment: gán company+mentor hợp lệ -> 200, khôi phục lại null
```

### `tests/internshipLogsAuthorization.test.js` (8 test) — REQ-028
```
- Student tạo log kèm lecturer_comment -> 400
- Tạo log khi internship không in_progress -> 409 (áp dụng cả Admin)
- Lecturer A không sửa được log của Lecturer B -> 403
- Lecturer sửa field ngoài whitelist (lecturer_comment, status) -> 403
- Company Mentor sửa field ngoài whitelist (chỉ company_comment) -> 403
- Student gửi internship_id (immutable) -> 400
- Student A không đọc/sửa log của Student B qua gọi API trực tiếp -> 403
- Lecturer A nhận xét hợp lệ (200), khôi phục lại giá trị cũ
```

### `tests/reportsAuthorization.test.js` (6 test) — REQ-031
```
- internship_id/report_type/file_name/submitted_at immutable khi PUT -> 400 mỗi field
- Student không có quyền PUT dù là báo cáo của chính mình -> 403 (route-level)
- Lecturer sửa field ngoài whitelist -> 403
- Company Mentor sửa field ngoài whitelist -> 403
- Lecturer B không sửa được báo cáo thuộc phạm vi Lecturer A -> 403 (cross-scope)
- Lecturer A duyệt hợp lệ báo cáo thuộc phạm vi mình (200), khôi phục lại giá trị cũ
```

### `tests/errorHandling.test.js` (6 test) — REQ-051
```
- 401 (thiếu token): giữ đúng status/message, không lộ stack (mặc định, không cần set NODE_ENV)
- 403 (RBAC): message nghiệp vụ giữ nguyên, không lộ stack
- Lỗi không lường trước (JSON malformed, không phải AppError): message chung, không lộ message gốc
- AppError nghiệp vụ (400): message cụ thể giữ nguyên (không bị đổi thành message chung)
- DEBUG_ERRORS=true: xác nhận cờ thật sự bật được stack khi cần (không phải mặc định)
- Sau khi tắt lại DEBUG_ERRORS: hành vi trở lại an toàn mặc định
```

## 4. Sự cố phát hiện trong lúc viết test (đã sửa, không phải bug sản phẩm)

Test đầu tiên cho "Lecturer A nhận xét hợp lệ, khôi phục lại giá trị cũ" (`internshipLogsAuthorization.test.js`) ban đầu FAIL: `internshipLogService.update()` chuẩn hóa chuỗi rỗng (`''`) thành `NULL` (hàm `resolveOptionalText`) — giá trị gốc thật của `internship_logs.id=2.lecturer_comment` trong seed là `''` (xác nhận qua `seed.sql` dòng 145), nên khôi phục LẠI `''` qua API sẽ bị ghi thành `NULL`, không khôi phục đúng byte-for-byte. Đây là hành vi **chuẩn hóa dữ liệu bình thường của API** (`''` và `NULL` tương đương về nghĩa "chưa có nhận xét"), không phải lỗi nghiệp vụ — nhưng khiến bước khôi phục trong test phải dùng SQL trực tiếp (`UPDATE ... SET lecturer_comment = ?`) thay vì gọi lại API, để đảm bảo khôi phục đúng giá trị gốc tuyệt đối. Đã phát hiện ngay (test fail rõ ràng), xác minh bằng `seed.sql`, sửa test, khôi phục dữ liệu thật về đúng `''` trước khi chạy lại toàn bộ suite.

## 5. Xác nhận field `error` không được frontend sử dụng

Grep `client/src/**` cho `\.error\b` liên quan tới response API: `apiClient.js` (`request()`) chỉ đọc `parsed.success`, `parsed.message`, `parsed.data` — không có nơi nào đọc `parsed.error`. `ApiError`/`UnauthorizedError` tự xây `{status, message, data}` từ các field đó, không truyền `error` (stack) vào đâu cả. Xác nhận: ẩn field `error` khi không debug KHÔNG ảnh hưởng bất kỳ hành vi frontend nào.

## 6. Xác minh trước khi xóa dead code

```
grep "import ... from '.../data/<file>'" toàn bộ client/     -> 0 kết quả (12 file data/*.js)
grep "import(...data/...)" (dynamic import)                  -> 0 kết quả
grep "<filename>" toàn bộ repo (kể cả docs/, server/db/)      -> chỉ khớp trong COMMENT/prose lịch sử
  (vd. "// Phase 4B-2: ... data/students.js", "-- 5. STUDENTS (data/students.js)") — xác nhận đọc
  trực tiếp từng match, không phải import/dependency thật
grep "PlaceholderPage" toàn bộ client/src/                     -> chỉ chính file đó
vite.config.js                                                 -> không có glob/alias đặc biệt nào
  trỏ tới thư mục data/ hoặc PlaceholderPage
```
Không xóa file nào dựa trên kết quả grep đầu tiên duy nhất — đã kiểm tra chéo bằng 2 pattern khác nhau (có và không có prefix `data/`) cho mỗi file trước khi xóa.

## 7. Lệnh đã chạy & kết quả thật

```
cd server && npm test
  → 116/116 PASS, 0 fail, 0 skip, ~10.5-11s (baseline Phase 6B/7A: 86 test — +30 test mới)

cd client && npm run lint   → 40 warning (baseline không đổi)
cd client && npm run build  → 192 modules, 0 lỗi (không đổi — 12 file data/*.js + PlaceholderPage.jsx
                                chưa từng được Vite bundle, xác nhận đúng là dead code)
cd client && node --test src/context/providerAccess.test.js  → 3/3 PASS (Phase 6A, không đổi)

GET /api/health      → {"success":true,"message":"Backend is running"}
GET /api/health/db   → {"success":true,"message":"Database connection is working"}

DB integrity (chỉ đọc):
  14/14 tables, 19/19 FKs
  users=10, departments=4, internship_periods=3, students=14, lecturers=10, companies=10,
  company_mentors=7, topics=10, internships=12, internship_logs=3, reports=2, evaluations=2,
  notifications=13, settings=1 — KHỚP TUYỆT ĐỐI baseline, không đổi ngoài dự kiến.
  Spot-check giá trị đã mutate-rồi-khôi-phục trong test: internship_logs.id=2.lecturer_comment='',
  reports.id=1.status='approved' (nguyên văn), internships.id=1/3/9 đúng company/mentor/status gốc
  — verify bằng SELECT trực tiếp sau toàn bộ test run, kèm --default-character-set=utf8mb4 để loại
  trừ display artifact (không phải corruption thật).
```

## 8. Test chưa thể chạy / giới hạn

```
- Browser E2E: KHÔNG CHẠY (không có tool) — không claim PASS.
- REQ còn 🟡 sau Phase 7B (12 REQ): REQ-016 (Student self-edit), REQ-021 (Admin tạo internship),
  REQ-026 (Delete internship), REQ-027 (Student tạo log), REQ-042/043 (Settings PUT), REQ-044
  (Statistics), REQ-045/046 (export cho 3 role chưa có UI) — CHƯA thêm test trong Phase 7B này, để
  lại cho phase sau theo đúng chỉ đạo "không đổi trạng thái REQ chỉ vì thêm 1 test đơn lẻ ở domain
  lân cận" và tránh phạm vi phình to ngoài 4 nhóm C1-C4 đã được giao.
```

## 9. Tác động và rủi ro còn lại

```
- DEBUG_ERRORS là tính năng MỚI (cờ opt-in) — rủi ro gần như 0 vì mặc định tắt, chỉ ảnh hưởng nếu ai
  đó chủ động set true trong .env của họ (không áp dụng cho .env thật của dự án).
- Xóa 13 file dead code: rủi ro 0 (build/lint/test đều xác nhận không ai import) — nhưng nếu phát
  hiện sau này có tài liệu/ghi chú nào NGOÀI repo (vd. báo cáo PDF nộp riêng) tham chiếu trực tiếp
  tới các file này, cần cập nhật tài liệu đó (không thuộc phạm vi kiểm tra được từ codebase).
- 2 fix UI (F-05, F-06) không đổi logic nghiệp vụ, rủi ro thấp nhất.
```

## 10. Số test pass/fail/skip cuối cùng

```
Trước Phase 7B: 86 test (backend) + 3 test (frontend providerAccess)
Sau Phase 7B:  116 test (backend, +30) + 3 test (frontend, không đổi)
Pass: 116/116 (backend) + 3/3 (frontend) = 119/119
Fail: 0
Skip: 0
```

## 11. Giới hạn vẫn chưa được xác minh

```
- Browser E2E (click-through thật) — như mọi phase trước.
- Hiệu năng, responsive UI — ngoài phạm vi, không có tool.
- 12 REQ còn 🟡 trong RTM (xem Mục 8) — chỉ code review, chưa có automated test riêng.
```

## FINAL VERDICT
PHASE 7B COMPLETE
