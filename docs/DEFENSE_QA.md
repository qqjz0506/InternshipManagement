# BỘ CÂU HỎI PHẢN BIỆN & ĐÁP ÁN

Mọi đáp án dựa trên code/tài liệu thật của dự án, có thể trình bày lại bằng lời riêng. Tham chiếu file khi cần tra sâu hơn.

## A. Lý do chọn đề tài và phạm vi

**1. Vì sao chọn đề tài quản lý thực tập tốt nghiệp?**
Đây là nhu cầu thực tế của mọi khoa/trường: phối hợp 4 bên (Sinh viên, Giảng viên, Doanh nghiệp, Admin/Khoa) qua giấy tờ/email rời rạc rất khó theo dõi tiến độ, dễ thất lạc đánh giá/báo cáo. Hệ thống số hóa toàn bộ quy trình này về 1 nơi, có phân quyền rõ ràng theo vai trò.

**2. Phạm vi dự án dừng ở đâu, vì sao không làm rộng hơn?**
Phạm vi: CRUD danh mục + hồ sơ nghiệp vụ, quy trình thực tập (đăng ký → phân công → thực tập → hoàn thành), nhật ký/báo cáo/đánh giá, thống kê, xuất Excel, tài khoản/phân quyền. Không làm: upload file thật, event-driven notification, refresh token, CSRF/rate limiting — xem Mục M (giới hạn) để biết lý do từng mục, đều là quyết định phạm vi có chủ đích, không phải thiếu sót do hết thời gian.

**3. Nguồn yêu cầu/đặc tả của dự án lấy từ đâu?**
Không có 1 văn bản đặc tả/use-case gốc độc lập — yêu cầu được tái dựng từ tên đề tài, thiết kế schema (`docs/DATABASE_DESIGN.md`), yêu cầu export do người hướng dẫn/bản thân xác định rõ, và business rule đã implement + kiểm chứng qua test thật. Toàn bộ truy vết nằm ở `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` — minh bạch ghi rõ "không có đặc tả gốc" ngay từ đầu tài liệu.

## B. Kiến trúc Frontend/Backend

**4. Vì sao chọn React + Vite (JavaScript) mà không dùng TypeScript?**
Quyết định phạm vi ban đầu: tối ưu thời gian làm đồ án, JavaScript đủ để triển khai toàn bộ nghiệp vụ. Trade-off: mất type-checking tĩnh, đổi lại bằng validate chặt ở backend (mọi field đều được kiểm tra kiểu/giá trị ở service layer trước khi ghi DB).

**5. Vì sao không dùng ORM (Sequelize/Prisma) mà dùng `mysql2` thuần?**
Để hiểu rõ và kiểm soát trực tiếp từng câu SQL — quan trọng với 1 hệ thống có nhiều business rule phụ thuộc trạng thái (ví dụ `ALLOWED_TRANSITIONS`, khóa field theo role) mà ORM generic khó diễn đạt rõ bằng convention. Trade-off: phải tự viết parameterized query tay (`?` placeholder), tự quản lý transaction khi cần (ví dụ tạo user + link profile).

**6. Kiến trúc tổng thể của hệ thống?**
```
Frontend (React) → apiClient.js (fetch + JWT Bearer) → Express routes
  → requireAuth (verify JWT) → requireRole (RBAC) → Controller (validate format)
  → Service (business rule + scopeService cho ownership/scope) → mysql2 (parameterized) → MariaDB
```
Chi tiết: `docs/ARCHITECTURE.md`.

**7. Vì sao tách Controller và Service riêng, không gộp chung?**
Controller chỉ lo định dạng HTTP (đọc `req`, trả `res`), Service chứa toàn bộ logic nghiệp vụ thuần (không biết gì về `req`/`res`) — giúp logic có thể test được độc lập (dù hiện tại test qua HTTP thật, không mock, nhưng cấu trúc này vẫn giữ ranh giới rõ cho khả năng mở rộng).

## C. React Context API và React Router

**8. Vì sao dùng Context API mà không dùng Redux/Zustand/React Query?**
Quy mô state của dự án (1 Context/entity, ví dụ `InternshipsContext`, `UsersContext`) không cần caching phức tạp hay time-travel debugging mà Redux hướng tới. Context API đủ cho nhu cầu: fetch 1 lần, giữ trong state, cung cấp hàm CRUD qua Provider.

**9. Vấn đề "Provider gọi API dù không có quyền" đã gặp và sửa thế nào?**
Phase 6A: `UsersProvider` ban đầu gọi `/api/users` ngay khi mount, không kiểm tra role — non-admin luôn nhận 403 (gây lãng phí request + nhiễu console). Sửa bằng cách tạo `createApiResourceContext(api, name, { shouldLoad })` — mỗi Provider tự khai báo điều kiện tải (mặc định: "đã đăng nhập"; `UsersProvider` override thành "chỉ khi role=admin"). Xem `docs/PHASE_6A_ROLE_AWARE_PROVIDER_LOADING.md`.

