# PHASE 7A — FINAL SYSTEM AUDIT & REQUIREMENT TRACEABILITY

> **Ghi chú (đợt kiểm tra trước bảo vệ, sau nhiều phase mới):** Mọi con số trong tài liệu này (số test, số REQ, danh sách giới hạn...) là **số liệu tại thời điểm Phase 7A**, không phải hiện trạng mới nhất — hệ thống đã có thêm nhiều tính năng/test kể từ đó (thông báo tự động, upload file thật, điểm tổng kết, phân trang, thống kê server-side, database test riêng, Playwright E2E...). Xem `README.md` Mục 15/18/19 và `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` để lấy số liệu/trạng thái hiện hành — tài liệu này giữ nguyên làm bản ghi lịch sử của Phase 7A, không chỉnh sửa lại nội dung bên dưới.

## 1. Executive Summary

Hệ thống đã triển khai đầy đủ vòng đời nghiệp vụ chính (đăng ký → phân công → đề tài → nhật ký → báo cáo → đánh giá → thông báo → thống kê → xuất Excel) cho cả 4 vai trò, với backend enforce RBAC + ownership/scope độc lập khỏi frontend, và một bộ automated regression test thật (86/86 PASS) bảo vệ Auth/RBAC/IDOR/field-injection/business rule/DB integrity. Không phát hiện lỗ hổng bảo mật nghiêm trọng (P0) hay nghiệp vụ cốt lõi bị hỏng (P1) trong lần audit này. Các vấn đề phát hiện (4 P2, 3 P3) đều là giới hạn đã biết từ trước hoặc phát hiện mới mang tính cosmetic/UX/process — không có vấn đề nào ngăn cản việc demo hoặc bảo vệ đồ án.

**Kết luận: READY WITH CONDITIONS** — xem Mục 13.

## 2. Phạm vi kiểm toán và giới hạn

```
Phạm vi: toàn bộ client/, server/, docs/ — đối chiếu tài liệu Phase 1-6C với code thực tế, chạy lại
  test suite, lint, build, và truy vấn DB chỉ-đọc.
Giới hạn:
  - Không có browser automation tool → Browser E2E: CHƯA XÁC MINH trong phase này (và mọi phase
    trước — nhất quán, không phải thiếu sót riêng của Phase 7A).
  - Không chạy thêm test HTTP mutating mới ngoài test suite đã có sẵn (đúng nguyên tắc "không chạy
    test có khả năng phá hủy dữ liệu" — mục 2.10 đề bài) — các REQ chưa có automated test được đánh
    giá qua code review, ghi rõ 🟡 thay vì giả vờ đã test.
  - Không tìm thấy tài liệu đặc tả/use-case gốc độc lập trong repo — yêu cầu nghiệp vụ trong
    REQUIREMENT_TRACEABILITY_MATRIX.md được tái dựng từ tên đề tài + DATABASE_DESIGN.md + yêu cầu
    export do người dùng nêu rõ ở Phase 5 + business rule đã implement (ghi rõ nguồn từng REQ).
```

## 3. Kiến trúc thực tế đã xác minh

Đối chiếu `docs/ARCHITECTURE.md` với code thật — **khớp, không phát hiện mâu thuẫn**:
```
React 19 + Vite + JavaScript + React Router + Context API (KHÔNG Redux/Zustand/React Query — xác
  nhận qua package.json: chỉ react, react-dom, react-router-dom)
Node.js + Express + mysql2 (không ORM) + JWT (jsonwebtoken) + bcryptjs
JWT → requireAuth → requireRole → Controller → Service/scopeService → MySQL — xác nhận đúng cấu
  trúc này ở toàn bộ 17 route file (health, auth, departments, students, lecturers, companies,
  company-mentors, internship-periods, topics, internships, internship-logs, reports, evaluations,
  notifications, settings, users, exports)
```

## 4. Danh sách yêu cầu nghiệp vụ & 5. Ma trận truy vết

