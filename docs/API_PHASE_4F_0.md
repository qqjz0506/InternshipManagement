# API PHASE 4F-0 — Users / Accounts Deep Audit (READ-ONLY, NO CODE CHANGES)

Phase này chỉ đọc code và tài liệu hóa. Không sửa frontend/backend/schema/database/endpoint nào.

## 1. Current Users schema

`server/db/schema.sql` (bảng `users`, dòng 20-30):

```sql
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','student','lecturer','company_mentor') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;
```

- PK: `id` (auto-increment).
- UNIQUE: `email` (`uk_users_email`).
- NOT NULL: tất cả field trừ `created_at`/`updated_at` (có default).
- ENUM `role`: đúng 4 giá trị `admin`, `student`, `lecturer`, `company_mentor` — không có giá trị nào khác (ví dụ không có `inactive`/`locked`).
- **Không có cột trạng thái** (`is_active`, `status`, `locked`...) — tài khoản không có khái niệm khóa/mở khóa ở tầng schema.
- **Không có `last_login`, `refresh_token`, `failed_attempts`** hay bất kỳ field bảo mật mở rộng nào khác.
- Index: `idx_users_role` (role).
- Không có FK nào từ `users` TRỎ RA bảng khác (users là bảng "gốc", chỉ bị tham chiếu TỪ bảng khác — xem mục 12).

## 2. Seed user accounts

`server/db/seed.sql` dòng 62-72 — đúng 10 dòng, khớp baseline `users = 10` (đã verify lại bằng `SELECT COUNT(*)` thật ở Phase 4E-3, không dùng `information_schema` estimate):

| id | full_name | email | role |
|---|---|---|---|
| 1 | Quản trị viên | admin@example.com | admin |
| 2 | Nguyễn Minh Anh | student@example.com | student |
| 3 | Trần Quốc Bảo | lecturer@example.com | lecturer |
| 4 | Lê Hoàng Nam | company@example.com | company_mentor |
| 5 | Hoàng Văn Đức | student2@example.com | student |
| 6 | Lý Gia Bảo | student3@example.com | student |
| 7 | Phạm Văn Sơn | lecturer2@example.com | lecturer |
| 8 | Trịnh Thảo My | student4@example.com | student |
| 9 | Nguyễn Thị Hạnh | company2@example.com | company_mentor |
| 10 | Lê Văn Kiên | company3@example.com | company_mentor |

Mật khẩu plaintext test (ghi trong `docs/API_PHASE_3A.md` mục 9, KHÔNG lưu plaintext trong DB — chỉ bcrypt hash cost 10 trong `password_hash`): `admin123`, `student123` (chung cho cả 4 student), `lecturer123` (chung cho cả 2 lecturer), `company123` (chung cho cả 3 mentor).

**Thực tế khớp đúng baseline — không có sai lệch cần ghi nhận.**

## 3. Auth contract

```http
POST /api/auth/login   (không cần token)
GET  /api/auth/me      (requireAuth)
```

`authController.js` + `authService.js`:
- `login(email, password)`: tìm user theo email (`SELECT * FROM users WHERE email = ?`), so `bcrypt.compare(password, user.password_hash)`. Message lỗi tổng quát hóa (`"Email hoặc mật khẩu không chính xác."`) cho cả 2 trường hợp (không tồn tại / sai mật khẩu) — chống user enumeration, đã document từ Phase 3A.
- Response: `{success, message, data: {accessToken, user: toSafeUser(user)}}`.
- `toSafeUser(user)` = `{id, fullName, email, role}` — **loại bỏ hoàn toàn `password_hash`**, đây là DTO DUY NHẤT dùng cho mọi nơi trả user ra ngoài (login, `/me`, và gán vào `req.user` trong `authMiddleware`).
- `GET /me`: trả thẳng `req.user` (đã là `toSafeUser` shape, gán bởi `requireAuth`).

**Không có `/api/auth/register`, `/api/auth/change-password`, `/api/auth/refresh`, `/api/auth/logout`** — logout hiện tại hoàn toàn phía client (`AuthContext.logout()` chỉ `clearToken()` + `setCurrentUser(null)`, không gọi API nào).

