# ARCHITECTURE — Hệ thống Quản lý Thực tập Tốt nghiệp

Tài liệu này mô tả kiến trúc **thực tế hiện tại** của codebase (không phải thiết kế lý tưởng hóa) — đối chiếu trực tiếp với `client/src/`, `server/`, và các tài liệu từng phase trong `docs/`.

## 1. Tổng quan luồng request

```
Frontend (React)
   ↓ fetch() qua client/src/api/apiClient.js (tự đính kèm Authorization: Bearer <JWT>)
REST API (Express, server/app.js)
   ↓
JWT Authentication — server/middleware/authMiddleware.js (requireAuth)
   ↓
Role Authorization — server/middleware/authorizationMiddleware.js (requireRole(...roles))
   ↓
Controller — server/controllers/*.js (validate format request)
   ↓
Service / scopeService — server/services/*.js (business rule + ownership/scope + query MySQL)
   ↓
MySQL (mysql2/promise pool, parameterized query — không ORM)
```

Mỗi layer có đúng 1 trách nhiệm, không lớp nào làm việc của lớp khác:
- **authMiddleware**: CHỈ xác thực danh tính (ai đang gọi, dựa trên JWT hợp lệ) — không biết gì về role/quyền.
- **authorizationMiddleware**: CHỈ kiểm tra role ở route-level (vd. `requireRole('admin')`) — không biết gì về ownership dữ liệu cụ thể.
- **Controller**: CHỈ validate format (required, kiểu dữ liệu, enum hợp lệ) — không chứa business rule.
- **Service**: business rule thật (status transition, khóa khi đã review/publish, ownership/scope theo role) + câu lệnh SQL.

## 2. Backend architecture

```
server/
├── app.js            # Khởi tạo Express, mount toàn bộ route, error handler
├── server.js         # Entry point thật (load .env, app.listen)
├── routes/           # 1 file/entity — khai báo HTTP method + middleware (requireAuth/requireRole)
├── controllers/       # Validate format, gọi service, format response (sendSuccess)
├── services/           # Business logic + query MySQL (pool.execute với placeholder `?`)
├── middleware/
│   ├── authMiddleware.js            # requireAuth — verify JWT, query lại users, gán req.user
│   ├── authorizationMiddleware.js   # requireRole(...roles) — route-level role gate
│   └── errorHandler.js              # notFoundHandler + errorHandler (JSON error response chung)
├── services/scopeService.js   # Resolve "hồ sơ của chính currentUser" dùng chung cho mọi service
├── config/database.js  # mysql2 pool (đọc config từ .env qua dotenv)
├── db/
│   ├── schema.sql     # DDL — 14 bảng, 19 FK
│   └── seed.sql       # Dữ liệu mẫu
├── utils/
│   ├── AppError.js         # Error class có statusCode, dùng xuyên suốt service/controller
│   ├── asyncHandler.js     # Wrap async route handler, forward lỗi vào errorHandler
│   ├── response.js         # sendSuccess(res, {statusCode, message, data})
│   ├── validators.js       # isRequired/isValidEmail/isValidPhone/isValidId/isValidDate
│   └── internshipStatus.js # ALLOWED_TRANSITIONS (đồng bộ với client)
└── tests/              # Automated HTTP integration test (node:test) — xem PHASE_6B_AUTOMATED_TESTING.md
```

### 2.1. Authentication

`POST /api/auth/login` → `authService.login(email, password)`: tìm user theo email, `bcrypt.compare()` với `password_hash`, nếu khớp ký JWT `jwt.sign({sub: user.id, role: user.role}, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN})`. Payload JWT **tối thiểu** — không chứa password/password_hash/fullName/email.

`requireAuth` (mọi route trừ `POST /auth/login`): verify JWT → lấy `payload.sub` → **query lại DB** (`findUserById`) để lấy thông tin user mới nhất → gán `req.user = toSafeUser(user)` (`{id, fullName, email, role}`, không bao giờ có `password_hash`). Vì luôn query lại DB mỗi request, role/thông tin user không bao giờ "cũ" dù token còn hạn dài.

### 2.2. Authorization

2 lớp độc lập, không lớp nào thay lớp kia:

1. **Route-level RBAC** (`requireRole(...roles)`): chặn theo role trước khi vào controller — vd. `POST /api/departments` chỉ `admin`.
2. **Data-level ownership/scope** (trong service, thường qua `scopeService`): với role không phải `admin`, mọi câu truy vấn list/detail/update đều tự thêm điều kiện giới hạn theo `student_id`/`lecturer_id`/`company_mentor_id` suy ra từ `req.user.id` — **không bao giờ tin tham số từ client** (query param, body field) để xác định phạm vi.

Ví dụ `scopeService` (`server/services/scopeService.js`):
```
resolveOwnProfileIds(currentUser)  → {studentId, lecturerId, companyMentorId} suy từ currentUser.id
isOwnInternship(internship, currentUser, ownIds)  → true/false
assertOwnInternshipById(internshipId, currentUser) → throw 403 nếu không phải chủ sở hữu
```

**Admin bypass ownership nhưng KHÔNG bypass business rule** — đã verify qua test: Admin không sửa được điểm đánh giá đã công bố, không revert được log đã "reviewed", không tạo được Internship bỏ qua validate.

### 2.3. Immutable field convention

Mọi field không được sửa qua API (vd. `role`, `profile_id` ở Users; `student_id`, `period_id` ở Internships; `internship_id`, `evaluator_role` ở Evaluations) bị **reject cứng toàn bộ request (400)** nếu field đó có mặt trong payload — không silently bỏ qua giá trị gửi lên.