Xem file riêng: **[`docs/REQUIREMENT_TRACEABILITY_MATRIX.md`](REQUIREMENT_TRACEABILITY_MATRIX.md)** — 50 REQ, chia theo 13 domain (A–M). Tổng hợp: ✅ 24, 🟡 17, ⬜ 7 (gồm 2 "chưa triển khai có chủ đích theo thiết kế" + 1 "chưa triển khai thật" [Report file storage] + 1 "chưa xác minh" [Browser E2E] + các mục còn lại), N/A 2.

## 6. Ma trận chức năng theo vai trò

| Vai trò | Chức năng | Có UI | Gọi API thật | API check quyền | API check scope | Test | Browser verified |
|---|---|---|---|---|---|---|---|
| **Admin** | Quản lý tài khoản | ✅ | ✅ | ✅ (`requireRole('admin')`) | N/A (admin toàn quyền) | ✅ auto | ❌ |
| | Quản lý Khoa/Đợt/Đề tài/Doanh nghiệp/Mentor | ✅ | ✅ | ✅ | N/A | ✅ auto (smoke) | ❌ |
| | Quản lý hồ sơ thực tập (workflow, phân công) | ✅ | ✅ | ✅ | N/A | 🟡 code review | ❌ |
| | Thống kê | ✅ | ✅ (tái dùng Context đã load) | N/A | N/A | 🟡 code review | ❌ |
| | Xuất Excel | ✅ | ✅ | ✅ | N/A | ✅ auto (`exportService.test.js`) | ❌ |
| | Cài đặt hệ thống | ✅ | ✅ | ✅ | N/A | 🟡 (GET auto, PUT code review) | ❌ |
| **Student** | Xem/sửa hồ sơ cá nhân (field giới hạn) | ✅ | ✅ | ✅ | ✅ (chính mình + field whitelist) | 🟡 code review | ❌ |
| | Đăng ký thực tập | ✅ | ✅ | ✅ (admin+student only) | ✅ (ép `student_id`) | 🟡 code review | ❌ |
| | Xem hồ sơ thực tập của mình | ✅ | ✅ | ✅ | ✅ | ✅ auto (`idor.test.js`) | ❌ |
| | Ghi nhật ký | ✅ | ✅ | ✅ | ✅ (chính mình, status-gated) | 🟡 code review | ❌ |
| | Nộp báo cáo | ✅ | ✅ | ✅ | ✅ | ✅ auto (`businessRules.test.js`) | ❌ |
| | Xem đánh giá đã công bố | ✅ | ✅ | ✅ | ✅ (chỉ published) | ✅ auto (`idor.test.js`, `exportService.test.js`) | ❌ |
| | Xem thông báo | ✅ | ✅ | ✅ | ✅ | ✅ auto (`idor.test.js`) | ❌ |
| | Xuất dữ liệu | ❌ (không có nút UI) | ✅ (backend hỗ trợ) | ✅ | ✅ | ✅ auto (service-level) | ❌ |
| **Lecturer** | Xem sinh viên/hồ sơ phụ trách | ✅ | ✅ | ✅ | ✅ | ✅ auto (`idor.test.js`) | ❌ |
| | Duyệt/từ chối đề tài (scoped, status-only) | ✅ | ✅ | ✅ | ✅ | ✅ auto (`fieldInjection.test.js`) | ❌ |
| | Nhận xét nhật ký | ✅ | ✅ | ✅ | ✅ | 🟡 code review (lock test gián tiếp qua `businessRules.test.js`) | ❌ |
| | Duyệt báo cáo | ✅ | ✅ | ✅ | ✅ | 🟡 code review | ❌ |
| | Đánh giá + công bố (một chiều) | ✅ | ✅ | ✅ | ✅ | ✅ auto (`businessRules.test.js`) | ❌ |
| | Xem thông báo | ✅ | ✅ | ✅ | ✅ | ✅ auto | ❌ |
| | Xuất dữ liệu | ❌ | ✅ (backend) | ✅ | ✅ | ✅ auto (service-level) | ❌ |
| **Company Mentor** | Xem hồ sơ được phân công | ✅ | ✅ | ✅ | ✅ | ✅ auto (`idor.test.js`) | ❌ |
| | Nhận xét nhật ký/báo cáo | ✅ | ✅ | ✅ | ✅ | 🟡 code review | ❌ |
| | Đánh giá + công bố (một chiều) | ✅ | ✅ | ✅ | ✅ | ✅ auto (cùng cơ chế Lecturer, đã test role `lecturer`; role `company` dùng chung code path, chưa có test tên riêng) | ❌ |
| | Xem thông báo | ✅ | ✅ | ✅ | ✅ | ✅ auto | ❌ |
| | Xuất dữ liệu | ❌ | ✅ (backend) | ✅ | ✅ | ✅ auto (service-level) | ❌ |