## 4. JWT contract

```js
jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
```

- Payload CHỈ có `sub` (= `users.id`) và `role`. **Xác nhận không có `password`/`password_hash`/`email`/`fullName`** trong payload.
- `requireAuth` (authMiddleware.js) verify token → lấy `payload.sub` → `authService.findUserById(sub)` → `req.user = toSafeUser(user)` (query lại DB mỗi request, không tin thông tin cũ trong token ngoài `id`/`role` — nghĩa là nếu Admin đổi `full_name`/`email` của 1 user, request tiếp theo của chính họ sẽ thấy giá trị mới ngay, không cần đăng nhập lại; nhưng nếu đổi `role`, JWT cũ vẫn giữ `role` cũ cho tới khi hết hạn/đăng nhập lại — vì `role` lấy từ payload khi `jwt.sign`, còn `req.user.role` sau đó được gán lại từ DB (`toSafeUser(user)`) ở MỌI request kế tiếp, nên thực ra role LUÔN được đọc lại từ DB, không bị stale — xem chi tiết mục 14 "role thay đổi giữa chừng").
- Token lưu ở `localStorage` dưới key `itm_access_token` (`apiClient.js`), quản lý qua `getToken/setToken/clearToken`.
- `requireAuth` không tự logout khi 401 (tránh vòng lặp phụ thuộc `apiClient → AuthContext → apiClient`) — caller tự xử lý.
- `requireRole(...roles)` (authorizationMiddleware.js): thuần role-check, 403 nếu sai role (401 chỉ xảy ra nếu thiếu `req.user`, về lý thuyết không xảy ra vì `requireAuth` luôn chạy trước).

## 5. Role contract

4 role đúng như schema: `admin`, `student`, `lecturer`, `company_mentor`. Không có role nào khác trong code (routes/controllers/services đều chỉ dùng đúng 4 giá trị này, đã grep toàn bộ `requireRole(...)` — liệt kê đầy đủ ở mục 11 RBAC dependency map).

Theo role:

- **Admin**: không có "own profile" (không có bản ghi `students`/`lecturers`/`company_mentors` nào trỏ tới `user_id` của admin theo thiết kế — admin không liên kết profile nghiệp vụ). Có quyền route-level CRUD gần như mọi entity (trừ Settings GET vẫn mở cho mọi role). Bypass ownership nhưng KHÔNG bypass validation/FK/business-rule lock (đã verify qua nhiều phase trước: Topic approve, InternshipLog reviewed-lock, Evaluation published-lock).
- **Student**: ownership qua `students.user_id = req.user.id`, resolve bởi `scopeService.getStudentProfile(userId)`. Nếu role=student nhưng CHƯA được Admin liên kết `user_id` (profile null) → mọi check ownership tự nhiên fail (không throw ở scopeService, controller/service tự quyết định message).
- **Lecturer**: tương tự qua `lecturers.user_id`.
- **Company Mentor**: tương tự qua `company_mentors.user_id`.

Không có khái niệm multi-role (1 user luôn đúng 1 `role` cố định trong `users.role`).

## 6. UsersContext contract (frontend) — **ĐIỂM QUAN TRỌNG NHẤT CỦA AUDIT NÀY**

```js
// client/src/context/UsersContext.jsx
const { Provider, useResource } = createResourceContext(MOCK_USERS, 'Users')
```

**`UsersContext` VẪN HOÀN TOÀN LÀ MOCK — chưa từng được migrate, hoàn toàn tách biệt khỏi bảng `users` thật của backend, kể cả sau khi Auth đã chuyển sang JWT thật từ Phase 3A.**

