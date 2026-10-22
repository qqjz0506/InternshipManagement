# HỆ THỐNG QUẢN LÝ THỰC TẬP TỐT NGHIỆP

Đồ án tốt nghiệp — hệ thống quản lý quy trình thực tập giữa Sinh viên, Giảng viên, Doanh nghiệp và Người hướng dẫn doanh nghiệp, dưới sự quản trị của Admin (Khoa/Bộ môn).

## 1. Giới thiệu

Hệ thống số hóa toàn bộ quy trình thực tập tốt nghiệp: đăng ký thực tập, phân công giảng viên/doanh nghiệp/người hướng dẫn, đề xuất và duyệt đề tài, ghi nhật ký thực tập hàng tuần, nộp và duyệt báo cáo, đánh giá kết quả thực tập, thông báo, và xuất báo cáo tổng hợp. Toàn bộ dữ liệu nghiệp vụ (sinh viên, giảng viên, doanh nghiệp, hồ sơ thực tập, nhật ký, báo cáo, đánh giá...) được lưu trong MySQL/MariaDB thật qua REST API — không còn dữ liệu mock nào đóng vai trò nguồn dữ liệu chính thức.

## 2. Chức năng chính

- Quản lý danh mục: Khoa/Bộ môn, Đợt thực tập, Đề tài, Doanh nghiệp, Người hướng dẫn doanh nghiệp.
- Quản lý hồ sơ: Sinh viên, Giảng viên.
- Đăng ký và quản lý Hồ sơ thực tập (trạng thái: chờ duyệt → đã duyệt → đang thực tập → hoàn thành, hoặc từ chối/hủy).
- Đề xuất và duyệt Đề tài thực tập.
- Nhật ký thực tập hàng tuần (Sinh viên ghi, Giảng viên/Doanh nghiệp nhận xét, khóa nội dung sau khi Giảng viên đã nhận xét).
- Báo cáo thực tập (tuần/tổng kết) kèm **upload file thật** (.pdf/.doc/.docx, tối đa 10MB — `multer`, lưu `server/uploads/reports/`), Giảng viên duyệt, Doanh nghiệp nhận xét, tải file về (`GET /api/reports/:id/download`, cùng scope với xem báo cáo). Nộp lại khi bị từ chối phải kèm file mới (tự xóa file cũ).
- Đánh giá thực tập từ Giảng viên và Doanh nghiệp (4 điểm thành phần + điểm tổng của từng đánh giá, công bố một chiều). Khi CẢ HAI đánh giá đã công bố, hệ thống tự tính **Điểm tổng kết thực tập** (theo trọng số Giảng viên/Doanh nghiệp cấu hình ở Cài đặt) và **Xếp loại** (xem Mục 16C).
- Thông báo tự động theo từng tài khoản: hệ thống tự sinh thông báo khi có sự kiện nghiệp vụ (đăng ký thực tập, đổi trạng thái hồ sơ, phân công giảng viên/mentor, đề xuất/duyệt đề tài, nộp nhật ký/báo cáo, nhận xét/duyệt, công bố đánh giá...) — không phải event engine/queue thật, chỉ là 1 lệnh ghi đơn giản ngay sau khi nghiệp vụ chính thành công (xem `server/services/notificationService.js`). Badge số thông báo chưa đọc ở Topbar (tự cập nhật mỗi 30 giây khi tab đang mở), đánh dấu từng thông báo hoặc tất cả đã đọc, có trang Thông báo riêng cho cả 4 role (kể cả Admin).
- Quản lý tài khoản đăng nhập (Admin tạo/sửa, liên kết với hồ sơ Sinh viên/Giảng viên/Người hướng dẫn).
- Cấu hình hệ thống (tên hệ thống, đợt thực tập mặc định, cho phép/tạm khóa đăng ký thực tập, trọng số tính điểm tổng kết thực tập).
- Thống kê tổng hợp theo Khoa/Đợt thực tập/Doanh nghiệp.
- Xuất báo cáo Excel (.xlsx): thông tin thực tập và đánh giá/nhận xét (kèm điểm tổng kết + xếp loại) — Admin, Lecturer, Company Mentor đều có nút xuất trên UI (xem Mục 16C).

## 3. Vai trò người dùng

| Vai trò | Phạm vi dữ liệu |
|---|---|
| **Admin** | Quản trị rộng (toàn bộ danh mục, hồ sơ, tài khoản), nhưng vẫn phải tuân theo mọi business rule (không bỏ qua validate, không bỏ qua khóa trạng thái) |
| **Student** (`student`) | Chỉ dữ liệu liên quan đến chính mình: hồ sơ, hồ sơ thực tập, nhật ký, báo cáo, đánh giá **đã công bố**, thông báo của mình |
| **Lecturer** (`lecturer`) | Chỉ hồ sơ thực tập mình phụ trách (và nhật ký/báo cáo/đánh giá thuộc các hồ sơ đó) |
| **Company Mentor** (`company_mentor`) | Chỉ hồ sơ thực tập mình hướng dẫn (và nhật ký/báo cáo/đánh giá thuộc các hồ sơ đó) |

> **Phân quyền ở frontend chỉ là UX (ẩn menu/nút cho gọn), KHÔNG phải cơ chế bảo mật.** Mọi ownership/scope/role thật sự được backend tự suy ra từ JWT và enforce lại ở từng request (`requireAuth` → `requireRole` → service/`scopeService`) — không tin bất kỳ tham số nào từ client (id, role, query param) để xác định quyền truy cập.