**Không có chức năng nào được đánh dấu ✅ chỉ vì có UI** — mọi dòng ✅ đều có bằng chứng API+scope+test thật tương ứng.

## 7. Kết quả kiểm toán API và bảo mật

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Middleware xác thực đúng route | ✅ PASS | Đọc 17 route file — mọi route trừ `health`/`auth/login` có `requireAuth` |
| RBAC đúng chính sách | ✅ PASS | `tests/rbac.test.js` (5 test) |
| Ownership/scope | ✅ PASS | `tests/idor.test.js` (9 test, set-intersection động) |
| IDOR | ✅ PASS | Như trên + query-param override test |
| Field injection | ✅ PASS | `tests/fieldInjection.test.js` (6 test) + `tests/users.test.js` |
| Validation đầu vào | 🟡 Code review | `server/utils/validators.js` đọc kỹ, chưa test exhaustive mọi input biên qua HTTP |
| Parameterized SQL | ✅ PASS | Đọc toàn bộ `*.execute()` trong `server/services/` — 100% dùng `?` placeholder; chuỗi SQL nội suy (table name) chỉ từ hằng số nội bộ, không bao giờ từ input người dùng |
| SQL injection smoke | ✅ PASS | `tests/security.test.js` (2 test — chuỗi `' OR 1=1 --` không crash, không bypass scope) |
| Không trả password/password_hash/JWT | ✅ PASS | `tests/auth.test.js`, `tests/security.test.js`, `tests/users.test.js` |
| Khóa nhật ký đã reviewed | ✅ PASS | `tests/businessRules.test.js` (3 test) |
| Khóa đánh giá đã công bố | ✅ PASS | `tests/businessRules.test.js` (2 test) |
| Quy tắc tài khoản/liên kết hồ sơ | ✅ PASS | `tests/users.test.js`, `tests/dbIntegrity.test.js` |
| FK/ON DELETE | 🟡 Code review | Đọc `schema.sql` — chưa test thực tế hành vi xóa (vì không có API xóa User/Department đang có FK tham chiếu để test an toàn) |
| Error response production-style | ⚠️ **PHÁT HIỆN** | Xem Finding F-03 — `NODE_ENV` không được set ở `.env`/`.env.example`, nên `err.stack` **đang** được trả về trong mọi response lỗi ở môi trường hiện tại (không phải "có khả năng", mà là hành vi ĐANG xảy ra) |
| Export áp dụng scope/filter đúng | ✅ PASS | `exportService.test.js` (6 test) + Manual HTTP (Phase 5) |

## 8. Kết quả kiểm toán database