**10. `ProtectedRoute` có phải là lớp bảo mật thật không?**
**Không.** `ProtectedRoute` (`client/src/routes/ProtectedRoute.jsx`) chỉ là UX — ẩn/chuyển hướng trang cho gọn giao diện. Bảo mật thật nằm 100% ở backend (`requireAuth` + `requireRole` + `scopeService`) — kể cả khi ai đó sửa code frontend để bỏ qua `ProtectedRoute`, mọi request vẫn bị chặn đúng ở server nếu không đủ quyền.

## D. REST API

**11. Chuẩn response của API là gì?**
`{ success, message, data }` cho mọi endpoint, trừ 2 endpoint export trả file nhị phân (`.xlsx`) trực tiếp qua `Content-Type`/`Content-Disposition` header, không bọc JSON.

**12. Vì sao `/api/settings` lại có mismatch camelCase/snake_case?**
GET/PUT `/settings` trả nguyên `SELECT *` từ DB (snake_case: `system_name`...), nhưng `settingsService.update()` lại nhận body theo camelCase (`systemName`...) để khớp `AdminSettingsPage.jsx`. Đây là entity DUY NHẤT có mismatch 2 chiều này (phát hiện từ Phase 4E-3) — xử lý bằng 1 mapper duy nhất ở `client/src/api/settingsApi.js` (API boundary), không rải logic map rải rác trong component.

## E. JWT, bcrypt, RBAC và data scope

**13. JWT chứa gì, vì sao tối thiểu vậy?**
Payload chỉ có `{ sub: user.id, role: user.role }` (`server/services/authService.js`). Tối thiểu để giảm rủi ro: mọi request `requireAuth` đều **truy vấn lại DB** lấy thông tin user mới nhất (không tin role/thông tin cũ còn trong token nếu đã bị đổi ở DB giữa lúc token còn hạn) — trade-off là tăng 1 query DB mỗi request, đổi lại tính nhất quán.

**14. Mật khẩu lưu như thế nào?**
`bcryptjs` hash, không bao giờ lưu plaintext, không bao giờ trả `password`/`password_hash` trong bất kỳ response nào (kiểm chứng qua `tests/auth.test.js`, `tests/security.test.js`, `tests/users.test.js`).

**15. RBAC và Data-scope khác nhau thế nào, vì sao cần cả 2?**
RBAC (`requireRole`) chặn theo **route** (ví dụ chỉ Admin được gọi `POST /users`). Data-scope (`scopeService`) chặn theo **dữ liệu cụ thể** (ví dụ Lecturer được gọi `GET /internships` nhưng chỉ thấy hồ sơ mình phụ trách). Chỉ có RBAC thì 1 Lecturer vẫn gọi được API nhưng sẽ thấy dữ liệu của người khác nếu không có lớp scope — 2 lớp độc lập, không lớp nào thay thế lớp kia.

**16. `scopeService` hoạt động cụ thể ra sao?**
Với mỗi role, suy ra "hồ sơ của chính mình" từ `user_id` (ví dụ `getStudentProfile(currentUser.id)` → `students.id` tương ứng), rồi dùng chính `id` đó làm điều kiện `WHERE` trong mọi câu query — **không** bao giờ dùng giá trị từ query param/body của client để xác định phạm vi dữ liệu.

## F. IDOR và Field Injection

**17. IDOR là gì, dự án chống bằng cách nào?**
IDOR (Insecure Direct Object Reference) — truy cập tài nguyên người khác chỉ bằng cách đổi ID trên URL/body. Dự án chống bằng cách bỏ qua hoàn toàn ID định danh client tự gửi (`student_id`, `user_id`...) khi xác định phạm vi — luôn suy ra lại từ JWT. Ví dụ: Student A gọi `GET /internship-logs/3` (log của Student B) → 403, không phải 404 (tránh lộ việc tài nguyên có tồn tại hay không). Test: `server/tests/idor.test.js`, `internshipLogsAuthorization.test.js`.

**18. Field injection là gì, ví dụ cụ thể trong dự án?**
Gửi kèm field mà client không được phép set, hy vọng server "lỡ" ghi vào DB. Ví dụ: Student gửi `role=admin` khi đăng ký, hoặc gửi `lecturer_comment` khi tự tạo nhật ký. Dự án chặn bằng whitelist tường minh ở từng Service (ví dụ `LECTURER_EDITABLE_FIELDS`, `STUDENT_SELF_EDITABLE_FIELDS`) — field nào không trong whitelist bị **reject cứng (400/403)**, không silently bỏ qua (im lặng bỏ field lạ dễ che giấu lỗi, reject cứng buộc client sửa đúng). Test: `tests/fieldInjection.test.js`.