## 4. Công nghệ sử dụng

| Layer | Công nghệ |
|---|---|
| Frontend | React 19 + Vite |
| Routing | React Router (react-router-dom) |
| State | React Context API (không dùng Redux/Zustand/React Query) |
| Backend | Node.js + Express |
| Database | MariaDB/MySQL (qua XAMPP khi phát triển local) |
| DB Driver | mysql2 (parameterized query, không ORM) |
| Authentication | JSON Web Token (jsonwebtoken) |
| Password hashing | bcryptjs |
| Export | ExcelJS (.xlsx) |
| Testing | Node.js built-in `node:test` |
| Lint (frontend) | oxlint |

## 5. Kiến trúc hệ thống

```
Frontend (React)
   ↓ fetch (apiClient.js, JWT Bearer)
REST API (Express)
   ↓
JWT Authentication (requireAuth)
   ↓
Role Authorization (requireRole)
   ↓
Controller (validate format)
   ↓
Service / scopeService (business rule + ownership/scope)
   ↓
MySQL (mysql2, parameterized query)
```

Chi tiết đầy đủ: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 6. Cấu trúc thư mục

```
InternshipManagement/
├── client/                 # Frontend React + Vite
│   ├── src/
│   │   ├── api/            # 1 module/entity — wrapper gọi REST API qua apiClient.js
│   │   ├── context/        # 1 Context/entity — state quản lý qua Context API
│   │   ├── pages/          # Trang theo role: admin/, student/, lecturer/, company/, auth/
│   │   ├── components/     # Component dùng lại (form modal, bảng, layout...)
│   │   ├── routes/         # ProtectedRoute (role-gate ở route)
│   │   ├── hooks/          # Hook tiện ích (useCurrentStudent, useMyInternship...)
│   │   ├── utils/          # Hằng số/logic thuần (status enum, validator...)
│   │   └── data/           # CHỈ còn vài hằng số UI (ROLE_LABELS...) — không còn mock business data
│   └── package.json
├── server/                 # Backend Node.js + Express
│   ├── routes/              # 1 file/entity — khai báo HTTP method + middleware
│   ├── controllers/         # Validate format request, gọi service, format response
│   ├── services/            # Business logic, ownership/scope, truy vấn MySQL
│   ├── middleware/          # authMiddleware (JWT), authorizationMiddleware (role)
│   ├── db/                  # schema.sql, seed.sql
│   ├── config/               # Kết nối MySQL (mysql2 pool)
│   ├── utils/                 # AppError, response helper, validator, enum dùng chung
│   ├── tests/                 # Test HTTP integration (node:test) — Phase 6B
│   └── package.json
├── docs/                    # Tài liệu — xem Mục 17
└── README.md                # Tài liệu này
```

## 7. Yêu cầu môi trường

- Node.js (đã phát triển/kiểm thử với Node 24.x)
- npm
- XAMPP (hoặc MariaDB/MySQL độc lập) — cần MySQL/MariaDB đang chạy, nghe cổng mặc định `3306`

## 8. Cài đặt

```bash
# Tại thư mục gốc dự án
cd client && npm install
cd ../server && npm install
```

Không có dependency nào ở `package.json` gốc (chỉ chứa script điều hướng, xem Mục 11/12).

## 9. Cấu hình môi trường

Backend đọc biến môi trường qua `dotenv` từ `server/.env`. Copy từ mẫu:

```bash
cd server
copy .env.example .env    # Windows
# hoặc: cp .env.example .env
```

Các biến môi trường backend (`server/.env.example`):

```
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=internship_management
DB_USER=root
DB_PASSWORD=

CLIENT_URL=http://localhost:5173

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
```

`server/.env.example` còn có `DB_NAME_TEST=internship_management_test` — database RIÊNG dùng cho automated test (`npm test`, xem Mục 15), tách khỏi `DB_NAME` (dev). Không bắt buộc đổi giá trị này, chỉ cần khác `DB_NAME`.