```
14/14 bảng, 19/19 FK — xác nhận bằng information_schema (không dùng TABLE_ROWS estimate)
Row count mọi bảng khớp baseline đã ghi nhận xuyên suốt Phase 4E-3 → 7A (xem Evidence Log mục 2)
Không orphan FK (students→departments, internships→students/periods, logs/evaluations→internships,
  notifications→users) — xác nhận qua tests/dbIntegrity.test.js
Không user bị link chéo nhiều loại profile — xác nhận qua tests/dbIntegrity.test.js
Users ↔ Students/Lecturers/CompanyMentors: quan hệ 1:0..1 qua user_id (nullable, ON DELETE SET NULL)
  — đúng thiết kế "tài khoản" và "hồ sơ nghiệp vụ" là 2 khái niệm tách biệt
Companies ↔ Company Mentors: 1:N qua company_id (NOT NULL, ON DELETE RESTRICT)
Internships (bảng trung tâm) ↔ Student/Period (NOT NULL, RESTRICT), Company/Mentor/Lecturer/Topic
  (nullable, RESTRICT khi có giá trị)
Evaluations: evaluator suy từ internship.lecturer_id/company_mentor_id qua evaluator_role — KHÔNG
  có cột evaluator_id (xác nhận đúng quyết định kiến trúc đã chốt từ Phase 3B/4E-1, không mâu thuẫn)
Settings: đúng single-row (CHECK id=1), xác nhận qua tests/crudSmoke.test.js
Dữ liệu seed nhất quán với mọi tài liệu phase trước — không phát hiện lệch field frontend/backend
  mới nào ngoài các mismatch đã biết (xem Mục 10)
```

## 9. Kết quả kiểm thử

```
Backend: npm test → 86/86 PASS, 0 fail, 0 skip (chạy thật, log đầy đủ ở Evidence Log mục 3)
Frontend: npm run lint → 40 warning (baseline không đổi); npm run build → 192 modules, 0 lỗi
Frontend logic test: providerAccess.test.js (3 test, Phase 6A) — không chạy lại trong phase này vì
  không đổi code liên quan, không có rủi ro regression
Health: GET /api/health + /api/health/db → PASS (sau khi khởi động lại MariaDB — xem Evidence Log mục 1)
Database integrity: PASS (mục 8)
Browser verification: CHƯA XÁC MINH (không có tool)
```
Domain có automated test: Auth, RBAC, IDOR (Internship/Log/Evaluation/Notification), Field injection (Internship/Evaluation/Topic/Users), Business rule (Log lock, Report submitted_at, Evaluation score/unique/publish-lock), Users invariants, Export, DB integrity, SQL injection/JWT tampering smoke.
Domain CHỈ có GET smoke test hoặc chưa có test: Departments/Lecturers/Companies/CompanyMentors/InternshipPeriods/Topics/InternshipLogs/Reports/Evaluations/Notifications/Users/Settings ở chiều GET list (`tests/crudSmoke.test.js`) — các domain này có mutation logic (POST/PUT) được code-review nhưng KHÔNG có automated test riêng ngoài các case đã liệt kê ở trên.
Tình huống CHƯA được bao phủ bởi automated test: form validation chi tiết ở frontend, loading/error state hiển thị đúng trên UI thật, hành vi sau logout thật trên UI, route guard thật trên browser, responsive UI, mở file Excel đã tải để xem bằng mắt, thao tác end-to-end theo từng vai trò trên UI thật.

## 10. Phát hiện (Findings)

### F-01 — P2 — Admin-only export UI dù backend hỗ trợ đủ 4 role
**Mô tả:** `AdminStatisticsPage.jsx` là nơi DUY NHẤT có nút "Xuất thông tin thực tập"/"Xuất đánh giá". Backend (`GET /api/exports/*.xlsx`) đã scope đúng cho cả Student/Lecturer/Company Mentor (xác nhận qua `exportService.test.js`), nhưng không có nút UI nào ở 3 role đó.
**Bằng chứng:** `grep "exportApi|Xuất" client/src/pages/**` → chỉ 1 file.
**Tác động:** Không phải lỗi, nhưng nếu giảng viên hỏi "Sinh viên tự xuất được hồ sơ của mình không?" → câu trả lời đúng là "Backend có, UI chưa" — cần chuẩn bị trước.
**Tái hiện:** Đăng nhập Student, không thấy nút export ở bất kỳ trang nào.
**Khuyến nghị:** Ghi nhận rõ trong tài liệu (đã làm ở README/ARCHITECTURE); có thể thêm UI cho 3 role còn lại ở Phase 7B nếu cần demo đủ.
**Phạm vi ảnh hưởng:** UX, không ảnh hưởng bảo mật/dữ liệu.
**Cần sửa trước bảo vệ:** Không bắt buộc — chuẩn bị câu trả lời là đủ.