**19. Vì sao chọn "reject cứng" thay vì "silently ignore" field lạ?**
Silently ignore có thể che giấu bug ở phía client (client nghĩ đã gửi thành công 1 field nhưng thực ra bị âm thầm bỏ qua) và khó phát hiện khi test. Reject cứng buộc lỗi lộ ra ngay ở tầng tích hợp, dễ debug hơn.

## G. Thiết kế ERD, khóa ngoại và ON DELETE

**20. Vì sao `internship_logs`/`reports`/`evaluations` dùng `ON DELETE CASCADE` theo `internship_id`, còn `students`/`internships` lại `ON DELETE RESTRICT`?**
`internship_logs`/`reports`/`evaluations` là **weak entity** — không có ý nghĩa tồn tại độc lập nếu hồ sơ thực tập cha bị xóa, nên CASCADE là hợp lý (xóa cha thì xóa luôn con). Ngược lại, `internships.student_id`/`period_id`/`company_id`... dùng RESTRICT — **không cho xóa** 1 sinh viên/đợt/doanh nghiệp nếu còn hồ sơ thực tập tham chiếu, buộc người dùng xử lý thủ công trước (tránh xóa nhầm làm mất dấu lịch sử nghiệp vụ quan trọng).

**21. Vì sao `users.id` liên kết với 3 bảng profile (`students`/`lecturers`/`company_mentors`) lại dùng `ON DELETE SET NULL`?**
Nếu xóa 1 `user` (tài khoản đăng nhập), hồ sơ nghiệp vụ (ví dụ `students` record) **không nên bị xóa theo** — dữ liệu sinh viên vẫn còn giá trị nghiệp vụ dù mất tài khoản đăng nhập liên kết. SET NULL giữ nguyên record, chỉ gỡ liên kết `user_id`. (Lưu ý: hiện tại hệ thống **chưa có API xóa tài khoản** — REQ-010, xem Mục M — nên rule này hiện chưa có đường nào kích hoạt thật qua UI, nhưng vẫn đúng ở tầng thiết kế schema.)

**22. 1 user có thể liên kết với cả `students` và `lecturers` cùng lúc không?**
Không — `userService.assertUserCanLinkProfileType()` enforce: role của `user` phải khớp đúng loại hồ sơ định liên kết, và 1 user chỉ được liên kết với **đúng 1** loại hồ sơ (cross-profile uniqueness). Test: `tests/users.test.js`.

## H. Quan hệ Users với các profile

**23. Vì sao tách riêng `users` (đăng nhập) và `students`/`lecturers`/`company_mentors` (hồ sơ nghiệp vụ) thành bảng khác nhau?**
Tách concern: `users` chỉ lo xác thực (email/password/role), các bảng profile lo thông tin nghiệp vụ (mã số, khoa, công ty...). Lợi ích: có thể tạo hồ sơ nghiệp vụ trước khi có tài khoản đăng nhập (ví dụ nhập danh sách sinh viên từ Excel trước, cấp tài khoản sau), và 1 lần đổi email/password không ảnh hưởng dữ liệu nghiệp vụ.

**24. Admin tạo user mới thế nào, có đảm bảo atomic không?**
`userService.create()` tạo `users` record **và** liên kết `profile_id` vào đúng bảng profile tương ứng trong **1 transaction** — nếu bước nào lỗi (ví dụ profile không tồn tại, đã bị link) thì rollback toàn bộ, không để lại user "mồ côi" không có hồ sơ hoặc hồ sơ bị link sai. Xem `docs/API_PHASE_4F_1.md`.

## I. Internship Workflow

**25. Mô tả vòng đời trạng thái của 1 hồ sơ thực tập?**
```
pending → approved → in_progress → completed   (đường happy path)
pending → rejected → pending                    (từ chối, có thể nộp lại)
mọi trạng thái (trừ completed) → cancelled → pending
completed: trạng thái CUỐI, không chuyển đi đâu được nữa (kể cả Admin)
```
Định nghĩa chính xác: `server/utils/internshipStatus.js` (`ALLOWED_TRANSITIONS`), enforce ở `internshipService.update()`, test: `tests/internshipWorkflow.test.js`.

**26. Vì sao Student chỉ được sửa 3 field (`company_id`/`company_mentor_id`/`topic_id`) và chỉ khi còn `pending`/`approved`?**
Phản ánh đúng nghiệp vụ thật: sau khi đã `in_progress`, đổi công ty/mentor giữa chừng là bất thường (phải qua Admin xử lý thủ công nếu cần, không tự động qua API cho Student). Khóa theo trạng thái tránh Student tự ý đổi hồ sơ khi đã bắt đầu thực tập.