Frontend đọc biến môi trường qua Vite từ `client/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

**Không bao giờ commit file `.env` thật** (đã có trong `.gitignore` ở gốc dự án) — chỉ `.env.example` (giá trị mẫu) được lưu trong mã nguồn. `JWT_SECRET` ở `.env.example` chỉ là placeholder, phải thay bằng giá trị ngẫu nhiên thật khi deploy.

## 10. Khởi tạo cơ sở dữ liệu

### Cách 1 — chạy trực tiếp qua `mysql` client (dev, lần đầu)

**Bắt buộc ép charset `utf8mb4`** khi chạy (đã ghi chú ngay trong `schema.sql`) để tránh dữ liệu tiếng Việt bị lưu sai:

```bash
mysql -u root --default-character-set=utf8mb4 < server/db/schema.sql
mysql -u root --default-character-set=utf8mb4 < server/db/seed.sql
```

Kết quả mong đợi: database `internship_management`, **14 bảng**, **19 foreign key**, dữ liệu mẫu (seed) cho toàn bộ 14 bảng kể cả 4 role tài khoản demo (xem Mục 13). Chi tiết schema: [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md).

**Database đã tồn tại từ trước** (đã chạy `schema.sql` cũ, thiếu cột mới): chạy thêm các migration bên dưới theo đúng thứ tự:

```bash
mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/001_users_status.sql
mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/002_reports_file_upload.sql
mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/003_settings_weights.sql
mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/004_must_change_password.sql
mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/005_internship_final_score.sql
```

### Cách 2 — qua npm script (cross-platform, dùng Node thay cho `mysql` CLI/shell redirection)

**Bắt buộc có trước: database đã tồn tại** (đã chạy Cách 1 ít nhất 1 lần — `db:migrate`/`db:seed` KHÔNG tự tạo database, chỉ `USE` database đã cấu hình trong `.env`; chạy khi database chưa tồn tại sẽ lỗi `Unknown database`):

```bash
cd server
npm run db:migrate   # chạy các migration CHƯA áp dụng (server/db/migrations/*.sql), lưu vào bảng schema_migrations
npm run db:seed       # reseed dữ liệu mẫu (TRUNCATE rồi INSERT lại, an toàn chạy nhiều lần) từ seed.sql
```

- `db:migrate` (`server/db/migrate.js`): đọc lần lượt từng file trong `server/db/migrations/`, bỏ qua file đã có trong bảng `schema_migrations` (tự tạo bảng này nếu chưa có), chạy file còn thiếu rồi ghi nhận lại. **Idempotent thật** (đã kiểm chứng, không chỉ "idempotent-ish" như bản mysql CLI thuần ở Cách 1): nếu chạy trên database đã có sẵn cột đó (ví dụ database MỚI tạo từ `schema.sql` hiện tại, đã gộp sẵn thay đổi của `migrations/001-005`, mà quên baseline qua `test:setup`), script tự phát hiện lỗi "Duplicate column name" (mã 1060/1061/1826), coi là "đã áp dụng" và ghi nhận lại — KHÔNG crash giữa chừng, an toàn chạy lại bất kỳ lúc nào trên bất kỳ database nào (cũ hoặc mới).
- `db:seed` (`server/db/seed.js`): tương đương chạy `seed.sql` nhưng qua Node (không cần `mysql` CLI trong PATH, chạy được cả Windows/macOS/Linux). Áp dụng cho database đang cấu hình theo `NODE_ENV` (`DB_NAME` hoặc `DB_NAME_TEST` — giống `test:setup`/`config/database.js`).
- Cả 2 script đọc `.env` qua `dotenv`, không cần biến môi trường shell riêng.
- **Database mới tạo từ `schema.sql` hiện tại (Cách 1) thường KHÔNG cần `db:migrate`** — `schema.sql` đã gộp sẵn toàn bộ thay đổi của `migrations/001-005`. Chạy `db:migrate` vẫn AN TOÀN nếu lỡ chạy (tự phát hiện "đã áp dụng" như trên), chỉ là dư thừa không cần thiết.

## 11. Chạy Backend

```bash
cd server
npm run dev     # nodemon server.js — tự reload khi sửa code
# hoặc
npm start       # node server.js — chạy thường, không reload
```

Hoặc từ thư mục gốc: `npm run server` (dev) / `npm run server:start` (production-style, không reload).

Backend chạy tại `http://localhost:5000` (theo `PORT` trong `.env`). Kiểm tra nhanh:

```
GET http://localhost:5000/api/health
GET http://localhost:5000/api/health/db
```

## 12. Chạy Frontend

```bash
cd client
npm run dev
```

Hoặc từ thư mục gốc: `npm run client`. Frontend chạy tại `http://localhost:5173` (cổng mặc định Vite).

## 13. Tài khoản demo

> Chỉ sử dụng cho môi trường demo/local — KHÔNG phải tài khoản production. Mật khẩu plaintext dưới đây chỉ tồn tại ở đây và trong `LoginPage.jsx` (gợi ý đăng nhập), **không bao giờ được lưu plaintext trong database** (chỉ lưu `bcrypt` hash).

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@example.com | admin123 |
| Sinh viên 1–4 | student@example.com, student2@example.com, student3@example.com, student4@example.com | student123 |
| Giảng viên 1–2 | lecturer@example.com, lecturer2@example.com | lecturer123 |
| Doanh nghiệp (Mentor) 1–3 | company@example.com, company2@example.com, company3@example.com | company123 |

## 14. API

Toàn bộ API dưới tiền tố `/api`, trả JSON dạng `{ success, message, data }` (trừ 2 endpoint export trả file nhị phân). Chi tiết từng domain (route prefix, mục đích, quyền truy cập): [`docs/API_INDEX.md`](docs/API_INDEX.md). Chi tiết implement đầy đủ theo từng phase: [`docs/PHASE_INDEX.md`](docs/PHASE_INDEX.md).

**Phân trang (optional, không phá hành vi cũ):** `GET /api/students`, `/api/internships`, `/api/reports`, `/api/internship-logs` hỗ trợ `?page=&pageSize=` (`pageSize` tối đa 100, mặc định 20). Không truyền `page` → trả toàn bộ như trước (không có field `total`/`page`/`pageSize`). Có `page` → `data` là 1 trang, kèm `total`/`page`/`pageSize` ở top-level response — scope theo role vẫn áp dụng trước khi phân trang (`server/utils/pagination.js`, test: `tests/pagination.test.js`).

**Thống kê tổng hợp:** `GET /api/statistics/summary` (Admin only) — tính toàn bộ KPI/breakdown (theo khoa, đợt, doanh nghiệp, trạng thái, báo cáo, đánh giá) bằng SQL `GROUP BY` ở server (`server/services/statisticsService.js`), nhận cùng filter `period_id`/`department_id`/`company_id` như `AdminStatisticsPage.jsx` đang dùng — trang Thống kê gọi API này thay vì tự tính từ dữ liệu Context đã tải (test: `tests/statisticsSummary.test.js`).

