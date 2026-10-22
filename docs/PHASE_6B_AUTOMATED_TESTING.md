# PHASE 6B — Automated Backend Regression Test Foundation

> **Ghi chú (đợt kiểm tra trước bảo vệ, sau nhiều phase mới):** Mọi con số trong tài liệu này là **số liệu tại thời điểm Phase 6B**, không phải hiện trạng mới nhất — test suite từ phase này đã chạy trên database dev thật; từ đợt kiểm tra trước bảo vệ, test suite chạy trên **database test riêng** (`DB_NAME_TEST`, xem README Mục 10/15). Xem `README.md` Mục 15/18/19 để lấy số liệu/trạng thái hiện hành.

## 1. Goal
Xây dựng một backend regression test suite tự động, lặp lại được, chạy bằng 1 command duy nhất (`npm test` trong `server/`), bảo vệ Authentication/RBAC/IDOR/business rules/security invariants/export — để phase sau vô tình phá 1 trong các rule này sẽ bị bắt ngay, không cần test tay lại toàn bộ từ đầu.

## 2. Existing testing state before Phase 6B
```
server/services/exportService.test.js   — 6 test (node:test), service-level, Phase 5
client/src/context/providerAccess.test.js — 3 test (node:test), pure-logic, Phase 6A
Không có test HTTP/integration nào ở backend. Không có test cho Auth/RBAC/IDOR/field-injection/
business rules/Users invariants/DB integrity — toàn bộ các mảng này trước đây CHỈ được test thủ công
qua curl ở mỗi phase, không có suite re-run được.
```

## 3. Test architecture
```
server/tests/helpers/testServer.js  — start app.js THẬT (không mock) qua app.listen(0) (ephemeral
  port), trả {baseUrl, close()}. close() gọi server.closeAllConnections() + server.close() + pool.end()
  — bắt buộc phải end() pool vì require('../../app') nạp toàn bộ routes->controllers->services->
  config/database, tạo mysql2 pool NGAY LÚC REQUIRE dù file test không dùng helpers/db.js — nếu không
  end() pool, process con của `node --test` không bao giờ tự exit (xem mục 15 — sự cố đã gặp và sửa).
server/tests/helpers/http.js        — apiRequest(baseUrl, method, path, {token, body}) dùng fetch()
  built-in (Node 24) — không axios/supertest.
server/tests/helpers/auth.js        — SEED_ACCOUNTS (tài khoản seed THẬT, xem docs/API_PHASE_3A.md
  mục 9) + loginAs()/loginAll() qua HTTP thật.
server/tests/helpers/db.js          — pool, tableCount(), foreignKeyCount(), rowCount(table) — dùng
  cho smoke test DB integrity và verify "không ghi DB" ở các test field-injection/business rule.
server/tests/*.test.js              — 9 file test HTTP integration (node:test), xem mục 13.
server/services/exportService.test.js — GIỮ NGUYÊN (Phase 5), đưa vào cùng command test thống nhất.
```
Mỗi file test tự start/stop server riêng (`node:test` chạy mỗi file trong process con riêng — không xung đột port giữa các file, không cần chạy sẵn `npm run server`).

## 4. Test database strategy
```
KHÔNG test database riêng/docker/in-memory — dùng trực tiếp DB dev thật (internship_management,
XAMPP/MariaDB) như toàn bộ dự án đã làm từ đầu, theo đúng Option B (HTTP integration tests against
local development DB) của đề bài.
KHÔNG DROP/RESET database. KHÔNG mutate seed data vĩnh viễn:
  - Mọi test "phải reject" (400/403/409) không cần cleanup vì không có write nào xảy ra — verify
    bằng rowCount() trước/sau ở các test quan trọng (field injection, business rule).
  - Test NÀO BẮT BUỘC phải tạo dữ liệu thật (Users create, Evaluation create cho test duplicate-role)
    đều cleanup trong cùng test (try/finally) hoặc test.after() của file, dùng DELETE trực tiếp qua
    pool (không có DELETE API cho Users — đúng thiết kế Phase 4F-1, không tạo endpoint mới chỉ để test).
  - Test "Lecturer publish is one-way" tạm publish evaluations.id=2 (seed thật) rồi PHẢI khôi phục lại
    is_published=0 bằng Admin trong finally — chạy dù assertion phía trên fail hay không.
  - internships.id=7,8 (status in_progress, KHÔNG có evaluation nào ở seed — verify bằng SQL trước khi
    viết test) dùng làm target an toàn cho 2 test tạo evaluation (score-range reject, duplicate-role
    409) — không đụng tới evaluation seed thật nào.
```

