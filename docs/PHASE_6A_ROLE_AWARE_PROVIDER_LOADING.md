# PHASE 6A — Role-Aware Provider Loading

## 1. Problem
Audit sau Phase 5 phát hiện: mọi Provider ở `client/src/App.jsx` mount global, và `useEffect` fetch dữ liệu của chúng chạy **ngay khi mount, không điều kiện** — bất kể người dùng đã đăng nhập hay chưa, và bất kể role hiện tại có thực sự cần dữ liệu đó hay không. Biểu hiện rõ nhất: `UsersProvider` gọi `GET /api/users` (Admin-only ở backend từ Phase 4F-1) ngay cả khi `currentUser` là Student/Lecturer/Company Mentor — luôn nhận 403, mỗi lần tải trang, cho 3/4 role.

## 2. Root cause
Hai nguyên nhân kết hợp:
1. Mọi `useEffect` fetch trong các Context (`createApiResourceContext.jsx` và 3 Context viết tay: `UsersContext`, `SettingsContext`, `InternshipsContext`) có dependency array rỗng `[]` — chạy đúng 1 lần lúc mount, không biết gì về `currentUser`.
2. **`UsersProvider` nằm NGOÀI `AuthProvider`** trong cây provider ở `App.jsx` (`<UsersProvider><AuthProvider>...`) — về mặt kỹ thuật, `UsersProvider` không thể gọi `useAuth()` để đọc `currentUser` dù có muốn, vì React Context chỉ truyền được xuống con, không truyền lên cha. Đây là blocker thực sự cần sửa trước khi có thể làm bất kỳ Provider nào auth-aware.

## 3. Provider audit (actual usage, không suy đoán)

Đã grep toàn bộ `use<Entity>()` call site và đối chiếu với path `pages/{admin,student,lecturer,company}/` + các hook `useCurrent*`/`useMy*` để xác định role nào thực sự tiêu thụ từng Context.

| Provider | API | Roles cần data (thực tế, grep-verified) | Behavior trước | Behavior sau |
|---|---|---|---|---|
| UsersProvider | `/api/users` (Admin-only backend) | **Admin only** | Fetch vô điều kiện lúc mount → 403 cho 3/4 role | Chỉ fetch khi `currentUser.role === 'admin'` |
| SettingsProvider | `/api/settings` (mở cho mọi role ở backend) | **Admin + Student only** (AdminSettingsPage, InternshipsPage, StudentInternshipPage — Lecturer/Company Mentor không trang nào gọi `useSettings()`) | Fetch vô điều kiện | Chỉ fetch khi role ∈ {admin, student} |
| NotificationsProvider | `/api/notifications` | **Student + Lecturer + Company Mentor** (không có `/admin/notifications`, Admin không dùng) | Fetch vô điều kiện | Chỉ fetch khi role ∈ {student, lecturer, company_mentor} |
| DepartmentsProvider | `/api/departments` | Cả 4 role (admin, student, lecturer, company — grep xác nhận cả 4 path) | Fetch vô điều kiện | Fetch khi đã đăng nhập (default factory) |
| InternshipPeriodsProvider | `/api/internship-periods` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| StudentsProvider | `/api/students` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| LecturersProvider | `/api/lecturers` | Cả 4 role (lecturer qua `useCurrentLecturer`) | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| CompaniesProvider | `/api/companies` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| CompanyMentorsProvider | `/api/company-mentors` | Cả 4 role (company qua `useCurrentCompanyMentor`) | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| TopicsProvider | `/api/topics` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| InternshipsProvider | `/api/internships` | Cả 4 role (qua `useMyInternship`/`useMyAssignedInternships`/`useMyMentoredInternships`) | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| InternshipLogsProvider | `/api/internship-logs` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| ReportsProvider | `/api/reports` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |
| EvaluationsProvider | `/api/evaluations` | Cả 4 role | Fetch vô điều kiện | Fetch khi đã đăng nhập |

Phân loại theo đề bài: **A. Admin-only** = Users. **C. Role-specific** = Settings, Notifications. **B. Shared authenticated** = 11 Provider còn lại (Departments → Evaluations) — xác nhận bằng grep thực tế, không mặc định.

## 4. Role matrix (áp dụng)

| Role | Users | Settings | Notifications | 11 shared Provider |
|---|---|---|---|---|
| Admin | ✅ fetch | ✅ fetch | ❌ không fetch | ✅ fetch |
| Student | ❌ không fetch | ✅ fetch | ✅ fetch | ✅ fetch |
| Lecturer | ❌ không fetch | ❌ không fetch | ✅ fetch | ✅ fetch |
| Company Mentor | ❌ không fetch | ❌ không fetch | ✅ fetch | ✅ fetch |
| Chưa đăng nhập | ❌ không fetch | ❌ không fetch | ❌ không fetch | ❌ không fetch |

## 5. Changes made