## 15. Kiểm thử

### Backend (tự động)

```bash
cd server
npm run test:setup   # 1 lần đầu, hoặc khi muốn reset lại database test (xem Mục 10)
npm test
```

Test chạy trên **database test riêng** (`DB_NAME_TEST`, mặc định `internship_management_test`) — `npm test` tự set `NODE_ENV=test` (qua `cross-env`, chạy được cả Windows/macOS/Linux), và `server/config/database.js` tự chuyển sang `DB_NAME_TEST` khi thấy `NODE_ENV=test`. Database test được tạo/tái tạo bằng `npm run test:setup` (`server/db/testSetup.js` — build từ `schema.sql`+`seed.sql`, không đụng tới database dev). Test suite **không còn chạy trên database dev thật** — an toàn chạy test bất kỳ lúc nào dù đang code/debug thủ công trên dev.

Kết quả hiện tại: **225/225 PASS** (0 fail, 0 skip), chạy trong khoảng 22–24 giây. Bao phủ: Authentication, RBAC, IDOR/ownership, field injection, business rules (khóa trạng thái, điểm đánh giá, công bố đánh giá, "Business Rules V2" — xem Mục 16B), điểm tổng kết thực tập + trọng số + xếp loại (`tests/evaluationFinalResult.test.js` — xem Mục 16C), bất biến hồ sơ `completed` (`tests/completedInvariants.test.js` — xem Mục 16F), phân trang server-side (`tests/pagination.test.js`), thống kê tổng hợp (`tests/statisticsSummary.test.js`), múi giờ "hôm nay"/"tương lai" (`tests/dateTime.test.js`, `tests/timezoneBusinessRules.test.js` — xem Mục 16D), migration idempotent (`tests/dbMigrate.test.js`), Users invariants, export (kèm cột điểm tổng kết, `exportService.test.js`), workflow/phân công Internship, field-whitelist Logs/Reports, error handling, Settings, đổi mật khẩu/khóa-mở tài khoản/reset mật khẩu/mật khẩu tạm bắt buộc đổi — chặn cả ở server (`tests/accountSecurity.test.js`), thông báo tự động (`tests/notifications.test.js`), upload/tải file báo cáo thật — hợp lệ, sai định dạng, quá dung lượng, ngoài scope bị 403, tên file tiếng Việt không mojibake (`tests/reportUpload.test.js`), DB integrity smoke test. Chi tiết: [`docs/PHASE_6B_AUTOMATED_TESTING.md`](docs/PHASE_6B_AUTOMATED_TESTING.md), [`docs/PHASE_7B_SECURITY_AND_REGRESSION.md`](docs/PHASE_7B_SECURITY_AND_REGRESSION.md), [`docs/PHASE_7C_FINAL_PREPARATION.md`](docs/PHASE_7C_FINAL_PREPARATION.md).

### Frontend (lint/build + logic thuần)

```bash
cd client
npm run lint     # hiện tại: 41 warning (baseline đã biết, không phải lỗi mới — xem Known Limitations)
npm run build    # phải 0 lỗi
npm test         # providerAccess.test.js — test logic role-aware loading, không cần React/jsdom
```

### Browser E2E (Playwright)

**ĐÃ TỰ ĐỘNG HÓA VÀ XÁC MINH** (đợt kiểm tra trước bảo vệ) — `@playwright/test` (devDependency ở `package.json` gốc), chạy backend + frontend THẬT (không mock) trên database test riêng:

```bash
npx playwright install chromium   # 1 lần đầu (hoặc khi máy chưa có Chromium cho Playwright)
npm run test:e2e
```

- `playwright.config.js` (gốc dự án) tự khởi động CẢ backend (`NODE_ENV=test`, cổng 5000) VÀ frontend (`vite`, cổng 5173) qua `webServer`, và tự chạy lại `server/db/testSetup.js` trước mỗi lần chạy (`globalSetup` — xem `e2e/global-setup.js`) để luôn bắt đầu từ DB test sạch.
- `e2e/auth.spec.js`: đăng nhập cả 4 role + 1 ca sai mật khẩu.
- `e2e/full-workflow.spec.js` (`test.describe.serial`, 8 bước nối tiếp, dùng `student4@example.com` — tài khoản demo chưa có hồ sơ thực tập): Sinh viên đăng ký thực tập → Admin phân công doanh nghiệp/giảng viên + chuyển `in_progress` → Sinh viên ghi nhật ký → Sinh viên nộp báo cáo tổng kết (`.pdf` thật, xem `docs/demo-files/`) → Giảng viên nhận xét nhật ký + duyệt báo cáo + chấm và công bố điểm → Doanh nghiệp chấm và công bố điểm → Admin chuyển `completed`, xem điểm tổng kết thực tập, xuất Excel (verify sự kiện download thật), khóa rồi mở khóa 1 tài khoản → verify badge thông báo của sinh viên tăng (>0) sau các sự kiện trên.
- Kết quả hiện tại: **13/13 PASS** (~15 giây), đã chạy thật trên Chromium trong chính môi trường phát triển này — không còn là "chưa xác minh được".
- **Lưu ý khi chạy xen kẽ với `cd server && npm test`:** cả 2 đều nhắm vào CÙNG 1 database test (`DB_NAME_TEST`). `npm test` (backend) tự dọn dữ liệu nó tạo ra (try/finally từng test) nên không để lại gì; `npm run test:e2e` thì KHÔNG dọn sau khi chạy xong (để lại hồ sơ thực tập vừa tạo ở trạng thái `completed`) — nếu chạy `npm test` NGAY SAU `npm run test:e2e` mà không `test:setup` lại, vài test baseline COUNT(*) (`dbIntegrity.test.js`, `statisticsSummary.test.js`) sẽ fail vì lệch baseline. Luôn chạy `cd server && npm run test:setup` trước khi chuyển từ `test:e2e` sang `npm test` (hoặc ngược lại không vấn đề gì, vì `test:e2e` tự `test:setup` lại mỗi lần).