- Dùng `createResourceContext` (factory mock THUẦN, đồng bộ — KHÔNG phải `createApiResourceContext`). `addItem`/`updateItem`/`deleteItem` chạy đồng bộ, chỉ sửa state trong bộ nhớ React, biến mất khi F5.
- `MOCK_USERS` (`client/src/data/mockUsers.js`) là mảng 10 object `{id, fullName, email, password, role}` — **có field `password` dạng PLAINTEXT**, giá trị trùng với plaintext test password thật (`admin123`, `student123`...), nhưng đây là 1 bản dữ liệu HOÀN TOÀN RIÊNG, không hề đọc/ghi gì tới bảng `users` thật.
- ID trong `MOCK_USERS` (1-10) hiện **trùng ngẫu nhiên** với ID thật trong bảng `users` (cũng 1-10, cùng thứ tự email/role) — đây là sự trùng hợp duy trì thủ công từ lúc migrate Auth (Phase 3A), KHÔNG được đảm bảo bởi bất kỳ cơ chế đồng bộ nào. Bất kỳ thay đổi nào ở 1 trong 2 phía (seed thật hoặc mock) mà không sửa phía kia sẽ làm lệch ngay.
- `isFieldTaken('email', ...)` chỉ kiểm tra trùng trong `MOCK_USERS`, không kiểm tra trùng với bảng `users` thật.

## 7. AdminAccountsPage behavior (đọc code thật, không suy đoán)

### Create
- Form (`AccountFormModal`, mode tạo mới): `fullName` (required), `email` (required, format hợp lệ, không trùng — check qua `isFieldTaken` TRÊN MOCK), `password` (required, không có rule độ mạnh), `role` (select, mặc định `student`, không giới hạn — có thể tạo thêm Admin mới), `linkedProfileId` (optional, chỉ hiện khi role ≠ admin, danh sách lấy từ "hồ sơ CHƯA có `user_id`" của đúng loại — `unlinkedByRole` tính từ Student/Lecturer/CompanyMentor Context thật).
- Submit: `addUser({fullName, email, password, role})` (ghi vào MOCK, đồng bộ, trả `newUser` có `.id` = ID mock tiếp theo). Nếu có `linkedProfileId`: gọi `updateStudent`/`updateLecturer`/`updateMentor` với **toàn bộ record hiện có + `user_id: newUser.id`** — đây là lời gọi tới API THẬT (Students/Lecturers/CompanyMentors đã migrate REST, Phase 4B-2/4B-3).
- **RỦI RO CỤ THỂ phát hiện tại đây (xem thêm mục 9 "Risks")**: `newUser.id` là ID mock (ví dụ 11, 12...) — nếu không trùng với 1 user thật đang tồn tại trong bảng `users`, backend `validateReferences()` của Student/Lecturer/CompanyMentor service sẽ reject 400 ("Tài khoản (user_id) không tồn tại") nhờ `userExists()` + FK thật — tức luồng "tạo account mới rồi link ngay" trong UI hiện tại **sẽ luôn thất bại ở bước link** với bất kỳ account nào tạo sau 10 account seed ban đầu, vì ID mock mới không tồn tại thật trong DB. Đây không phải lỗi migration cần sửa ngay (vẫn đúng scope audit) — chỉ ghi nhận để Phase 4F thiết kế đúng.

### Edit
- Chỉ sửa được `fullName`, `email`, `password` (role và linked profile: input/field bị `disabled`, không sửa được sau khi tạo — comment trong code giải thích rõ: tránh đổi role sau khi tạo gây lệch dữ liệu vì Student/Lecturer/CompanyMentor.user_id không tự đổi theo).
- Password field LUÔN pre-fill plaintext từ `initialData.password` — nghĩa là mỗi lần Edit (kể cả chỉ đổi họ tên), payload gửi đi vẫn luôn kèm `password` (cũ hoặc mới, không phân biệt "không đổi mật khẩu").
- **Immutable theo UI (không phải theo schema)**: `role`, `linkedProfileId` — chỉ do UI tự giới hạn (field disabled), KHÔNG có enforcement nào ở tầng dữ liệu/service thật vì toàn bộ `UsersContext` là mock.

### Delete
```
KHÔNG CÓ — AdminAccountsPage không có nút/hành động xóa account nào.
```
Không tự thêm trong audit này.

### Lock/Unlock
```
KHÔNG CÓ — không có field trạng thái ở cả schema lẫn mock, không có UI khóa/mở khóa.
```
Comment trong chính code (`AdminAccountsPage.jsx` dòng 26-27, 218-221) xác nhận rõ: "chưa hỗ trợ khóa/mở khóa vì model tài khoản hiện tại chưa có field trạng thái."