### F-02 — P2 — Reports không có file upload/storage thật
**Mô tả:** `reports.file_name` là cột TEXT do Student tự nhập (vd. "bao-cao-tuan-3.pdf"), không có cơ chế lưu trữ file nhị phân nào trong hệ thống.
**Bằng chứng:** `server/db/schema.sql` (reports.file_name VARCHAR), `ReportFormModal.jsx` (input text, không phải `<input type="file">`).
**Tác động:** Nếu giảng viên yêu cầu "mở file báo cáo đã nộp" → không có file thật để mở.
**Tái hiện:** Nộp báo cáo, xem lại — chỉ thấy tên file dạng text, không có link tải/xem.
**Khuyến nghị:** Nêu rõ đây là giới hạn phạm vi đã biết (đã ghi trong README Mục 18) khi thuyết trình; không phải bug, là quyết định phạm vi.
**Phạm vi ảnh hưởng:** Tính năng Reports.
**Cần sửa trước bảo vệ:** Không — ngoài phạm vi audit, cần feature mới thật (Phase 7B nếu muốn).

### F-03 — P2 — `err.stack` bị lộ trong response lỗi ở môi trường hiện tại
**Mô tả:** `server/middleware/errorHandler.js` chỉ ẩn `err.stack` khi `process.env.NODE_ENV === 'production'`. `NODE_ENV` KHÔNG được set ở bất kỳ đâu (`.env`, `.env.example`) — nghĩa là trong cấu hình chạy hiện tại, mọi response lỗi (400/401/403/404/409/500) đều trả kèm full stack trace (đường dẫn file tuyệt đối, số dòng).
**Bằng chứng:** đọc `errorHandler.js` dòng 7, 13; grep `NODE_ENV` trên `server/.env*` → 0 kết quả. Đã quan sát thấy stack trace thật trong response ở các lần test Phase 6B/7A (không trích dẫn nội dung cụ thể vào tài liệu này).
**Tác động:** Information disclosure — lộ cấu trúc thư mục server, tên file/hàm nội bộ. Không lộ password/secret. Mức độ hạn chế vì đây là môi trường demo/local, nhưng là hành vi ĐANG XẢY RA, không phải lý thuyết.
**Tái hiện:** Gọi bất kỳ request lỗi nào (vd. thiếu token) → xem response body, có field `error` chứa stack trace.
**Khuyến nghị:** Set `NODE_ENV=production` khi demo/deploy thật, hoặc sửa `errorHandler.js` để mặc định ẩn stack trừ khi có cờ debug tường minh. Đây là sửa nhỏ, rủi ro thấp — có thể làm ở Phase 7B.
**Phạm vi ảnh hưởng:** Toàn bộ API, mọi response lỗi.
**Cần sửa trước bảo vệ:** Khuyến nghị có, nhưng không bắt buộc (môi trường demo local, không public).

### F-04 — P2 — Nhiều REQ nghiệp vụ core chưa có automated test
**Mô tả:** 17/50 REQ trong RTM ở trạng thái 🟡 ("Code review only" hoặc "Manual HTTP không lặp lại được") — bao gồm cả vài luồng quan trọng (Student tự sửa hồ sơ, workflow trạng thái Internship, phân công Lecturer/Company/Mentor/Topic, nhận xét Log/Report của Lecturer/Mentor).
**Bằng chứng:** Xem cột "Test"/"Trạng thái" trong `REQUIREMENT_TRACEABILITY_MATRIX.md`.
**Tác động:** Rủi ro quy trình — nếu Phase 7B/sau này vô tình sửa 1 trong các luồng này, automated suite hiện tại (86 test) sẽ KHÔNG bắt được regression.
**Khuyến nghị:** Bổ sung test cho các REQ 🟡 quan trọng nhất trước (workflow Internship, phân công, field-whitelist Log/Report theo role) ở Phase 7B — đã có đủ pattern/helper từ Phase 6B để tái sử dụng.
**Phạm vi ảnh hưởng:** Quy trình kiểm thử, không phải lỗi hiện tại.
**Cần sửa trước bảo vệ:** Không bắt buộc.