**27. Vì sao đổi `company_id` mà không gửi `company_mentor_id` mới thì bị chặn?**
Vì mentor hiện tại có thể không còn thuộc công ty mới → dữ liệu sẽ mâu thuẫn (`company_mentors.company_id` khác `internships.company_id`). Service kiểm tra: nếu đổi `company_id` mà mentor hiện tại không khớp công ty mới và client không gửi `company_mentor_id` mới kèm theo → 400, buộc client gửi đủ cả 2 field cùng lúc. Test: `tests/internshipWorkflow.test.js`.

## J. Nhật ký, báo cáo, đánh giá và công bố đánh giá

**28. Vì sao nhật ký bị khóa nội dung khi đã `reviewed`, còn báo cáo (Reports) thì không?**
Đây là khác biệt thiết kế **có chủ đích** đã xác nhận bằng code review (REQ-032): Nhật ký đại diện cho "ghi chép tại thời điểm", cần cố định sau khi Giảng viên đã xác nhận đọc — tránh sửa lại lịch sử. Báo cáo (`reports`) hiện tại **không có rule khóa tương tự** sau khi Lecturer duyệt — đây là hành vi thật của hệ thống, không phải thiếu sót bị bỏ quên, nhưng cũng là điểm có thể xem xét bổ sung nếu nghiệp vụ yêu cầu chặt hơn (đề xuất phát triển).

**29. Công bố đánh giá (`is_published`) hoạt động ra sao, vì sao là "một chiều"?**
Lecturer/Company Mentor bấm "Công bố" → `is_published: true`, Student lúc đó mới thấy được đánh giá của mình. Một chiều: Lecturer/Mentor **không** gỡ công bố được sau khi đã công bố (tránh việc công bố rồi rút lại gây tranh cãi với sinh viên) — chỉ Admin có quyền cả 2 chiều (xử lý sự cố nếu công bố nhầm). Test: `tests/businessRules.test.js`.

**30. Vì sao mỗi hồ sơ chỉ có tối đa 1 đánh giá cho mỗi `evaluator_role`?**
Ràng buộc `UNIQUE (internship_id, evaluator_role)` ở DB (`uk_evaluations_internship_role`) — đúng 1 đánh giá từ Lecturer và 1 từ Company cho mỗi hồ sơ, tránh trùng lặp/ghi đè không rõ ràng. Test: `tests/businessRules.test.js`, `tests/dbIntegrity.test.js`.

## K. Xuất Excel

**31. Vì sao chọn ExcelJS, chỉ làm `.xlsx` mà không làm PDF/CSV?**
Quyết định phạm vi chốt ở Phase 5: `.xlsx` đáp ứng đúng yêu cầu "xuất báo cáo" phổ biến nhất trong môi trường hành chính/giáo dục (mở trực tiếp bằng Excel, dễ lọc/tính toán thêm), còn PDF/CSV không được yêu cầu nên không làm thêm để giữ phạm vi gọn.

**32. Xuất Excel có đảm bảo đúng phân quyền/scope không?**
Có — endpoint export **tái sử dụng đúng logic scope** của endpoint GET tương ứng (`GET /internships`, `GET /evaluations`), không phải 1 đường logic riêng dễ lệch. Đặc biệt: export đánh giá (`evaluations.xlsx`) vẫn tôn trọng rule "Student không thấy đánh giá chưa công bố" — kiểm chứng qua `server/services/exportService.test.js`.

**33. Vì sao export chỉ có UI ở Admin?**
Quyết định phạm vi — ưu tiên hoàn thiện Admin trước (nơi cần tổng hợp số liệu nhiều nhất). Backend đã hỗ trợ đúng scope cho cả 4 role (test PASS), chỉ thiếu nút UI cho 3 role còn lại — ghi nhận minh bạch ở `docs/PHASE_7C_FINAL_PREPARATION.md` (REQ-045/046), không tự ý bổ sung thêm UI mới sát ngày bảo vệ để tránh rủi ro.

## L. Kiểm thử (215 test case backend + 13 Playwright E2E — xem README Mục 15 để lấy số mới nhất, số này có thể đổi theo phase)

**34. Tại sao dùng `node:test` built-in mà không dùng Jest/Mocha?**
Zero dependency mới — `node:test` + `node:assert/strict` đã có sẵn trong Node.js (từ bản 18+), đủ cho nhu cầu test HTTP integration của dự án, không cần thêm framework nặng.

**35. Test chạy như thế nào — có mock gì không?**
**Không mock gì cả.** Mỗi test file tự khởi động 1 instance Express thật (`startTestServer()`), đăng nhập bằng tài khoản seed thật để lấy JWT thật, gọi HTTP thật đến server đó, rồi tắt server (đóng cả HTTP server và connection pool MySQL) khi xong. Chạy trên **database test riêng** (`DB_NAME_TEST`, tạo/tái tạo bằng `npm run test:setup` — bổ sung ở đợt kiểm tra trước bảo vệ, xem README Mục 10/15), tách biệt khỏi database dev đang dùng để code/demo thủ công.