## 8. Account linking model

Schema (`schema.sql`):

```
students.user_id         INT UNSIGNED NULL, UNIQUE (uk_students_user)
  FK → users(id) ON DELETE SET NULL ON UPDATE CASCADE
lecturers.user_id        INT UNSIGNED NULL, UNIQUE (uk_lecturers_user)
  FK → users(id) ON DELETE SET NULL ON UPDATE CASCADE
company_mentors.user_id  INT UNSIGNED NULL, UNIQUE (uk_company_mentors_user)
  FK → users(id) ON DELETE SET NULL ON UPDATE CASCADE
```

- Cả 3 đều **nullable** (1 student/lecturer/mentor có thể tồn tại mà CHƯA có tài khoản đăng nhập liên kết — đúng mô hình "hồ sơ nghiệp vụ" và "tài khoản đăng nhập" là 2 khái niệm tách biệt).
- Cả 3 đều **UNIQUE** — 1 user chỉ được link tối đa 1 student / tối đa 1 lecturer / tối đa 1 mentor (TRONG CÙNG 1 bảng).
- Validate ở service layer (`studentService.js`/`lecturerService.js`/`companyMentorService.js`, hàm `validateReferences`):
  - `userExists(user_id)` — **CHỈ kiểm tra `user_id` có tồn tại trong bảng `users`, KHÔNG kiểm tra `users.role` có khớp với loại profile hay không.**
  - `isUserLinkedToOther<Student|Lecturer|Mentor>(user_id, ignoreId)` — chặn trùng TRONG CÙNG bảng (409 nếu đã bị user khác chiếm), khớp với UNIQUE KEY ở schema.

Xem mục "Current gaps"/"Risks" bên dưới cho hệ quả của việc KHÔNG kiểm tra role.

## 9. Password/security analysis

```
PASS (backend) / FAIL có kiểm soát (frontend mock-only, không ảnh hưởng hệ thống thật)
```

- Backend: `password_hash` KHÔNG BAO GIỜ rời khỏi `authService`/DB — `toSafeUser()` là DTO duy nhất trả user ra ngoài, dùng nhất quán ở login/`/me`/`req.user`. Không có API nào khác (`/students`, `/lecturers`,...) trả `password_hash` vì các bảng đó không có cột này; JOIN sang `users` cũng không xảy ra ở bất kỳ service nào (đã đọc hết `studentService`/`lecturerService`/`companyMentorService` — chỉ `SELECT id FROM users` cho mục đích tồn tại-kiểm-tra, không bao giờ `SELECT *` hay trả nguyên row `users`).
- JWT: xác nhận lại payload chỉ `{sub, role}` — không password.
- **Frontend (`UsersContext`/`MOCK_USERS`/`AccountFormModal`)**: lưu và hiển thị-ngược-vào-form (pre-fill) plaintext `password` — nhưng đây là dữ liệu MOCK HOÀN TOÀN TÁCH BIỆT khỏi backend thật, không phải lỗ hổng "API expose password_hash" theo đúng nghĩa mục 6 của phase yêu cầu kiểm tra. `AccountDetailModal` xác nhận KHÔNG hiển thị password ở chế độ xem.
- **Không có STOP-worthy blocker** theo đúng tiêu chí mục 6 của đề bài ("API hiện tại expose password_hash") — không có API thật nào expose password_hash. Việc `UsersContext` giữ mock password plaintext là vấn đề kiến trúc cần giải quyết KHI migrate (Phase 4F), không phải lỗ hổng bảo mật đang khai thác được trên hệ thống thật (không có endpoint nào đọc được giá trị này ra ngoài phạm vi chính UsersContext/AdminAccountsPage).

## 10. Backend User API status

```
NO USER CRUD API
```

Đã liệt kê toàn bộ file trong `server/routes/` (15 file) — không có `userRoutes.js` hay `accountRoutes.js`. Chỉ có `authRoutes.js` (`POST /login`, `GET /me`). Không tạo route nào trong phase audit này.