```
client/src/App.jsx
  — Đổi thứ tự: AuthProvider ra NGOÀI CÙNG, UsersProvider chuyển vào trong (mọi Provider khác đã
    sẵn nằm trong AuthProvider từ trước, không cần đổi thứ tự gì khác).

client/src/context/providerAccess.js   (MỚI — module JS thuần, không JSX)
  — canLoadUsers(currentUser), canLoadSettings(currentUser), canLoadNotifications(currentUser).
  — Tách riêng để test tự động bằng node:test mà không cần render React.

client/src/context/createApiResourceContext.jsx
  — Thêm tham số thứ 3 { shouldLoad = Boolean } — mặc định "bất kỳ ai đã đăng nhập". useEffect gọi
    useAuth() lấy currentUser, gate fetch qua shouldLoad(currentUser), dọn state (items=[], error=
    null, isLoading=false) khi gate false. Dependency đổi từ [] sang [currentUser?.id, currentUser?.role].
  — 10/11 Context dùng factory này KHÔNG cần sửa gì (giữ default).

client/src/context/NotificationsContext.jsx
  — Truyền { shouldLoad: canLoadNotifications } — ngoại lệ DUY NHẤT trong số các Context dùng factory.

client/src/context/UsersContext.jsx
  — useAuth() + gate canLoadUsers(currentUser), cùng pattern dọn state khi gate false.

client/src/context/SettingsContext.jsx
  — useAuth() + gate canLoadSettings(currentUser), dọn về DEFAULT_SETTINGS khi gate false (không
    phải lỗi — giữ shape an toàn như trước khi GET đầu tiên từng trả về).

client/src/context/InternshipsContext.jsx
  — useAuth() + gate Boolean(currentUser) (shared, không cần role-check riêng).

client/src/context/providerAccess.test.js   (MỚI)
  — 3 test node:test cho đúng 3 hàm predicate.

client/package.json
  — Thêm script "test": "node --test src/context/providerAccess.test.js".
```

Không đổi bất kỳ file backend nào. Không đổi API contract/response shape nào. Không đổi route nào.

## 6. Auth initialization behavior
`AuthContext.currentUser` chỉ có giá trị khi: (a) login thành công, hoặc (b) `GET /api/auth/me` (gọi lúc khôi phục session từ token lưu sẵn) đã resolve. Trong lúc `isInitializing === true`, `currentUser` luôn là `null` — nên mọi Provider gate trên `currentUser` (không gate riêng trên `isInitializing`) tự động KHÔNG fetch gì trong giai đoạn này, loại bỏ hoàn toàn race condition "Provider fetch trước khi biết user là ai" nêu ở mục 5 đề bài. Hệ quả phụ (có lợi, ngoài phạm vi ban đầu nhưng đúng tinh thần phase): trước đây, khi mở `/login` (chưa có token), toàn bộ 14 Provider vẫn fetch và nhận 401 đồng loạt — giờ không còn request nào bắn ra cho tới khi đăng nhập thành công.

## 7. Logout/role transition behavior
`useEffect` dependency `[currentUser?.id, currentUser?.role]` (không phải cả object `currentUser`) đảm bảo effect chạy lại đúng 1 lần mỗi khi id HOẶC role đổi — bao gồm logout (`id` → `undefined`). Nhánh "gate false" luôn `setItems([])`/`setUsers([])`/`setSettings(DEFAULT_SETTINGS)` trước khi return — nghĩa là:
```
Admin login → Users loaded → logout → users cleared về [] ngay (gate false, không đợi fetch nào)
Admin logout → Student login → effect chạy lại (id+role đổi) → canLoadUsers(student)=false → users=[]
  → KHÔNG có dữ liệu Admin cũ nào còn sót trong Context.
Student logout → Lecturer login → 11 shared Provider refetch (Boolean(currentUser) vẫn true nhưng
  id+role đổi → effect rerun) → scope mới từ backend ghi đè hoàn toàn state cũ (setItems(data) thay
  thế toàn bộ, không merge) → không còn dữ liệu scope Student nào sót lại cho Lecturer.
Student → Admin → UsersProvider/SettingsProvider chuyển từ gate-false sang gate-true → fetch đúng.
```