**36. Test có làm hỏng dữ liệu seed không?**
Không — mọi test có ghi/sửa dữ liệu đều bọc trong `try/finally`, khôi phục lại giá trị gốc (qua API nếu có thể, qua SQL trực tiếp nếu API tự chuẩn hóa dữ liệu theo cách không khôi phục được byte-exact — ví dụ `resolveOptionalText()` biến `''` thành `null`). Sau khi chạy xong `npm test`, `COUNT(*)` mọi bảng phải khớp đúng số liệu trước khi chạy — đã xác minh thủ công nhiều lần qua các phase. Riêng Playwright E2E (`npm run test:e2e`) KHÔNG tự dọn sau khi chạy (để lại 1 hồ sơ thực tập ở trạng thái `completed`) — tự `test:setup` lại database test ở lần chạy SAU, nên không ảnh hưởng gì nếu chạy lại; chỉ cần nhớ `test:setup` lại nếu muốn chạy `npm test` (backend) ngay sau `test:e2e`.

**37. Test case bao phủ những gì, KHÔNG bao phủ gì?**
Bao phủ: Auth, RBAC, IDOR/ownership, field injection, business rule (workflow trạng thái, khóa log/report/evaluation, công bố đánh giá, điểm tổng kết, múi giờ), Users invariants, Settings, Export, phân trang, thống kê, DB integrity, migration idempotent — VÀ (mới) browser E2E qua Playwright (`npm run test:e2e`, xem README Mục 15): đăng nhập 4 role, đăng ký thực tập, ghi nhật ký, upload báo cáo PDF thật, nhận xét/duyệt, chấm + công bố điểm, chuyển `completed`, xem điểm tổng kết, xuất Excel, khóa/mở tài khoản, badge thông báo. **Không bao phủ**: hiệu năng/tải (không có load test), responsive/mobile viewport, race condition đa tab, và vài nhánh phụ ít dùng của UI (ví dụ từ chối đề tài, hủy hồ sơ) — Playwright E2E hiện là smoke test luồng happy-path chính, không phải full regression suite UI.

## M. Các giới hạn hiện tại

**38. Hệ thống có gửi thông báo tự động khi có sự kiện nghiệp vụ không (ví dụ nộp báo cáo)?**
**Có** (bổ sung sau thời điểm câu hỏi này được viết lần đầu — Phase 4E-2 ban đầu chốt phạm vi KHÔNG làm, sau đó có yêu cầu bổ sung trực tiếp và đã triển khai). `notificationService.notify()` được gọi ngay sau khi nghiệp vụ chính thành công ở 5 service (đăng ký thực tập, đổi trạng thái hồ sơ, phân công giảng viên/mentor, đề xuất/duyệt đề tài, nộp nhật ký/báo cáo, nhận xét/duyệt, công bố đánh giá) — KHÔNG phải event engine/queue thật, chỉ 1 `INSERT` đơn giản chạy đồng bộ, lỗi ghi thông báo bị `console.error` và bỏ qua êm (không làm fail nghiệp vụ chính, nhưng không retry). Test: `server/tests/notifications.test.js`. Badge số chưa đọc ở Topbar tự refresh mỗi 30s.

**39. Báo cáo (Reports) có upload file thật không?**
**Có** (bổ sung sau thời điểm câu hỏi này được viết lần đầu — ban đầu `file_name` chỉ là text). Upload thật qua `multer` (disk storage, tên file lưu trên đĩa là `crypto.randomUUID()` + extension, tách biệt khỏi `file_name` gốc để hiển thị), chỉ nhận `.pdf`/`.doc`/`.docx`, tối đa 10MB (`server/config/upload.js`). Tải file về qua `GET /api/reports/:id/download`, cùng scope với xem báo cáo. Nộp lại khi bị từ chối bắt buộc kèm file mới (tự xóa file cũ). Giới hạn thật còn lại: lưu trực tiếp trên đĩa server (`server/uploads/reports/`), không phải object storage — chỉ phù hợp 1 server instance, không scale ngang được nếu không thêm storage dùng chung. Test: `server/tests/reportUpload.test.js`.

**40. Hệ thống có xóa/khóa tài khoản được không?**
**Khóa/mở khóa: có** (bổ sung sau thời điểm câu hỏi này được viết lần đầu) — `users.status` (`active`/`locked`), Admin khóa/mở qua `AdminAccountsPage.jsx` (`PUT /api/users/:id/status`-tương đương `setStatus`), có chặn tự khóa chính mình và khóa Admin cuối cùng còn active. Token cũ của tài khoản bị khóa cũng bị chặn NGAY (mọi request `requireAuth` tự query lại DB mỗi lần, không tin trạng thái cũ trong token). Admin cũng đặt được mật khẩu TẠM cho tài khoản khác (`PUT /api/users/:id/reset-password`), kèm cờ `users.must_change_password` bắt đăng nhập lần đó phải đổi mật khẩu ngay trước khi dùng hệ thống (`ProtectedRoute.jsx` chặn mọi route khác). **Xóa: vẫn chưa có** — quyết định có chủ đích từ Phase 4F-1 (REQ-010), không đổi. Test: `server/tests/accountSecurity.test.js`.