## 11. RBAC dependency map

```
users
 ├── authService.findUserByEmail / findUserById / toSafeUser
 ├── authMiddleware.requireAuth        (mọi route trừ POST /auth/login) → gán req.user (id, fullName, email, role)
 ├── authorizationMiddleware.requireRole(...roles)  (gate theo role tại route-level, dùng ở:
 │     topicRoutes, studentRoutes, settingsRoutes, reportRoutes, notificationRoutes, lecturerRoutes,
 │     internshipRoutes, internshipLogRoutes, internshipPeriodRoutes, companyMentorRoutes,
 │     departmentRoutes, companyRoutes, evaluationRoutes — 13/15 route file, trừ authRoutes & healthRoutes)
 ├── scopeService (dùng req.user.id + req.user.role để resolve ownership) — import bởi:
 │     studentService, lecturerService, companyMentorService, internshipService, internshipLogService,
 │     reportService, evaluationService, topicService (8/15 service)
 ├── students.user_id        (FK, ownership Student)
 ├── lecturers.user_id       (FK, ownership Lecturer)
 ├── company_mentors.user_id (FK, ownership Company Mentor)
 └── notifications.user_id   (FK, ownership trực tiếp — KHÔNG qua scopeService, so sánh thẳng
                               req.user.id trong notificationService)
```

Mọi nơi dùng `req.user.id`/`req.user.role` trực tiếp (ngoài scopeService): `topicController.js`, `evaluationController.js`, `internshipController.js`, `studentController.js`, `notificationService.js`, `authorizationMiddleware.js`.

**Kết luận bắt buộc cho Phase 4F**: migration Users KHÔNG được đổi field name `id`/`role` trong `req.user` (toàn bộ 8 service + 6 controller/middleware nêu trên phụ thuộc trực tiếp vào đúng 2 field này), và KHÔNG được đổi hành vi `requireAuth` (query lại DB mỗi request) vì đó là cơ chế duy nhất đảm bảo role/thông tin user luôn mới.

## 12. FK / delete dependency map (toàn bộ FK trỏ tới `users.id`)

```
students.user_id          → users(id)  ON DELETE SET NULL  ON UPDATE CASCADE
lecturers.user_id         → users(id)  ON DELETE SET NULL  ON UPDATE CASCADE
company_mentors.user_id   → users(id)  ON DELETE SET NULL  ON UPDATE CASCADE
notifications.user_id     → users(id)  ON DELETE CASCADE   ON UPDATE CASCADE
```

Đúng 4 FK trỏ tới `users` (đã grep toàn bộ `schema.sql`, khớp với tổng 19 FK toàn hệ thống đã verify ở Phase 4E-2/4E-3).

**Hệ quả nếu xóa 1 user (hiện KHÔNG có API nào làm việc này — chỉ phân tích lý thuyết theo schema)**:
- Student/Lecturer/CompanyMentor liên kết: `user_id` tự động → `NULL` (hồ sơ nghiệp vụ vẫn còn nguyên vẹn, chỉ mất liên kết đăng nhập — KHÔNG mất dữ liệu internship/log/report/evaluation của họ, vì các bảng đó không FK trực tiếp tới `users`, mà FK tới `students.id`/`lecturers.id`/`company_mentors.id`, các bảng này không bị xóa).
- Notifications của user đó: **bị xóa toàn bộ** (CASCADE) — đây là rủi ro mất dữ liệu thật sự nếu có tính năng xóa user trong tương lai.
- Không có FK nào là `RESTRICT` — nghĩa là xóa user hiện tại (nếu có API) sẽ KHÔNG bao giờ bị chặn bởi ràng buộc dữ liệu liên quan, luôn thành công âm thầm (trừ việc mất notifications).

## 13. Current invariants (xác nhận từ code, không suy đoán)