## 16. Quy tắc bảo mật và phân quyền

Đã triển khai và kiểm chứng (qua `server/tests/`):

- Mật khẩu: chỉ lưu `bcrypt` hash, không bao giờ trả `password`/`password_hash` ở bất kỳ response nào.
- JWT: payload tối thiểu (`{sub, role}`), `requireAuth` luôn truy vấn lại DB để lấy thông tin user mới nhất mỗi request (không tin thông tin cũ trong token ngoài identity).
- RBAC theo route (`requireRole`) + ownership/scope theo dữ liệu (`scopeService`) — 2 lớp độc lập, không lớp nào thay thế lớp kia.
- Chống IDOR: mọi tham số định danh từ client (query param, body field như `student_id`, `user_id`...) đều bị bỏ qua/ghi đè bằng identity thật suy ra từ JWT ở phía server.
- Field injection: field immutable (`role`, `profile_id`, `student_id`, `period_id`, `internship_id`, `evaluator_role`...) bị reject cứng (400) nếu có mặt trong payload update, không silently bỏ qua.
- SQL injection: 100% parameterized query (`?` placeholder qua mysql2), không nối chuỗi giá trị trực tiếp vào SQL.
- Business lock: ví dụ nhật ký/đánh giá đã được Giảng viên xử lý ("reviewed"/"đã công bố") bị khóa sửa/một số transition là một chiều — áp dụng cho mọi role kể cả Admin.
- Đổi mật khẩu tự thân (`PUT /api/auth/change-password`): bắt buộc đúng mật khẩu hiện tại, mật khẩu mới tối thiểu 8 ký tự + có chữ và số + khác mật khẩu hiện tại. Trang "Đổi mật khẩu" (`/change-password`) dùng chung cho cả 4 role, truy cập qua Topbar.
- Admin đặt lại mật khẩu cho tài khoản khác (`PUT /api/users/:id/reset-password`): sinh mật khẩu tạm ngẫu nhiên, trả về **đúng 1 lần** trong response để Admin chép lại — không lưu plaintext ở đâu khác.
- Khóa/mở tài khoản (`users.status`, `PUT /api/users/:id/status`): tài khoản `locked` bị chặn ngay cả khi đăng nhập (403) và cả token cũ đã cấp trước đó (403 ngay từ request kế tiếp, vì `requireAuth` luôn truy vấn lại DB). Admin không tự khóa được chính mình, và không khóa được admin cuối cùng còn `active`.
- `helmet` (security header mặc định) + `express-rate-limit` (giới hạn `POST /api/auth/login`: 10 lần/15 phút/IP, tự tắt khi `NODE_ENV=test`) + giới hạn body request `1mb` (`express.json({ limit: '1mb' })`).

**Chưa triển khai** (ghi nhận minh bạch, không giả vờ có):

- CSRF protection — không áp dụng (API thuần JWT Bearer, không dùng cookie session).
- Refresh token — chỉ có access token, hết hạn phải đăng nhập lại.
- Rate limiting cho các endpoint khác ngoài `POST /api/auth/login` (ví dụ không giới hạn số lần gọi `PUT /auth/change-password`).
- Quản lý secrets cấp production (hiện chỉ là biến môi trường `.env` local).
- HTTPS — môi trường phát triển hiện tại chạy HTTP thuần (`http://localhost`).

## 16B. Business Rules V2 (siết chặt nghiệp vụ)

Bổ sung sau Phase 7C, chỉ thêm rule ở tầng Service (không đổi schema, không đổi `ALLOWED_TRANSITIONS`):

- Đăng ký thực tập mới bị chặn khi: đợt thực tập `status='closed'` (409, áp dụng cả Admin); `settings.allow_student_registration=0` (403, chỉ Student — Admin vẫn tạo được); hồ sơ sinh viên `status='inactive'` (403, chỉ Student).
- Gán `topic_id`: Student chỉ chọn được đề tài `approved` hoặc `proposed` do chính mình đề xuất; Admin không gán được đề tài `rejected`.
- Gán `company_id`/`lecturer_id`/`company_mentor_id`: đối tượng phải đang `status='active'`.
- Chuyển trạng thái `approved → in_progress`: bắt buộc đã có đủ Giảng viên + Doanh nghiệp + Người hướng dẫn.
- Chuyển trạng thái `in_progress → completed`: bắt buộc có ≥1 báo cáo tổng kết (`report_type='final'`) đã `approved`, và đủ đánh giá **đã công bố** (`is_published=1`) từ cả Giảng viên và Doanh nghiệp (siết từ "chỉ cần tồn tại" lên "phải công bố" — đảm bảo hồ sơ `completed` luôn có điểm tổng kết tính được ngay, xem Mục 16C).
- `start_date`/`end_date` của hồ sơ thực tập phải nằm trong khoảng của đợt; `log_date` của nhật ký không được ở tương lai và phải nằm trong khoảng thời gian thực tập.
- Báo cáo: chỉ nộp khi hồ sơ `in_progress`/`completed`; tối đa 1 báo cáo `final` chưa `rejected`/hồ sơ; Student nộp lại được báo cáo của mình khi đang `rejected` (nút "Nộp lại" ở `StudentReportsPage.jsx`, chỉ sửa `file_name`, tự reset về `submitted`).
- `overall_score` của đánh giá do server tự tính (trung bình 4 điểm thành phần, làm tròn 1 chữ số thập phân) — client gửi kèm sẽ bị reject 400; UI (`LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx`) hiển thị điểm tổng read-only, tự tính khi nhập.
- Student tự sửa `email` → đồng bộ luôn `users.email` (nếu hồ sơ có `user_id`) trong 1 transaction, check trùng ở bảng `users`.