## N. Hướng phát triển

**41. Nếu có thêm thời gian, sẽ phát triển tiếp theo hướng nào?**
Các mục ưu tiên trước đó đã triển khai xong (UI export Excel cho Lecturer/Company Mentor, event-based Notifications, upload file thật cho Reports, Browser E2E qua Playwright — xem Mục M/18 README). Còn lại theo thứ tự ưu tiên hợp lý: (1) UI export Excel cho Student (backend đã sẵn sàng, chỉ thiếu nút UI); (2) Refresh token (`httpOnly` cookie, không phải `localStorage`) + CSRF protection + rate limiting đầy đủ hơn cho môi trường production; (3) Object storage (S3...) cho file báo cáo thay vì lưu trực tiếp trên đĩa server (chỉ phù hợp 1 instance); (4) Mở rộng Playwright E2E ra các nhánh phụ (từ chối đề tài, hủy hồ sơ, resubmit báo cáo) thay vì chỉ luồng happy-path chính; (5) Cache + read-replica nếu cần scale lên quy mô lớn hơn nhiều.

## O. Nhóm câu hỏi khó — Bảo mật / Database consistency / Test coverage / Giới hạn

**42. Nếu 2 request PUT cùng sửa 1 `internship` chạy đồng thời (race condition), hệ thống có bị lệch dữ liệu không?**
Mỗi `UPDATE` chạy trong 1 câu SQL đơn (không có transaction đa bước cho update thông thường), MySQL tự đảm bảo tính nguyên tử ở mức row cho 1 câu `UPDATE` — nhưng hệ thống **không** có optimistic locking (`version` field) hay transaction tường minh cho PUT thông thường, nên 2 request PUT gần như đồng thời với 2 bộ field khác nhau vẫn có thể "last write wins" theo đúng ngữ nghĩa SQL thường (không có conflict detection ở tầng ứng dụng). Đây là giới hạn thật, chấp nhận được với quy mô 1 hệ thống quản lý nội bộ, không phải hệ thống giao dịch tài chính cần serializable isolation.

**43. Vì sao JWT không có refresh token — rủi ro gì, và vì sao chấp nhận rủi ro đó?**
Rủi ro: hết hạn access token (`JWT_EXPIRES_IN=1d`) phải đăng nhập lại hoàn toàn, không có trải nghiệm "âm thầm cấp token mới". Chấp nhận vì đây là đồ án quy mô nhỏ, ưu tiên đơn giản hóa luồng auth hơn là trải nghiệm tối ưu — ghi nhận minh bạch là chưa làm, không giả vờ có.

**44. Response lỗi 500 có an toàn không — làm sao biết chắc không lộ stack trace?**
`server/middleware/errorHandler.js` (Phase 7B, fix finding F-03): mặc định **luôn an toàn** bất kể `NODE_ENV` — chỉ trả message chung cho lỗi không xác định (generic Error), trả message cụ thể cho `AppError` (lỗi nghiệp vụ có chủ đích, message đã được viết an toàn từ đầu). Muốn xem stack trace để debug phải bật tường minh `DEBUG_ERRORS=true` trong `.env` — mặc định tắt. Kiểm chứng qua `tests/errorHandling.test.js` (401/403/400/500 đều không lộ `stack`).

**45. Test case hiện có đủ để khẳng định hệ thống "không có lỗi" không?**
**Không.** Test tự động chỉ chứng minh **các hành vi đã được viết test** hoạt động đúng theo kỳ vọng — không chứng minh "không còn lỗi nào". Cụ thể: Playwright E2E hiện chỉ là smoke test luồng chính (không phải full regression UI), không có test tải/hiệu năng, không có fuzzing input, và vài nhánh logic frontend thuần ít dùng (ví dụ từ chối đề tài, hủy hồ sơ) chỉ được code-review/chưa có test tự động riêng. Trả lời trung thực: test suite bảo vệ tốt các business rule/bảo mật đã biết VÀ luồng UI chính, không phải bằng chứng toàn vẹn tuyệt đối.

**46. Nếu database bị mất kết nối giữa lúc xử lý request, hệ thống phản ứng ra sao?**
`mysql2` pool sẽ throw lỗi kết nối, rơi vào `errorHandler.js` như 1 exception không xác định (không phải `AppError`) → trả 500 với message chung, không lộ chi tiết lỗi kết nối DB (host/user/password) ra response — đã đúng theo thiết kế an toàn-mặc định của error handler, dù không có test tự động riêng cho tình huống mất kết nối DB giữa request (khó mô phỏng an toàn trong automated test).