### F-05 — P3 — Ô tìm kiếm trên Topbar bị disable vĩnh viễn
**Mô tả:** `client/src/components/layout/Topbar.jsx` dòng 18: `<input type="text" placeholder="Tìm kiếm..." disabled />` — hiển thị trên MỌI trang, MỌI vai trò, nhưng không bao giờ hoạt động (không có handler, không có state).
**Bằng chứng:** đọc trực tiếp `Topbar.jsx`.
**Tác động:** UI có yếu tố nhìn-thấy-nhưng-không-chạy — giảng viên có thể click thử và nhận ra ngay.
**Khuyến nghị:** Xóa input này hoặc thêm chú thích rõ "Sắp ra mắt" nếu muốn giữ placeholder cho tương lai.
**Phạm vi ảnh hưởng:** Toàn bộ layout (mọi trang).
**Cần sửa trước bảo vệ:** Nên sửa nếu có thời gian (rủi ro thấp, sửa nhanh) — không bắt buộc.

### F-06 — P3 — `AccountDetailModal` đọc sai field (`linkedLabel` vs `label`)
**Mô tả:** `AccountDetailModal.jsx` đọc `account.linkedLabel`, nhưng `AdminAccountsPage.jsx` spread field tên `label` vào row — dòng "Đối tượng liên kết" trong modal chi tiết tài khoản luôn hiển thị rỗng (`undefined`).
**Bằng chứng:** `AccountDetailModal.jsx` dòng 21 (`account.linkedLabel`) đối chiếu `AdminAccountsPage.jsx` dòng 181 (`row.label`) — đã xác nhận lại trong Phase 7A, KHÔNG được sửa ở Phase 4F-2/6C như ghi nhận trước đó (vẫn tồn tại).
**Tác động:** Cosmetic — 1 field hiển thị rỗng trong 1 modal.
**Khuyến nghị:** Đổi `account.linkedLabel` → `account.label` (sửa 1 dòng, rủi ro gần như 0).
**Phạm vi ảnh hưởng:** `AdminAccountsPage` → "Xem chi tiết".
**Cần sửa trước bảo vệ:** Nên sửa nếu có thời gian — sửa rất nhanh, không rủi ro.

### F-07 — P3 — Dead code: `client/src/data/*.js` (12 file) + `PlaceholderPage.jsx`
**Mô tả:** 12 file mock data cũ (`students.js`, `companies.js`, `topics.js`...) không còn được import ở bất kỳ đâu (xác nhận lại qua grep trong Phase 7A — vẫn đúng như Phase 6C ghi nhận). `PlaceholderPage.jsx` cũng không được route nào trong `App.jsx` tham chiếu tới.
**Bằng chứng:** grep "from '../data/<entity>'" → 0 kết quả; grep "PlaceholderPage" → chỉ chính file đó.
**Tác động:** Không ảnh hưởng hành vi runtime — chỉ là rác mã nguồn.
**Khuyến nghị:** Xóa ở Phase 7B nếu muốn dọn dẹp trước khi nộp báo cáo cuối.
**Phạm vi ảnh hưởng:** Không.
**Cần sửa trước bảo vệ:** Không bắt buộc.

### Tổng hợp mức độ
```
P0 - Critical: 0
P1 - High:     0
P2 - Medium:   4  (F-01, F-02, F-03, F-04)
P3 - Low:      3  (F-05, F-06, F-07)
```