- `users.role` ∈ {admin, student, lecturer, company_mentor} — **enforced bởi DB ENUM**.
- `users.email` unique — **enforced bởi DB UNIQUE KEY**.
- `students.user_id`/`lecturers.user_id`/`company_mentors.user_id` mỗi cái unique TRONG BẢNG ĐÓ — **enforced bởi DB UNIQUE KEY + double-check ở service**.
- **`users.role = 'student'` ⇒ `students.user_id` phải trỏ đúng user đó**: `NOT CURRENTLY ENFORCED`. Không có constraint/trigger/service nào kiểm tra `users.role` khi set `students.user_id`/`lecturers.user_id`/`company_mentors.user_id` — `userExists()` chỉ kiểm tra tồn tại, không kiểm tra role khớp.
- **1 user chỉ được link ĐÚNG 1 loại profile (không thể vừa là student vừa là lecturer)**: `NOT CURRENTLY ENFORCED` ở tầng dữ liệu/service — về lý thuyết, cùng 1 `user_id` CÓ THỂ xuất hiện đồng thời ở `students.user_id`, `lecturers.user_id`, VÀ `company_mentors.user_id` (3 UNIQUE KEY độc lập ở 3 bảng khác nhau, không có ràng buộc chéo). Mức độ khai thác được giới hạn bởi `scopeService.resolveOwnProfileIds()` CHỈ tra cứu đúng 1 loại profile khớp với `currentUser.role` của JWT hiện tại — nên dù dữ liệu bị link sai, request bằng JWT thật của user đó cũng không thể "mượn" quyền của loại profile khác (vì route-level `requireRole` + `resolveOwnProfileIds` đều khóa theo `role` của chính JWT, không theo cái gì đã link). Đây là gap dữ liệu (data integrity), KHÔNG phải lỗ hổng authorization đang khai thác được qua API hiện tại.
- Admin không có profile nghiệp vụ (không có row nào trong students/lecturers/company_mentors trỏ tới user admin theo seed hiện tại) — `NOT ENFORCED` nhưng cũng không có đường dẫn nào trong UI/API tạo ra tình huống ngược lại.

## 14. Current gaps (tổng hợp)

```
1. KHÔNG có API CRUD Users/Accounts thật — AdminAccountsPage 100% mock, tách biệt hoàn toàn khỏi
   backend thật kể từ Phase 3A (Auth thật đã chạy song song với UsersContext mock từ đó tới nay).
2. userExists() ở Student/Lecturer/CompanyMentor service KHÔNG kiểm tra users.role khớp loại profile.
3. Không có ràng buộc chống 1 user bị link vào nhiều loại profile khác nhau cùng lúc.
4. Không có API đổi mật khẩu, đổi role, hay xóa/khóa account nào (kể cả cho Admin tự quản trị).
5. Không có khái niệm "tài khoản vô hiệu hóa" ở schema — không thể tạm khóa 1 user mà không xóa.
6. AdminAccountsPage (frontend) hiện tại dùng ID mock không đồng bộ với ID thật — luồng "tạo account
   mới rồi link ngay vào 1 hồ sơ" trong UI thực tế sẽ bị backend thật reject 400 (mục 7).
7. CompanyMentorsPage.jsx dùng useUsers() (mock) để resolve "tài khoản liên kết" hiển thị cho
   company_mentors.user_id (dữ liệu THẬT) — chỉ đúng nhờ trùng hợp ID 1-10, sẽ sai/trống với bất kỳ
   user thật nào có id > 10 hoặc không khớp mock (ghi nhận, không sửa trong audit này).
8. Role thật của req.user luôn đọc lại từ DB ở mỗi request (không phải từ JWT payload tại thời điểm
   issue) nên KHÔNG có vấn đề "role đổi giữa chừng JWT cũ vẫn có quyền cũ" — xác nhận đây là điểm AN
   TOÀN, không phải gap.
```

## 15. IDOR / security test plan cho Phase 4F implementation (chỉ thiết kế, chưa chạy)

Actor: Admin A, Admin B (nếu seed có ≥2 admin — hiện chỉ có 1, cần tạo thêm lúc test), Student A/B, Lecturer A/B, Mentor A/B.