Chi tiết đầy đủ + bằng chứng test: `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` mục N (REQ-052–061), `server/tests/businessRulesV2.test.js`.

## 16C. Điểm tổng kết thực tập (Final Result)

Bổ sung theo yêu cầu trực tiếp của người dùng — tính điểm tổng kết chung từ 2 đánh giá (Giảng viên + Doanh nghiệp), không đổi cách tính `overall_score` của từng đánh giá riêng lẻ (Mục 16B).

- **Trọng số**: `settings.lecturer_weight`/`company_weight` (TINYINT, mặc định 60/40), tổng luôn phải = 100 — validate 2 lớp độc lập: `settingsService.update()` (app) và `CHECK chk_settings_weight_sum` (DB, `server/db/migrations/003_settings_weights.sql`). Admin chỉnh ở `AdminSettingsPage.jsx` (2 input số, chặn Save nếu tổng ≠ 100).
- **Công thức**: `finalScore = round1(overall_score(lecturer) × lecturer_weight + overall_score(company) × company_weight) / 100`, tính ở `evaluationService.computeFinalResult()`/`computeFinalResultsBulk()` (bulk dùng cho export, tránh N+1). **Chỉ tính khi CẢ HAI đánh giá đã `is_published=1`** — nếu chưa đủ, API trả `data: null` cho MỌI role (kể cả Admin) — đây là giới hạn do dữ liệu chưa tồn tại (data-availability gate), không phải permission riêng cho Student.
- **Xếp loại**: `>=9` Xuất sắc, `>=8` Giỏi, `>=6.5` Khá, `>=5` Trung bình, `<5` Không đạt (`evaluationService.classify()`).
- **CHỐT điểm khi hoàn thành** (đợt kiểm tra trước bảo vệ): `internships.final_score`/`final_classification` (migration `005_internship_final_score.sql`) được TÍNH VÀ GHI vào đúng thời điểm chuyển trạng thái sang `completed` (`internshipService.update()`, cùng 1 câu `UPDATE` với `status`) — dùng đúng trọng số Settings TẠI THỜI ĐIỂM ĐÓ. Sau khi đã `completed`, `computeFinalResult()`/`computeFinalResultsBulk()` LUÔN trả về giá trị đã chốt này (không tính lại) — **đổi trọng số ở Settings sau đó không làm đổi điểm của các hồ sơ đã hoàn thành**. Hồ sơ chưa `completed` vẫn tính "sống" theo trọng số hiện tại như trước. Xem thêm Mục 16F (bất biến hồ sơ completed).
- **API**: `GET /api/internships/:id/final-result` — scope tái dùng đúng `internshipService.getByIdForUser` (giống `GET /internships/:id`, không viết lại logic scope).
- **Hiển thị**: `StudentEvaluationsPage.jsx`, `InternshipDetailPage.jsx` (Admin), `LecturerStudentDetailPage.jsx` — qua hook chung `client/src/hooks/useFinalResult.js`.
- **Export Excel**: cột "Điểm tổng kết thực tập" + "Xếp loại" được thêm vào **cuối** danh sách cột trong `GET /api/exports/evaluations.xlsx` (để không xô lệch index cột cũ mà `exportService.test.js` đang assert cứng); cột "Điểm tổng kết" cũ (điểm của riêng 1 đánh giá) đổi tên thành "Điểm tổng (đánh giá này)" để tránh nhầm với cột mới.

Chi tiết đầy đủ + bằng chứng test: `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` mục O (REQ-065–068), `server/tests/evaluationFinalResult.test.js`, `server/services/exportService.test.js`.

## 16D. Múi giờ (Asia/Ho_Chi_Minh)

Phát hiện ở đợt kiểm tra trước bảo vệ: mọi nơi tính "hôm nay"/"tương lai" (`log_date` không được ở tương lai, `reports.submitted_at`, `evaluations.published_at`, tên file export) đều dùng `new Date().toISOString().slice(0, 10)` — lấy theo **UTC**, sai lệch 1 ngày từ 00:00 đến 06:59 giờ Việt Nam mỗi ngày (UTC lúc đó vẫn còn là ngày hôm trước).