### 2.4. Export (Phase 5)

`server/services/exportService.js`: build `ExcelJS.Workbook` trong bộ nhớ (không ghi file tạm, không bảng DB mới) từ truy vấn JOIN trực tiếp (không gọi N+1 query), scope giống hệt endpoint GET tương ứng. Controller chỉ set HTTP header (`Content-Type`, `Content-Disposition`) và stream workbook vào response.

## 3. Database

```
MariaDB/MySQL — database `internship_management`
14 bảng, 19 foreign key
```
Chi tiết đầy đủ từng bảng/cột/constraint: [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md). Nguyên tắc: `users` (tài khoản) và `students`/`lecturers`/`company_mentors` (hồ sơ nghiệp vụ) là 2 khái niệm tách biệt, liên kết 1:0..1 qua `user_id` (nullable — 1 hồ sơ có thể chưa có tài khoản đăng nhập).

## 4. Frontend architecture

```
client/src/
├── api/        # 1 module/entity (departmentApi.js, studentApi.js, ...) — chỉ gọi apiClient, không
│                 chứa logic UI. Một vài module có mapper tại đây (API boundary) khi backend/frontend
│                 lệch casing (vd. settingsApi.js, userApi.js).
├── context/    # 1 Context/entity — state quản lý qua Context API, API-backed (không mock)
├── pages/      # Theo route/role: admin/, student/, lecturer/, company/, auth/
├── components/ # Component dùng lại (FormModal, DataTable, layout...)
├── routes/     # ProtectedRoute.jsx — role-gate ở route (chỉ là UX, backend vẫn enforce lại)
├── hooks/      # useCurrentStudent/useCurrentLecturer/useCurrentCompanyMentor,
│                 useMyInternship/useMyAssignedInternships/useMyMentoredInternships
└── utils/      # Hằng số/logic thuần (STATUS_META, validator...) — đồng bộ với backend tương ứng
```

### 4.1. Nguyên tắc "1 entity = 1 nguồn dữ liệu"

Mỗi entity nghiệp vụ có đúng 1 Context, state của Context đó lấy từ đúng 1 API module, API module đó gọi đúng 1 route backend, route đó đọc/ghi đúng 1 bảng MySQL (hoặc JOIN rõ ràng cho mục đích hiển thị). Không có Context nào duplicate dữ liệu của Context khác — vd. "Users" (tài khoản) và "Students/Lecturers/CompanyMentors" (hồ sơ) là 2 Context tách biệt, không merge.

Factory dùng chung: `createApiResourceContext.jsx` — dùng cho 11/15 entity có interface CRUD giống nhau (`items, isLoading, isMutating, error, getById, addItem, updateItem, deleteItem, isFieldTaken`). 3 entity còn lại viết tay do semantics riêng: `UsersContext` (không có delete), `SettingsContext` (single-row, không phải collection), `InternshipsContext` (giữ interface cũ `internships/addInternship/...` để không phá nhiều consumer).

### 4.2. Role-aware Provider loading (Phase 6A)

Mọi Provider fetch dữ liệu chỉ khi `currentUser` (từ `AuthContext`) đã xác định — không gọi API trước khi biết ai đang đăng nhập, và không gọi API cho role không cần dữ liệu đó:
- `UsersProvider`: chỉ fetch khi `role === 'admin'` (`/api/users` là Admin-only ở backend).
- `SettingsProvider`: chỉ fetch khi role ∈ {admin, student} (2 role duy nhất thực sự tiêu thụ `useSettings()`).
- `NotificationsProvider`: chỉ fetch khi role ∈ {student, lecturer, company_mentor} (không có trang Admin nào dùng).
- 11 Provider còn lại: fetch cho bất kỳ ai đã đăng nhập (dùng chung cho cả 4 role).

Logic quyết định (`canLoadUsers`/`canLoadSettings`/`canLoadNotifications`) tách riêng ở `client/src/context/providerAccess.js` (module JS thuần, test được bằng `node:test` không cần React). Chi tiết: [`PHASE_6A_ROLE_AWARE_PROVIDER_LOADING.md`](PHASE_6A_ROLE_AWARE_PROVIDER_LOADING.md).

### 4.3. Authentication state

`AuthContext` giữ `currentUser` (null nếu chưa đăng nhập) và `isInitializing` (đang khôi phục session từ token lưu trong `localStorage` qua `GET /api/auth/me`). `ProtectedRoute.jsx` chờ `isInitializing=false` rồi mới quyết định redirect `/login` hay render route con theo `allowedRoles`.

**Frontend role-gate ở `ProtectedRoute`/ẩn menu chỉ là UX — không phải bảo mật.** Backend luôn là nguồn xác thực/phân quyền cuối cùng (đã kiểm chứng bằng automated test: gọi trực tiếp API bằng JWT của role không phù hợp luôn nhận 403 bất kể frontend có route/menu nào hay không).

## 5. Không có trong kiến trúc hiện tại (để tránh hiểu nhầm)

- Không có Redux/Zustand/React Query/MobX — chỉ Context API thuần.
- Không có ORM — mysql2 thuần với parameterized query.
- Không có GraphQL — REST thuần.
- Không có message queue/background job — export sinh đồng bộ (dataset đủ nhỏ).
- Không có WebSocket/real-time — mọi dữ liệu fetch qua REST, không có push.
- Không có cache layer (Redis...) — mỗi request query trực tiếp MySQL.