## 11. Demo readiness

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Khởi động theo README | ✅ đã verify lại đúng các bước (cài đặt, `.env`, schema/seed, `npm run dev` × 2) | MariaDB cần khởi động thủ công trước (XAMPP không tự chạy — đã gặp 3 lần xuyên suốt Phase 6A/6B/7A, không phải lỗi code) |
| Tài khoản demo đủ 4 vai trò | ✅ | `docs/API_PHASE_3A.md` mục 9, trích lại nguyên văn ở README Mục 13 |
| Luồng demo hoàn chỉnh mỗi vai trò | 🟡 | Logic đầy đủ qua code+API, **chưa click-through trình duyệt thật** để xác nhận trải nghiệm cuối |
| Demo tạo hồ sơ/nhật ký/báo cáo/đánh giá đúng business rule | 🟡 | Đã verify qua HTTP thật (nhiều phase) + automated test, chưa qua UI thật |
| Demo xuất Excel + mở file kiểm tra | ✅ | Đã verify qua automated test + Manual HTTP (Phase 5) — file hợp lệ, đúng dữ liệu, đúng tiếng Việt |
| Thông báo lỗi dễ hiểu khi API lỗi | 🟡 | Message tiếng Việt rõ nghĩa (tốt), NHƯNG kèm stack trace kỹ thuật (xem F-03) — nếu Admin/giảng viên vô tình thấy response raw (vd. qua DevTools) sẽ thấy cả 2 |
| Giảng viên đổi ID/đăng nhập vai trò khác để thử bẻ | ✅ | Chính xác đây là test suite đã làm — `idor.test.js` 9 test đều PASS, không lộ dữ liệu |
| Chức năng nhìn thấy nhưng chưa hoàn chỉnh | ⚠️ | Topbar search (F-05); Export UI chỉ Admin (F-01); Report "file" chỉ là text (F-02) |

## 12. Các giới hạn chưa xác minh

```
- Browser E2E (click-through thật) — CHƯA XÁC MINH, không có tool, nhất quán với mọi phase trước.
- Hiệu năng dưới tải nhiều user đồng thời — CHƯA XÁC MINH, ngoài phạm vi.
- Trải nghiệm responsive/mobile — CHƯA XÁC MINH, chỉ đọc CSS.
- Một số validation input biên (regex phone/email chi tiết) — chỉ code review, chưa test exhaustive.
- Hành vi ON DELETE thật với dữ liệu có FK tham chiếu (vd. xóa Department đang có Student) — chỉ đọc
  schema, chưa test thật (tránh rủi ro mutate dữ liệu ngoài kế hoạch).
```

## 13. Kết luận

```
READY WITH CONDITIONS
```

Hệ thống sẵn sàng để demo và bảo vệ, với điều kiện:
1. Chuẩn bị câu trả lời cho F-01/F-02 (export admin-only, report không có file thật) nếu giảng viên hỏi.
2. Cân nhắc fix nhanh F-03 (ẩn err.stack) trước buổi bảo vệ nếu có thời gian — rủi ro thấp, giá trị cao.
3. Không có vấn đề P0/P1 nào — không có lý do kỹ thuật để trì hoãn demo.

## 14. Kế hoạch đề xuất Phase 7B

```
Ưu tiên 1 (P2, rủi ro thấp, giá trị cao): Fix F-03 (err.stack) + F-06 (AccountDetailModal field) —
  2 thay đổi nhỏ, gần như 0 rủi ro regression.
Ưu tiên 2 (P2, process): Bổ sung automated test cho các REQ 🟡 quan trọng nhất (workflow Internship
  status transition, phân công Lecturer/Company/Mentor, field-whitelist Log/Report theo role) — tái
  dùng helper có sẵn từ Phase 6B.
Ưu tiên 3 (P3, cleanup, tùy thời gian): F-05 (Topbar search), F-07 (dead code).
Không đề xuất: thêm event engine Notifications, thêm file upload Reports, thêm export UI cho 3 role
  còn lại — đều là feature mới, ngoài phạm vi "audit → fix nhỏ", cần quyết định riêng của người dùng
  trước khi làm (không tự mở rộng scope).
```