| Hạng mục | Test cần chạy ở Phase 4F |
|---|---|
| List accounts | Admin → 200 (toàn bộ). Student/Lecturer/Mentor → kỳ vọng 403 (cần route thiết kế rõ, hiện chưa có). |
| Account detail | Admin xem account bất kỳ → 200. Non-admin xem account của chính mình (nếu có endpoint `/me` kiểu account) → 200. Non-admin xem account người khác → 403 (nếu có endpoint list/detail theo id). |
| Create account | Chỉ Admin được tạo (role-level). Test field-injection nếu BE tự sinh `id`/`created_at`. Test trùng email (409). Test role ngoài 4 giá trị hợp lệ (400 — ENUM sẽ tự chặn ở DB nhưng cần 400 sớm ở app layer). |
| Update account | Admin cập nhật account bất kỳ. Non-admin cập nhật account của mình (nếu cho phép tự sửa `fullName`) → cần quyết định rõ field nào tự-sửa được. Non-admin cập nhật account người khác → 403. |
| Password | Chỉ chính chủ (đổi mật khẩu của mình, cần mật khẩu cũ) HOẶC Admin (reset, không cần mật khẩu cũ) — cần quyết định thiết kế, hiện CHƯA có endpoint nào. Test non-admin đổi mật khẩu người khác → 403. |
| Role | Chỉ Admin được đổi `role`. Test non-admin tự đổi role của mình → 403. Test đổi role khi đã có profile liên kết (có nên chặn vì gây mồ côi dữ liệu không — cần quyết định). |
| Profile linking | Chỉ Admin được link/unlink. Test link `user_id` có `role` không khớp loại profile (hiện tại sẽ THÀNH CÔNG — xem mục 13/14, cần quyết định có thêm validate role khi migrate hay không). Test link user đã bị profile khác chiếm (409, theo đúng UNIQUE hiện có). |
| Delete | Hiện tại KHÔNG có — nếu Phase 4F thêm, cần test ảnh hưởng dây chuyền (mục 12): student/lecturer/mentor liên kết → `user_id = NULL`; notifications → bị xóa theo CASCADE. Cần xác nhận với người dùng đây có phải hành vi mong muốn không trước khi thêm. |
| Self-modification | Non-admin tự đổi `role` của mình → phải 403. Non-admin tự đổi `email` của người khác → 403. Non-admin tự đổi mật khẩu của người khác → 403. Non-admin đổi `fullName`/`email` của CHÍNH MÌNH → cần quyết định có cho phép không (hiện chưa có precedent — Student/Lecturer/CompanyMentor update đã có pattern "chỉ sửa field liên hệ của chính mình", có thể dùng làm tham chiếu). |
| Query-bypass | `GET /api/users?role=admin` hoặc `?id=<other>` từ non-admin — phải luôn bị ép về scope hợp lệ (hoặc 403 thẳng), theo đúng convention IDOR đã áp dụng ở mọi entity trước đó. |

## 16. Proposed Phase 4F implementation scope (đề xuất, CHƯA code)

```
Đề xuất chia nhỏ (không tự quyết định cuối cùng — cần xác nhận từ người dùng trước khi code):

4F-1: Backend Users API nền tảng
  - GET /api/users          (Admin only — list, response KHÔNG BAO GIỜ gồm password_hash)
  - GET /api/users/:id      (Admin only, hoặc self — cần quyết định)
  - POST /api/users         (Admin only — tạo account mới, hash password ngay, validate role ENUM)
  - PUT /api/users/:id      (Admin only cho role/email/fullName; cần thiết kế riêng cho đổi password)
  - (Delete: để ngỏ — khuyến nghị KHÔNG thêm trừ khi được yêu cầu rõ, vì rủi ro mất notifications
    CASCADE và hiện không có precedent delete nào ở bất kỳ entity "gốc" nào khác)
  - Thêm validate users.role khớp loại profile khi set student/lecturer/company_mentor.user_id
    (đóng gap mục 14.2) — ĐÂY LÀ THAY ĐỔI SCHEMA/SERVICE, cần xác nhận trước vì ngoài phạm vi "chỉ
    đổi frontend" thông thường của các phase trước.

4F-2: Frontend UsersContext/AdminAccountsPage migration
  - UsersContext → gọi API thật, loại bỏ hoàn toàn MOCK_USERS/password plaintext.
  - AdminAccountsPage/AccountFormModal: bỏ hiển thị/pre-fill password plaintext, đổi sang "đặt mật
    khẩu mới" (write-only field, không pre-fill) nếu muốn hỗ trợ đổi mật khẩu qua form Edit.
  - Sửa lại luồng "tạo + link profile" để dùng user_id THẬT trả về từ POST /api/users (không còn
    lệch ID như mô tả ở mục 7/14.6).
  - CompanyMentorsPage.jsx: đổi nguồn tra cứu "tài khoản liên kết" từ mock UsersContext sang API thật
    (đóng gap mục 14.7).

4F-3 (tùy chọn, cần quyết định riêng): đổi mật khẩu/self-service cho non-admin, nếu được yêu cầu.
```

