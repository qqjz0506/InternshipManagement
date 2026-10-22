# API PHASE 4A — React API Client + Authentication Integration Foundation

**Mismatch check: PASS.** Đối chiếu contract `POST /api/auth/login` / `GET /api/auth/me` (request/response body, token field, user field, role values, error format, HTTP status) giữa `AuthContext.jsx` (trước sửa) và `authService.js`/`authController.js`/`authMiddleware.js`/`response.js`/`errorHandler.js` thực tế — khớp 100%. CORS (`CLIENT_URL=http://localhost:5173` trong `server/.env`) khớp đúng cổng Vite dev (`5173`). Không phát hiện mismatch nào cần dừng; chỉ có 1 khoảng trống thuộc đúng phạm vi Phase 4A (frontend hard-code base URL, chưa có API client dùng chung, chưa có loading/disable khi submit login) — sửa trong phase này theo đúng mục 5/12.

## 1. Scope
Chỉ xây nền tảng API client + hoàn thiện AuthContext/LoginPage dùng nền tảng đó. **Không** migrate bất kỳ Context dữ liệu nào (Students, Lecturers, Internships, ...) sang API — các Context đó vẫn dùng `data/*.js` (mock) như cũ, để dành cho Phase 4B → 4E.

## 2. Files created
```
client/.env.example                — khai báo VITE_API_BASE_URL (mục 5)
client/.env                        — giá trị thực cho máy dev (bị .gitignore ở root chặn commit — ".env")
client/src/api/apiClient.js        — API client trung tâm (base URL, header, parse JSON, error)
client/src/api/authApi.js          — login(), getMe() — map 1-1 2 endpoint auth hiện có
```

## 3. Files modified
```
client/src/context/AuthContext.jsx — dùng authApi + apiClient thay vì tự gọi fetch/localStorage trực tiếp
client/src/pages/auth/LoginPage.jsx — thêm isSubmitting: disable input/nút + đổi label lúc đang gọi API,
                                       chặn double submit
```
Không sửa `ProtectedRoute.jsx` / `App.jsx` (đã đúng theo `isInitializing` từ Phase 3A, xác nhận qua đọc code — mục 13/14). Không sửa backend (không có mismatch thuộc contract auth).

## 4. API client architecture
```
Context (AuthContext, và Context khác ở phase sau)
   ↓
api/authApi.js (hoặc XxxApi.js sau này)   — chỉ map tên hàm ↔ endpoint, không state/UI
   ↓
api/apiClient.js                          — base URL, Authorization header, JSON parse, HTTP error → ApiError
   ↓
fetch
   ↓
REST API (Express)
```
`apiClient` export `{ get, post, put, delete }`, tất cả đi qua 1 hàm `request()` duy nhất. Không có Context nào tự viết fetch riêng (đã grep xác nhận trước khi sửa: chỉ `AuthContext.jsx` có `fetch` trong toàn bộ `client/src`).

## 5. Base URL configuration
Một nguồn duy nhất: `client/src/api/apiClient.js` đọc `import.meta.env.VITE_API_BASE_URL`, fallback `http://localhost:5000/api` nếu biến môi trường không tồn tại. Khai báo trong `client/.env` / `client/.env.example`:
```
VITE_API_BASE_URL=http://localhost:5000/api
```
`client/.env` không bị commit vì root `.gitignore` có dòng `.env` (match mọi độ sâu thư mục, đã verify không cần sửa `.gitignore`).

## 6. Auth token handling
```
TOKEN_STORAGE_KEY = 'itm_access_token'   (giữ nguyên key cũ từ Phase 3A, không đổi để tránh session cũ bị mất)
getToken() / setToken() / clearToken()   — duy nhất trong apiClient.js
```
Mọi request có `auth !== false` tự động gắn `Authorization: Bearer <token>` nếu có token trong localStorage. `authApi.login()` gọi với `{ auth: false }` vì chưa có token lúc đăng nhập. `AuthContext` không còn tự đọc/ghi `localStorage` trực tiếp — chỉ gọi `getToken/setToken/clearToken`.

## 7. Error handling
`apiClient` parse JSON an toàn (không throw nếu body rỗng/không phải JSON hợp lệ — ví dụ HTML lỗi từ proxy). Phân biệt tối thiểu theo yêu cầu mục 7:
- Network error (fetch throw) → `ApiError(status=0, 'Không thể kết nối tới máy chủ...')`
- `response.ok === false` hoặc `body.success === false` → `ApiError(status, message từ backend hoặc fallback)`
- 400/403/404/409/500 đều đi qua cùng `ApiError`, `status` giữ nguyên để UI tự phân biệt nếu cần.
Không có chỗ nào `catch (e) { console.log(e) }` rồi coi như thành công — mọi lỗi đều `throw`.

## 8. 401 handling
`ApiError` có subclass `UnauthorizedError` (status cố định 401) để phân biệt rõ với lỗi khác. `apiClient` **không** tự ý logout/điều hướng (tránh circular dependency `apiClient → AuthContext → apiClient` theo đúng mục 8) — chỉ throw, nơi gọi (`AuthContext`) tự quyết định:
- Lúc khôi phục session (`getMe()` khi F5): bất kỳ lỗi nào (kể cả 401 do token hết hạn/user bị xoá) đều `clearToken()` rồi coi như chưa đăng nhập.
- Lúc login: lỗi (kể cả `UnauthorizedError` do sai mật khẩu) chỉ hiển thị `error.message`, không set token.