## 8. Tests
```
Tự động (node:test, KHÔNG cần React/jsdom — test thẳng module JS thuần):
  client/src/context/providerAccess.test.js — 3/3 PASS
    - canLoadUsers: true CHỈ với admin, false với student/lecturer/company_mentor/null/undefined
    - canLoadSettings: true với admin+student, false với lecturer/mentor/null
    - canLoadNotifications: true với student/lecturer/mentor, false với admin/null

Code-level verification (đọc lại toàn bộ 6 file đã sửa + App.jsx):
  - Xác nhận AuthProvider là provider ngoài cùng, mọi Provider khác đều có thể gọi useAuth().
  - Xác nhận mọi nhánh "gate false" đều dọn state (items/users/settings) về rỗng/mặc định, set
    isLoading=false, error=null — không rơi vào "error" giả.
  - Xác nhận addItem/updateItem/deleteItem/createUser/updateUser/updateSettings KHÔNG bị ảnh hưởng
    bởi gate (mutation luôn gọi được, chỉ GET ban đầu bị gate — đúng yêu cầu không phá mutation).

Backend regression (HTTP thật qua curl — backend KHÔNG đổi):
  - Login 4 role (admin/student/lecturer/company_mentor): PASS
  - GET /api/users: Admin 200, Student/Lecturer/Mentor 403 (y nguyên, Phase 6A không đổi backend)
  - CRUD counts (12 resource): khớp baseline tuyệt đối
  - Export (Phase 5): Admin internship/evaluation export vẫn 200

KHÔNG claim: browser click-through, hay test tích hợp đầy đủ vòng đời React effect (mount → fetch →
  unmount) — không có browser automation tool, và không cài thêm testing framework React (jsdom/
  React Testing Library) theo đúng chỉ đạo "không tự ý cài framework lớn chỉ vì phase này".
```

## 9. Build/Lint
```
npm run lint:  40 warning — khớp baseline tuyệt đối (xác nhận qua Phase 4F-1/4F-2/Phase 5), không có
  warning mới ở bất kỳ file nào vừa sửa, không unused import, không exhaustive-deps warning phát ra
  (oxlint không tự complain ở các dependency array đã rút gọn [currentUser?.id, currentUser?.role]).
npm run build: 192 modules (+1 đúng bằng providerAccess.js mới — providerAccess.test.js không được
  bundle vào app vì không có import nào từ entry point tới nó, chỉ chạy qua `node --test` độc lập),
  0 lỗi.
Backend: node server.js chạy được, GET /api/health + /api/health/db đều PASS (có 1 sự cố MySQL
  service không tự khởi động lại giữa phiên làm việc — không liên quan gì tới code Phase 6A, đã khởi
  động lại mysqld và verify toàn vẹn dữ liệu trước khi tiếp tục).
```

## 10. Regression
```
Auth:          PASS (login + /me cho cả 4 role)
RBAC:          PASS (Users vẫn Admin-only ở backend, không đổi)
CRUD:          PASS (12 resource, counts khớp baseline)
Internship:    PASS
Logs:          PASS
Reports:       PASS
Evaluations:   PASS
Notifications: PASS (route/API không đổi; chỉ đổi điều kiện fetch ở frontend)
Settings:      PASS
Users:         PASS
Export (Phase 5): PASS (Admin internship + evaluation export vẫn 200, workbook hợp lệ)
Database integrity: 14/14 tables, 19/19 FKs, mọi row count khớp baseline (users=10, students=14,
  lecturers=10, companies=10, company_mentors=7, internships=12, internship_logs=3, reports=2,
  evaluations=2, notifications=13, settings=1) — Phase 6A là thay đổi FRONTEND-ONLY, không có ghi
  DB nào xảy ra trong toàn bộ quá trình.
```

## 11. Known limitations
```
- Không có browser automation tool trong môi trường này — KHÔNG thể tự xác nhận trực tiếp qua
  Network tab rằng GET /api/users thực sự không bắn ra khi Student/Lecturer/Company Mentor đăng
  nhập. Đã bù đắp bằng: (a) test tự động cho đúng phần logic quyết định (providerAccess.js), (b) đọc
  lại toàn bộ useEffect để xác nhận gate nằm ĐÚNG VỊ TRÍ (trước mọi lệnh gọi api.getAll()/getUsers()/
  getSettings(), không phải sau). Nếu người dùng mở được trình duyệt, nên tự mở Network tab và xác
  nhận bằng 4 lần đăng nhập (mỗi role 1 lần) trước khi coi phase này là verified tuyệt đối.
- Chưa có test tích hợp thật cho vòng đời React Provider (mount → effect → fetch → cleanup) — chỉ có
  test cho hàm predicate thuần. Đây là giới hạn đã được ghi nhận minh bạch (mục 14 đề bài), không
  tự nhận là "đã test đầy đủ React behavior".
- `isLoading` vẫn khởi tạo `true` theo React state trước khi effect đầu tiên chạy (characteristic có
  từ trước, không phải vấn đề mới) — với trang render đồng thời trong cùng 1 tick trước khi effect
  flip về false/fetch, có thể có 1 lần "flash" isLoading=true cực ngắn trước khi gate quyết định —
  không phải lỗi, chỉ là đặc điểm vốn có của mọi Context trong dự án từ trước, không thuộc phạm vi
  sửa của Phase 6A.
- Sự cố MySQL service dừng giữa phiên (không khởi động lại sau khi đổi ngày hệ thống) không liên
  quan gì tới thay đổi Phase 6A — ghi nhận minh bạch, đã khởi động lại và verify toàn vẹn dữ liệu
  trước khi chạy bất kỳ test nào.
```