## 17. Risks

```
- Thêm GET /api/users list toàn bộ account là bề mặt dữ liệu MỚI (email, fullName, role của mọi
  user) — phải chắc chắn chặn đúng role (Admin only) ngay từ route-level, không chỉ ẩn UI.
- Nếu thêm validate "users.role khớp loại profile" ở Phase 4F, đây là THAY ĐỔI HÀNH VI của
  studentService/lecturerService/companyMentorService đã tồn tại từ Phase 3B — cần test regression
  kỹ (có thể có dữ liệu seed/test hiện tại đang "vô tình đúng" nhờ không bị kiểm tra, nhưng cũng có
  thể không có bản ghi nào thực sự sai hiện tại — cần quét dữ liệu thật trước khi bật validate).
- Đổi UsersContext từ sync (createResourceContext) sang async (API-backed) sẽ lặp lại chính xác
  "Promise-as-object bug class" đã gặp ở nhiều phase trước (4B-4, 4C) tại dòng
  `const newUser = addUser({...rest, role})` trong AdminAccountsPage.jsx (hiện đang dùng đồng bộ) —
  PHẢI sửa thành async/await khi migrate, nếu không luồng "tạo + link" sẽ vỡ hoàn toàn.
- CASCADE delete trên notifications.user_id là rủi ro mất dữ liệu nếu Phase 4F thêm chức năng xóa
  user — khuyến nghị không thêm delete trừ khi được yêu cầu minh thị.
- Password response: phải audit lại TOÀN BỘ response shape của bất kỳ endpoint Users mới nào trước
  khi merge — tái sử dụng đúng `toSafeUser()` đã có sẵn trong authService.js thay vì viết DTO mới.
```

## 18. Questions/blockers requiring decision (cần người dùng quyết định trước Phase 4F-1)

```
1. Có cho phép Admin đổi role của 1 account sau khi đã tạo không? (Hiện tại UI khóa cứng field này.)
2. Có cho phép Admin unlink/relink profile sau khi tạo không, hay chỉ link được lúc tạo mới?
3. Cơ chế đổi mật khẩu: Admin reset trực tiếp (không cần mật khẩu cũ) hay chỉ chính chủ tự đổi (cần
   mật khẩu cũ)? Hay cả hai, với 2 luồng riêng?
4. Có cần thêm Delete account không? Nếu có, xử lý thế nào với notifications (CASCADE xóa theo) và
   student/lecturer/mentor liên kết (SET NULL, hồ sơ vẫn còn)?
5. Có cần thêm field trạng thái (active/locked) không? (Hiện tại schema không có — nếu cần, đây là
   THAY ĐỔI SCHEMA, ngoài phạm vi "chỉ migrate frontend".)
6. Có cần enforce "users.role khớp loại profile" khi link không? Nếu có, cần quét dữ liệu hiện tại
   trước để chắc chắn không có bản ghi nào đang vi phạm ngầm.
7. GET /api/users (list) có nên cho non-admin gọi ở dạng giới hạn nào không (ví dụ Lecturer xem email
   cơ bản của sinh viên mình phụ trách), hay tuyệt đối Admin-only? Hiện tại không có nhu cầu nghiệp vụ
   nào trong frontend hiện có đòi hỏi điều này — khuyến nghị Admin-only cho tới khi có yêu cầu cụ thể.
```