## 9. AuthContext integration
```
Login:   LoginPage → AuthContext.login() → authApi.login() → apiClient.post('/auth/login', ..., {auth:false})
         → setToken(accessToken) → setCurrentUser(user)
F5:      AuthContext effect → getToken() → nếu có → authApi.getMe() → apiClient.get('/auth/me')
         → thành công: setCurrentUser(user) | thất bại: clearToken()
Logout:  AuthContext.logout() → clearToken() + setCurrentUser(null)
```

## 10. Login flow
`LoginPage.jsx` không gọi API trực tiếp — chỉ gọi `useAuth().login(email, password)`. Thêm `isSubmitting`:
- Chặn double submit (`if (isSubmitting) return`).
- Disable 2 input + nút submit trong lúc gọi API.
- Đổi label nút thành "Đang đăng nhập..." trong lúc chờ.
- Lỗi hiển thị qua `error.message` (không phải raw stack — `ApiError.message` luôn là message từ backend hoặc câu tiếng Việt chung, không bao giờ là `err.stack`).

## 11. F5 / session restore
Không đổi logic so với Phase 3A, chỉ đổi cách gọi (qua `authApi.getMe()` thay vì `fetch` trực tiếp). `ProtectedRoute`/`RootRedirect` tiếp tục chờ `isInitializing` trước khi quyết định redirect — xác nhận qua đọc code, không cần sửa.

## 12. Logout flow
`clearToken()` (xoá `itm_access_token` khỏi localStorage) + `setCurrentUser(null)`. Không có nguồn session thứ hai nào khác tồn tại trong codebase (xác nhận qua grep: chỉ 1 key `itm_access_token`, chỉ 1 nơi set `currentUser`).

## 13. Security check
```
password trong localStorage       → KHÔNG (chỉ accessToken)
password trong currentUser        → KHÔNG (toSafeUser() backend đã loại password_hash, Phase 3A)
password trong JWT                → KHÔNG (payload {sub, role} — không đổi, Phase 3A)
password trong API response       → KHÔNG
```
`currentUser` chỉ chứa `{id, fullName, email, role}` — đúng mục 20.

## 14. Tests

| Test | Result |
|---|---|
| Login admin | PASS |
| Login student | PASS |
| Login lecturer | PASS |
| Login company mentor | PASS |
| Wrong password | PASS (401, message đúng) |
| Unknown email | PASS (401, cùng message — không lộ email tồn tại hay không) |
| `/me` valid token | PASS |
| `/me` no token | PASS (401 "Thiếu access token.") |
| `/me` invalid/garbage token | PASS (401 "Access token không hợp lệ.") |
| Logout | PASS (đọc code — clearToken + setCurrentUser(null), không browser) |
| F5 restore | PASS (đọc code + test `/me` HTTP thật ở trên) |
| Backend unavailable | PASS (đọc code — apiClient bắt fetch-throw, trả ApiError, LoginPage hiển thị lỗi, không crash trắng trang) |
| Lint | PASS (39 warning, giống hệt baseline Phase 3B — 0 warning/error mới từ `api/*.js`) |
| Build | PASS (187 modules — +2 so với 185 của Phase 3B do `apiClient.js`/`authApi.js`, 0 lỗi) |

**Browser click-through: NOT VERIFIED** — môi trường hiện tại không có browser automation tool. Các test "Logout", "F5 restore", "Backend unavailable" ở trên được xác nhận qua đọc code + test HTTP trực tiếp cho phần backend liên quan, KHÔNG phải qua thao tác chuột/UI thật.

## 15. Mock data status
```
Mock data vẫn tồn tại nguyên vẹn (data/*.js không bị xoá/sửa).
Chưa migrate bất kỳ Context dữ liệu nào (Students, Lecturers, Companies, CompanyMentors, Departments,
InternshipPeriods, Topics, Internships, InternshipLogs, Reports, Evaluations, Notifications, Settings)
sang API — toàn bộ vẫn dùng createResourceContext(mock, ...) như trước Phase 4A.
UsersContext (MOCK_USERS) cũng giữ nguyên — không liên quan đến authentication thật (chỉ AuthContext
mới nối API thật từ Phase 3A).
```

## 16. Known limitations
```
- apiClient hiện chỉ có 2 hàm dùng thực tế (login, getMe); get/put/delete chưa có caller nào — sẽ dùng
  ở Phase 4B khi migrate các Context dữ liệu.
- Không có refresh token / token rotation / revoke — giữ đúng phạm vi Phase 3A, không mở rộng (mục 9).
- 401 do token hết hạn khi ĐANG dùng app (không phải lúc F5) chưa có UI feedback riêng (vd. toast
  "phiên đăng nhập hết hạn") vì chưa có Context nào gọi API ngoài Auth — sẽ cần xử lý khi Phase 4B+
  bắt đầu gọi các resource khác và nhận UnauthorizedError giữa phiên làm việc.
- Browser click-through chưa được xác minh trực tiếp (không có tool); khuyến nghị người dùng tự chạy
  Test 1-8 ở mục 23 của yêu cầu trước khi coi Phase 4A là "đã kiểm chứng đầy đủ qua UI".
```

## 17. Final verdict
```
PHASE 4A COMPLETE
```