**47. Giới hạn lớn nhất của kiến trúc hiện tại nếu scale lên hàng chục nghìn người dùng là gì?**
Vài điểm cần xem xét khi scale: (1) không có cache (mọi GET đều query DB trực tiếp); (2) pagination hiện chỉ có ở 4 endpoint list (`GET /students`, `/internships`, `/reports`, `/internship-logs` — opt-in qua `?page=&pageSize=`, tối đa 100 dòng/trang, xem `server/utils/pagination.js`), các endpoint danh mục khác (departments, companies, topics...) vẫn trả toàn bộ — hợp lý vì dữ liệu danh mục nhỏ, nhưng sẽ cần bổ sung nếu scale; (3) 1 connection pool `mysql2` duy nhất, không có read-replica; (4) JWT secret/cấu hình vẫn ở mức biến môi trường đơn giản, chưa có secrets manager. Đây đều là giới hạn hợp lý cho quy mô đồ án (seed ~14 sinh viên), không phải lỗi thiết kế, nhưng là điểm thật cần cải thiện nếu triển khai thật.

**48. JWT lưu ở `localStorage` phía client — rủi ro gì, vì sao vẫn chọn cách này?**
`client/src/api/apiClient.js` lưu access token ở `localStorage` (đọc/ghi qua `getToken()`/`setToken()`), gửi lại qua header `Authorization: Bearer <token>` mỗi request. Rủi ro lớn nhất: **XSS** — nếu kẻ tấn công chèn được JavaScript chạy trên trang (ví dụ qua 1 lỗ hổng render chưa được escape đúng), script đó đọc được `localStorage` trực tiếp và đánh cắp token, sau đó mạo danh người dùng gọi API với đúng quyền của họ cho đến khi token hết hạn (`JWT_EXPIRES_IN=1d`). Đây là rủi ro **đã biết, chấp nhận có chủ đích** cho quy mô đồ án — phương án an toàn hơn (`httpOnly` cookie, JS phía client không đọc được) cần đổi cách gửi token (cookie tự động kèm theo request, phải thêm CSRF protection vì cookie không tự miễn nhiễm CSRF như header `Authorization`) — đổi lại độ phức tạp lớn hơn so với lợi ích trong phạm vi 1 hệ thống nội bộ, không phải ứng dụng công khai diện rộng. Giảm thiểu rủi ro hiện có: React tự escape nội dung render (không dùng `dangerouslySetInnerHTML` ở bất kỳ đâu trong `client/src`), hạn chế bề mặt XSS thực tế dù chưa loại bỏ hoàn toàn khả năng lý thuyết.

**49. Vì sao hệ thống chưa có refresh token — có liên quan gì đến rủi ro XSS ở câu trên không?**
Chưa làm vì ưu tiên đơn giản hóa luồng auth cho quy mô đồ án (xem câu 43) — nhưng CÓ liên quan trực tiếp đến câu 48: nếu thêm refresh token mà vẫn lưu ở `localStorage` (cách dễ làm nhất), token đó bị đánh cắp qua XSS thì hậu quả **nặng hơn** access token thường (refresh token thường sống lâu hơn nhiều, bị đánh cắp 1 lần coi như chiếm quyền dài hạn) — nên nếu làm refresh token, bắt buộc phải làm ĐÚNG (refresh token ở `httpOnly` cookie riêng, access token ngắn hạn ở memory không phải `localStorage`), không thể làm nửa vời. Đây là lý do thứ 2 (ngoài lý do đơn giản ở câu 43) khiến việc này bị xếp sau trong hướng phát triển (xem Mục N) — làm sai còn rủi ro hơn không làm.

**50. Tách riêng RBAC (`requireRole`) và data-scope (`scopeService`) chống IDOR — nếu 1 attacker có token hợp lệ của CHÍNH HỌ, scope có chặn được họ đọc dữ liệu người khác không? Nếu token đó bị đánh cắp (câu 48) thì sao?**
2 tình huống khác nhau, scope giải quyết đúng 1 trong 2: (1) **Attacker là người dùng hợp lệ, tự đổi ID trên URL/body để dò dữ liệu người khác** (đúng định nghĩa IDOR, xem câu 17) — scope CHẶN ĐƯỢC, vì mọi điều kiện `WHERE` suy ra từ `user_id` trong JWT của chính attacker, không tin ID họ tự gửi. (2) **Attacker đánh cắp được token CỦA NGƯỜI KHÁC** (ví dụ qua XSS, câu 48) — scope **KHÔNG** chặn được, vì JWT đó hợp lệ và thuộc đúng nạn nhân, hệ thống không có cách phân biệt "đây là nạn nhân tự gọi" hay "đây là attacker cầm token nạn nhân" (JWT là bằng chứng danh tính duy nhất, không kèm theo kiểm tra thiết bị/IP). Kết luận: scope/IDOR protection là lớp chống **privilege escalation ngang giữa người dùng hợp lệ**, không phải lớp chống **token theft** — 2 lớp phòng vệ khác nhau, giải quyết 2 mối đe dọa khác nhau, không lớp nào thay thế lớp kia (đúng tinh thần câu 15 về RBAC vs data-scope, mở rộng thêm 1 lớp đe dọa nữa).