## 5. Authentication tests (`tests/auth.test.js`)
```
A1 Valid login -> 200, accessToken tồn tại, response không chứa password/password_hash
A2 Wrong password -> 401
A3 Unknown email -> 401
A4 Missing credentials -> 400
A5 GET /auth/me: valid token 200, invalid token 401, no token 401
```

## 6. RBAC tests (`tests/rbac.test.js`)
```
GET /users: Admin 200, Student/Lecturer/Company Mentor 403 (bắt buộc theo đề bài)
POST /departments (Admin-only mutation đại diện): Student/Lecturer 403
POST /internships: Company Mentor/Lecturer 403 (chỉ Admin/Student được tạo)
POST /evaluations: Student 403 (chỉ Admin/Lecturer/Company Mentor)
DELETE /topics/:id: Student/Lecturer 403 (chỉ Admin)
No token / invalid token -> 401 trên 5 endpoint đại diện (users/internships/evaluations/students/notifications)
```

## 7. IDOR tests (`tests/idor.test.js`) — nhóm quan trọng nhất
```
Ground truth verify bằng SQL trực tiếp trước khi viết test (không đoán ID):
  internships.id=1 -> student_id=1 (Student A), lecturer_id=1 (Lecturer A)
  internships.id=4 -> student_id=5 (Student B), lecturer_id=3 (Lecturer B)
  internship_logs.id=3 (internship_id=4, status='reviewed')
  evaluations.id=2 (internship_id=4, evaluator_role='lecturer', is_published=0)

Student A/B: danh sách internship không giao nhau, Student A GET trực tiếp internship.id=4 -> 403,
  query-param ?student_id=<B> không ghi đè scope (verify từng row trả về đúng student_id của A).
Lecturer A/B: danh sách internship không giao nhau, cross-access -> 403.
Company Mentor A/B: danh sách internship không giao nhau.
Student A GET log đã reviewed của Student B -> 403.
evaluation chưa công bố KHÔNG xuất hiện trong list của CHÍNH Student B (không chỉ của người khác).
Student A GET trực tiếp evaluation chưa công bố của Student B -> 403.
Notifications: mọi row trả về luôn đúng user hiện tại dù có query ?user_id=<khác> hay không.
```
Toàn bộ test dùng set-intersection động (login 2 tài khoản, so sánh ID set) — KHÔNG hardcode kỳ vọng dựa trên đoán, luôn verify "danh sách phải non-empty" trước khi khẳng định "không giao nhau" (tránh pass giả do cả 2 rỗng).

## 8. Field injection tests (`tests/fieldInjection.test.js`)
```
PUT /internships/:id với student_id/period_id -> 400, verify rowCount không đổi
PUT /evaluations/:id với internship_id/evaluator_role -> 400
Lecturer PUT /topics/:id với field ngoài status -> 403 (kể cả khi status hợp lệ đi kèm)
Lecturer PUT /topics/:id với status ngoài approved/rejected -> 400
```
Users field injection (role/profile_id/password_hash/id) được test riêng ở `tests/users.test.js` (mục 10).

## 9. Business rule tests (`tests/businessRules.test.js`)
```
Logs:
  - log đã reviewed -> edit content 409, delete 409
  - reviewed -> submitted (one-way) bị chặn NGAY CẢ VỚI ADMIN -> 409
Reports:
  - submitted_at do client gửi kèm lúc tạo -> 400, không tạo report (rowCount verify)
Evaluations:
  - điểm ngoài khoảng 0-10 -> 400, không tạo row
  - unique (internship_id, evaluator_role): tạo trùng -> 409, cleanup DELETE record vừa tạo
  - evaluation đã công bố -> sửa điểm/nhận xét -> 409
  - Student không có quyền publish/unpublish (403, chặn ở route level, không có PUT access)
  - Lecturer publish là one-way: publish được (200), unpublish bị chặn (403) — khôi phục seed gốc
    bằng Admin trong finally
```

## 10. Users tests (`tests/users.test.js`)
```
role=admin + profile_id -> 400, không tạo user (role/profile matching THẬT ở create() — xem mục 16
  "phát hiện trong lúc viết test" để hiểu vì sao KHÔNG test role=student+profile_id-của-lecturer)
Create hợp lệ + link profile -> response không chứa password/password_hash, DB link đúng user_id
Update: role/profile_id/password_hash/id -> 400 mỗi field (immutable)
List/detail: không bao giờ chứa password/password_hash (chuỗi "password" không xuất hiện trong response)
Cross-profile uniqueness: user role=student (vừa tạo) không thể bị PUT /lecturers/:id link làm lecturer
  -> 400, verify lecturer vẫn chưa link sau request bị reject
```
Cleanup: mọi user do test tạo ra được track trong `createdUserIds`, dọn qua SQL trực tiếp (gỡ link + DELETE user) ở `test.after()` — không có DELETE API cho Users (đúng thiết kế, không tạo endpoint mới).