- **Fix**: `server/utils/dateTime.js` — `todayDateString(now = new Date())` dùng `Intl.DateTimeFormat` với `timeZone` đọc từ biến môi trường `APP_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh`, không đổi theo DST). Áp dụng thống nhất cho cả 4 nơi: `internshipLogService.validateLogDate`, `reportService` (`submitted_at`), `evaluationService` (`published_at`), `exportController` (tên file `.xlsx`).
- Client: bỏ 3 chỗ gửi kèm `published_at` tự tính bằng `new Date()` (vừa dư thừa vừa sai múi giờ) ở `LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx`/`AdminEvaluationDetailPage.jsx` — server luôn tự tính và overwrite giá trị này.
- Test: `server/tests/dateTime.test.js` (hàm thuần, mốc 01:00 sáng giờ VN) + `server/tests/timezoneBusinessRules.test.js` (mock `Date` toàn cục qua `node:test` `mock.timers`, gọi HTTP thật — verify `log_date` không bị chặn "tương lai", `submitted_at`/`published_at` ghi đúng ngày VN lúc 01:00 sáng).

## 16E. Mật khẩu tạm bắt buộc đổi (`must_change_password`)

`users.must_change_password` (migration `004_must_change_password.sql`) — bật khi Admin đặt mật khẩu tạm (`PUT /api/users/:id/reset-password`), tắt khi user tự đổi mật khẩu thành công (`PUT /api/auth/change-password`). Trả về trong `login`/`GET /auth/me` (`authService.toSafeUser`).

- **Chặn ở SERVER** (không chỉ ở frontend — phát hiện và vá ở đợt kiểm tra trước bảo vệ): `requireAuth` (`server/middleware/authMiddleware.js`) tự trả **403** kèm `code: "MUST_CHANGE_PASSWORD"` cho MỌI request khi `must_change_password=1`, TRỪ `GET /auth/me` và `PUT /auth/change-password` (2 route cần thiết để thoát khỏi trạng thái này) — trước đây chỉ `ProtectedRoute.jsx` chặn ở frontend, không đủ vì client tự gọi thẳng API khác vẫn lọt qua được.
- `AppError` giờ nhận thêm tham số `code` tùy chọn (`server/utils/AppError.js`), `errorHandler.js` trả `code` này trong JSON response khi có — dùng cho các lỗi cần client phân biệt CHÍNH XÁC loại 403 (không chỉ dựa message tiếng Việt dễ vỡ khi đổi câu chữ).
- Frontend: `apiClient.js` có 1 "listener" nhỏ (`onMustChangePassword`) — bất kỳ response nào mang `code` này đều cập nhật ngay `currentUser.mustChangePassword` trong `AuthContext`, để `ProtectedRoute.jsx` (đã có sẵn logic redirect) tự chuyển sang `/change-password` ở lần render kế tiếp, không cần logic điều hướng riêng.
- Test: `server/tests/accountSecurity.test.js` (verify 403+code cho API khác, `GET /auth/me`/`PUT /auth/change-password` vẫn gọi được, sau khi đổi mật khẩu thì gọi API khác lại bình thường).

## 16F. Bất biến hồ sơ 'completed' (giữ nguyên bằng chứng đã dùng để hoàn thành)

Đợt kiểm tra trước bảo vệ — 1 khi hồ sơ thực tập đã chuyển sang `completed`, các dữ liệu ĐÃ DÙNG LÀM ĐIỀU KIỆN để cho phép hoàn thành (xem Mục 16B, REQ-056) không được sửa/xóa nữa, **kể cả Admin**:

- **Không bỏ công bố HOẶC xóa đánh giá** thuộc hồ sơ `completed` (`evaluationService.update()`/`remove()` — 409).
- **Không đổi `status` HOẶC xóa báo cáo tổng kết (`report_type='final'`) đã `approved`** của hồ sơ `completed` (`reportService.update()`/`remove()` — 409).
- **Không gỡ (set `null`) `company_id`/`lecturer_id`/`company_mentor_id`** khi hồ sơ đang `in_progress` HOẶC `completed` — đổi SANG đối tượng khác (đang `active`, đúng công ty cho mentor) vẫn được phép khi `in_progress` (`internshipService.update()` — 409 nếu cố gỡ về `null`).
- Điểm tổng kết đã chốt (Mục 16C) không đổi dù Settings đổi trọng số sau đó.

Lý do: nếu cho phép sửa/xóa các dữ liệu này sau khi đã `completed`, hồ sơ có thể rơi vào trạng thái mâu thuẫn (ví dụ: `completed` nhưng không còn đủ 2 đánh giá công bố — đúng điều kiện đã dùng để cho hoàn thành ban đầu). Test: `server/tests/completedInvariants.test.js`.

## 16G. Tên file tiếng Việt khi upload (mojibake)

Đợt kiểm tra trước bảo vệ: `multer`/`busboy` mặc định decode filename multipart bằng **latin1** (đúng RFC 7578 cũ), làm tên file tiếng Việt có dấu bị lưu sai (mojibake, ví dụ "Báo cáo..." thành "BÃ¡o cÃ¡o..."). Fix: `defParamCharset: 'utf8'` ở `server/config/upload.js` (chỉ ảnh hưởng `file.originalname` multer đọc được — KHÔNG ảnh hưởng tên file trên đĩa, luôn là `crypto.randomUUID()`). Test: `server/tests/reportUpload.test.js` ("Upload tên file tiếng Việt có dấu"), `e2e/full-workflow.spec.js` Bước 4 dùng file tên `Báo cáo thực tập tuần 1.pdf` thật.

## 17. Tài liệu dự án