**51. Phân trang đã có ở API (`GET /students`, `/internships`, `/reports`, `/internship-logs`) nhưng UI chưa dùng — vì sao?**
Đợt kiểm tra trước bảo vệ bổ sung phân trang **optional** ở tầng API (`?page=&pageSize=`, tối đa 100 dòng/trang — xem README Mục 14, `server/utils/pagination.js`) — không truyền `page` thì giữ nguyên hành vi cũ (trả toàn bộ), nên hoàn toàn không phá bất kỳ trang UI nào đang gọi 4 endpoint này. Lý do UI chưa đổi sang dùng `page`/`pageSize`: (1) quy mô dữ liệu đồ án hiện tại nhỏ (seed ~14 sinh viên, ~12 hồ sơ thực tập) — tải toàn bộ 1 lần vẫn nhanh, chưa có áp lực hiệu năng thật để buộc phải đổi; (2) các trang danh sách hiện tại (`StudentsPage.jsx`, `InternshipsPage.jsx`...) đã có phân trang **phía client** (`Pagination.jsx`, cắt mảng đã tải sẵn theo trang) — đổi sang phân trang phía server đòi hỏi đổi lại cách Context quản lý state (không còn giữ "toàn bộ danh sách" trong bộ nhớ nữa, phải tải lại mỗi khi đổi trang/filter/sort) — là 1 thay đổi kiến trúc Context tương đối lớn, không làm vội trong đợt kiểm tra cuối trước bảo vệ để tránh rủi ro phá vỡ các trang đang hoạt động ổn định. Đây là quyết định phạm vi có chủ đích (API đã sẵn sàng + có test — `tests/pagination.test.js`), không phải thiếu sót — ghi nhận rõ ở `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` REQ-071 (🟡, API xong/UI chưa) và README Mục 18.

**52. Vì sao điểm tổng kết thực tập được CHỐT lúc hoàn thành (`completed`), thay vì luôn tính "sống" theo Settings hiện tại?**
2 lý do, cả 2 đều xuất phát từ việc coi "hoàn thành" là 1 mốc chính thức, không phải trạng thái tạm:

1. **Tính nhất quán theo thời gian (so sánh được giữa các khóa/đợt khác nhau)**: nếu luôn tính sống, 1 sinh viên hoàn thành thực tập năm nay với điểm 8.5 (trọng số 60/40) có thể thấy điểm đổi thành 7.9 vào năm sau chỉ vì Admin đổi trọng số cho đợt mới — dù không có gì thay đổi ở chính hồ sơ của sinh viên đó. Bảng điểm/giấy chứng nhận đã phát ra dựa trên điểm tại thời điểm hoàn thành sẽ không còn khớp với hệ thống — một dữ liệu đã "chốt sổ" (như điểm thi, bảng lương đã chi) không nên trôi theo cấu hình hiện tại.
2. **Nhất quán với các bất biến khác của hồ sơ `completed`** (xem Mục 16F `README.md`): hồ sơ đã hoàn thành đã bị khóa không cho sửa/xóa đánh giá, báo cáo tổng kết, phân công giảng viên/doanh nghiệp — vì các dữ liệu đó CHÍNH LÀ căn cứ đã dùng để cho phép hoàn thành. Nếu điểm tổng kết vẫn tính sống trong khi các input của nó đã bị khóa, đó là nửa vời: khóa dữ liệu nguồn nhưng không khóa luôn kết quả tính từ dữ liệu đó, vẫn có thể "trôi" mỗi khi Settings đổi — cùng 1 nguyên tắc "hoàn thành thì chốt", chỉ khác chỗ chốt là `internships.final_score`/`final_classification` thay vì bảng `evaluations`.

Cơ chế: `internshipService.update()` gọi `evaluationService.computeFinalResult()` NGAY TRƯỚC KHI ghi `status='completed'` vào DB (lúc đó `computeFinalResult()` vẫn tính "sống" vì status trong DB lúc đó còn là `in_progress`), rồi ghi cả `status` lẫn `final_score`/`final_classification` trong CÙNG 1 câu `UPDATE` — không có khoảng hở nào giữa "đã completed" và "đã có điểm chốt". Từ sau đó, `computeFinalResult()` luôn ưu tiên đọc giá trị đã chốt nếu `status='completed'` và `final_score` khác `NULL`, không tính lại. Test: `server/tests/completedInvariants.test.js` (đổi trọng số 90/10 sau khi hoàn thành, verify điểm không đổi).