## 11. Export tests (`tests/` + `services/exportService.test.js`)
`exportService.test.js` (Phase 5, giữ nguyên, đưa vào cùng `npm test`): Admin thấy đủ 12 internship, Student chỉ thấy đúng hồ sơ mình, filter+scope intersection không leak, Student không thấy evaluation chưa công bố, Lecturer chỉ thấy evaluator_role='lecturer' đúng phạm vi, workbook roundtrip (ghi buffer → đọc lại bằng ExcelJS). Không duplicate thêm test HTTP cho export vì service-level test đã cover đúng phần quan trọng (scope + cấu trúc workbook).

## 12. DB integrity tests (`tests/dbIntegrity.test.js`)
```
14 bảng, 19 FK (query information_schema — KHÔNG dùng TABLE_ROWS estimate, chỉ COUNT(*) thật)
14 row-count baseline (users=10 ... settings=1)
0 orphan FK (students->departments, internships->students/periods, logs/evaluations->internships,
  notifications->users)
0 user bị link chéo nhiều loại profile
0 duplicate evaluation per (internship_id, evaluator_role)
```
Đây là bản TỰ ĐỘNG HÓA lại chính xác các câu lệnh COUNT(*)/orphan-check đã chạy thủ công lặp lại qua mọi phase từ 4E-3 đến 6A.

## 13. Test command
```bash
cd server
npm test
```
= `node --test --test-concurrency=1 tests/auth.test.js tests/rbac.test.js tests/idor.test.js tests/fieldInjection.test.js tests/businessRules.test.js tests/users.test.js tests/crudSmoke.test.js tests/security.test.js tests/dbIntegrity.test.js services/exportService.test.js`

`--test-concurrency=1`: chạy từng FILE tuần tự (không chạy đồng thời) — tránh nhiều server/pool cùng mở kết nối MySQL song song gây contention khó chẩn đoán, và đảm bảo thứ tự dọn dẹp dữ liệu test rõ ràng, deterministic. Danh sách file liệt kê rõ ràng (không dùng glob/bare-directory) — `node --test <dir>` bare đã thử và lỗi `MODULE_NOT_FOUND` trên Node 24 khi kết hợp với file argument khác; liệt kê rõ từng file tránh luôn vấn đề này.

## 14. Test runtime
```
Tổng: ~6.5 giây cho toàn bộ 86 test (9 file HTTP integration + exportService.test.js), đo bằng `time npm test`.
Trong giới hạn mục tiêu "vài giây đến tối đa 30 giây" của đề bài.
```

## 15. Sự cố phát hiện và xử lý trong lúc implement
```
1. HANG do fetch() keep-alive: lần chạy đầu tiên, mỗi file test treo ~60s rồi mới "exit 0" giả — gốc
   rễ KHÔNG phải do keep-alive socket (closeAllConnections() không giải quyết được, Connection:'close'
   header cũng không — đây là forbidden header theo spec fetch, bị fetch tự bỏ qua, xác nhận bằng
   test thực tế). Gốc rễ THẬT: require('../../app') nạp toàn bộ chain routes->controllers->services->
   config/database, tạo pool mysql2 NGAY LÚC REQUIRE — pool giữ kết nối idle sống vĩnh viễn
   (connectionLimit), khiến process con của `node --test` không bao giờ tự thoát nếu không gọi
   pool.end(). Fix: helpers/testServer.js's close() giờ gọi pool.end() sau khi server.close() xong.
2. Test "role=student + profile_id của lecturer -> 400" sai GIẢ ĐỊNH: userService.create() luôn tra
   cứu profile_id qua PROFILE_TABLE_BY_ROLE[role] — với role='student', profile_id LUÔN được hiểu là
   students.id, không có cách "vô tình" trỏ sang bảng khác chỉ bằng 1 số nguyên. Test ban đầu vô tình
   trúng vào 1 students.id hợp lệ (trùng số với lecturer.id) đang ĐÃ LINKED ở seed, nhận 409 thay vì
   400 như kỳ vọng sai của test — KHÔNG phải bug sản phẩm. Đã sửa test thành đúng kịch bản role/profile
   mismatch THẬT ở create(): role='admin' + profile_id -> 400 (admin không có bảng hồ sơ tương ứng).
3. Trong lúc debug sự cố #1 (nhiều lần Stop-Process -Force một process đang treo), vài user test mồ
   côi + 1 profile link bị bỏ lại (process bị kill cứng nên test.after() không kịp chạy cleanup) —
   đã phát hiện qua SELECT trực tiếp (users.id=16, students.id=2.user_id=16) và khôi phục thủ công
   (DELETE user, SET user_id=NULL) trước khi re-run suite lần cuối — verify lại COUNT(*) khớp baseline
   10 users sau khi dọn.
```