| Tài liệu | Nội dung |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Kiến trúc chi tiết frontend + backend |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | Schema đầy đủ 14 bảng, quan hệ, constraint |
| [`docs/DATA_MIGRATION.md`](docs/DATA_MIGRATION.md) | Ghi chú quá trình migrate dữ liệu mock → MySQL |
| [`docs/API_INDEX.md`](docs/API_INDEX.md) | Danh mục toàn bộ domain API |
| [`docs/PHASE_INDEX.md`](docs/PHASE_INDEX.md) | Danh mục toàn bộ tài liệu theo từng phase phát triển |
| [`docs/PHASE_6B_AUTOMATED_TESTING.md`](docs/PHASE_6B_AUTOMATED_TESTING.md) | Chi tiết automated test suite |
| [`docs/PHASE_6C_DOCUMENTATION.md`](docs/PHASE_6C_DOCUMENTATION.md) | Phase tạo ra README/tài liệu này |
| [`docs/REQUIREMENT_TRACEABILITY_MATRIX.md`](docs/REQUIREMENT_TRACEABILITY_MATRIX.md) | Ma trận truy vết yêu cầu — trạng thái bằng chứng từng REQ |
| [`docs/PHASE_7C_FINAL_PREPARATION.md`](docs/PHASE_7C_FINAL_PREPARATION.md) | Chuẩn bị demo/bảo vệ — kèm `FINAL_DEMO_SCRIPT.md`, `DEMO_READINESS_CHECKLIST.md`, `DEFENSE_QA.md`, `DEFENSE_PRESENTATION_OUTLINE.md` |

## 18. Known Limitations

- **Browser E2E đã tự động hóa bằng Playwright** (`npm run test:e2e`, xem Mục 15) — 13/13 PASS, bao phủ luồng chính 4 role. Chưa bao phủ: edge case lỗi hiếm (mất mạng giữa chừng, race condition 2 tab cùng thao tác), responsive/mobile viewport, và các nhánh phụ ít dùng (ví dụ từ chối đề tài, hủy hồ sơ) — chỉ smoke test luồng happy-path chính, không phải full regression suite UI.
- **Notifications tự động nhưng KHÔNG có retry/hàng đợi** — `notificationService.notify()` chỉ là 1 `INSERT` đơn giản chạy ngay sau khi nghiệp vụ chính thành công; nếu ghi thông báo lỗi (DB tạm gián đoạn...), lỗi đó bị `console.error` và bỏ qua êm (không làm fail nghiệp vụ chính, nhưng thông báo đó sẽ KHÔNG được gửi lại) — đây là quyết định phạm vi có chủ đích ("đơn giản, không cần event engine/queue"), không phải race-condition chưa xử lý.
- **Upload file báo cáo lưu trực tiếp trên đĩa server** (`server/uploads/reports/`, qua `multer`) — không dùng object storage (S3...), chỉ phù hợp 1 server instance duy nhất (không scale ngang được nếu không thêm storage dùng chung). Chỉ nhận `.pdf`/`.doc`/`.docx`, tối đa 10MB — xem `server/config/upload.js`.
- **Automated backend test chạy trên database test riêng** (`DB_NAME_TEST`, tạo qua `npm run test:setup` — xem Mục 15), tách biệt khỏi database dev; mọi test có ghi dữ liệu vẫn tự dọn dẹp trong cùng lần chạy (xem `docs/PHASE_6B_AUTOMATED_TESTING.md` Mục 4) để chạy lại nhiều lần không cần `test:setup` lại. Database test này chạy trên cùng MySQL/MariaDB instance local với dev (không phải service/container cô lập riêng).
- **Lint frontend có baseline 41 warning đã biết** (chủ yếu `react(set-state-in-effect)` và `react(only-export-components)`, từ pattern đồng bộ state cục bộ với prop/context bất đồng bộ — `useFinalResult.js` thêm 1 warning cùng loại) — không phải lỗi mới, không che giấu, chỉ là baseline đã xác lập qua nhiều phase.
- **Export (.xlsx) có UI ở Admin, Lecturer, Company Mentor** — backend đã hỗ trợ đúng scope cho cả 4 role (verify qua test), nhưng Student hiện chưa có nút export trên UI (không thuộc yêu cầu hiện tại; API vẫn dùng được nếu tự gọi).
- Chưa có CSRF/refresh token/HTTPS — xem Mục 16. Rate limiting hiện chỉ áp dụng cho `POST /api/auth/login`.
- **Rate limiting không có automated test cho hành vi chặn thật** (chặn sau 10 lần/15 phút) — vì middleware tự tắt khi `NODE_ENV=test` (đúng chủ đích, tránh chặn chính test suite), nên chỉ xác minh được "không chặn khi test" qua test, hành vi chặn thật khi `NODE_ENV!=test` xác minh bằng code review (xem `server/middleware/rateLimiter.js`).

## 19. Trạng thái dự án

```
Backend:  14/14 bảng, 19/19 foreign key, 225/225 automated test PASS (chạy trên DB test riêng)
Frontend: build PASS (0 lỗi), lint 41 warning (baseline đã biết)
Browser:  13/13 Playwright E2E PASS (npm run test:e2e — Chromium thật, luồng chính 4 role)
```

Toàn bộ chức năng CRUD, RBAC, ownership/scope, business rule, và export (.xlsx) đã được implement và kiểm chứng qua HTTP thật + automated test. Giới hạn còn lại được ghi nhận minh bạch ở Mục 18 — không có chức năng nào được mô tả "hoàn chỉnh" nếu chưa thực sự kiểm chứng được qua code/test thật.