## 16. Coverage by area (tổng hợp)

| Area | Automated | Manual Only | Status |
|---|---|---|---|
| Authentication | ✅ | — | PASS |
| RBAC | ✅ | — | PASS |
| IDOR | ✅ | — | PASS |
| Field injection | ✅ | — | PASS |
| Business rules (Logs/Reports/Evaluations) | ✅ | — | PASS |
| Users invariants | ✅ | — | PASS |
| Export service | ✅ (Phase 5, giữ nguyên) | — | PASS |
| DB integrity | ✅ (smoke) | — | PASS |
| SQL injection / JWT tampering smoke | ✅ | — | PASS |
| Frontend provider logic (Phase 6A) | ✅ (providerAccess.test.js) | — | PASS |
| Browser E2E | — | ✅ | NOT VERIFIED |
| Full React component/lifecycle integration | — | ✅ | NOT AUTOMATED (ngoài scope Phase 6B — mục 21 đề bài) |

## 17. How to add a new test
```
1. Thêm file vào server/tests/<ten>.test.js, dùng pattern:
     const { startTestServer } = require('./helpers/testServer')
     const { apiRequest } = require('./helpers/http')
     const { loginAll } = require('./helpers/auth')
     test.before(async () => { server = await startTestServer(); tokens = await loginAll(...) })
     test.after(async () => { await server.close() })  // tự động pool.end() + đóng server
2. Nếu cần tạo dữ liệu test: cleanup trong try/finally HOẶC test.after() của chính file đó — không
   bao giờ để lại thay đổi vĩnh viễn trên seed (xem mục 4/15).
3. Thêm đường dẫn file mới vào script "test" trong server/package.json (liệt kê rõ, không dùng glob).
4. Chạy `npm test`, xác nhận tổng runtime vẫn hợp lý (<30s) và KHÔNG còn leftover (SELECT COUNT(*)
   trực tiếp trước/sau nếu test có mutation).
```

## 18. Final verification
```
npm test (server/):     86/86 PASS, ~6.5s
npm run lint (client/): 40 warning (baseline không đổi — Phase 6B không sửa frontend)
npm run build (client/): 192 modules, 0 lỗi (không đổi — không sửa frontend)
GET /api/health:        PASS
GET /api/health/db:     PASS
DB integrity (verify trực tiếp SAU toàn bộ test run):
  14/14 tables, 19/19 FKs, users=10, departments=4, internship_periods=3, students=14, lecturers=10,
  companies=10, company_mentors=7, topics=10, internships=12, internship_logs=3, reports=2,
  evaluations=2, notifications=13, settings=1 — khớp baseline tuyệt đối, không có bảng mới, không
  mutation nào còn sót lại.
```

## 19. Known limitations
```
- Không có browser automation tool — Browser E2E: NOT VERIFIED (không claim PASS).
- Suite chỉ cover các domain/rule được liệt kê rõ ở mục 5-12, KHÔNG test mọi field validation string
  hay mọi tổ hợp role × endpoint (đúng mục tiêu đề bài: "không cần 100% coverage", chỉ cần bắt được
  regression ở các invariant quan trọng).
- Smoke test CRUD (`crudSmoke.test.js`) chỉ GET (đọc) — không test POST/PUT/DELETE cho từng domain
  (đã test kỹ ở fieldInjection/businessRules/users/idor cho các domain quan trọng nhất; domain còn
  lại dựa vào pattern middleware đã được chứng minh giống nhau — đúng chỉ đạo mục 7 Phase 6B "không
  cần test mọi endpoint × mọi role nếu cùng middleware pattern đã được chứng minh").
- Test chạy trực tiếp trên DB dev thật (không có DB test riêng/transaction-rollback-per-test) — mọi
  test "reject" không cần cleanup (không write), test "cần tạo dữ liệu" tự cleanup trong cùng file;
  rủi ro duy nhất là nếu 1 test crash THEO CÁCH KHÔNG BÌNH THƯỜNG (process bị kill cứng từ ngoài, như
  sự cố #3 mục 15) thì cleanup không chạy được — đã xảy ra đúng 1 lần trong lúc debug, phát hiện và
  khôi phục thủ công, không phải hành vi của suite khi chạy bình thường qua `npm test`.
```
