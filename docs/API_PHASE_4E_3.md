# API PHASE 4E-3 — Migrate Settings from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `SettingsContext` sang REST API thật (`GET/PUT /api/settings`) và 3 consumer (`AdminSettingsPage.jsx`, `StudentInternshipPage.jsx`, `InternshipsPage.jsx`). Không migrate Users/Accounts/Auth hay bất kỳ entity nào khác. Không thêm field/setting mới (theme, ngôn ngữ, timezone, email, maintenance-mode), không thêm bảng settings-history/audit, không thêm API reset/version-management mới.

## 2. Mismatch check

```
STOP-WORTHY MISMATCH PHÁT HIỆN — đã xử lý bằng mapper tại API boundary, KHÔNG sửa backend/schema
```

`settingsService.js` có khác biệt casing 2 CHIỀU — entity duy nhất trong toàn dự án gặp vấn đề này:
- `get()` (dùng cho cả GET đứng riêng và giá trị trả về của `update()`) trả `SELECT *` nguyên bản snake_case: `system_name`, `system_description`, `default_internship_period_id`, `allow_student_registration`.
- `update(payload)` lại destructure **camelCase** trực tiếp từ body: `systemName`, `systemDescription`, `defaultInternshipPeriodId`, `allowStudentRegistration` — khớp đúng shape `DEFAULT_SETTINGS` cũ của mock.

Đây là mismatch **chỉ ảnh hưởng phía frontend đọc dữ liệu** (không ảnh hưởng schema/RBAC/business rule), nên xử lý bằng cách thêm 1 mapper snake_case → camelCase DUY NHẤT tại `client/src/api/settingsApi.js` (API boundary, đúng nguyên tắc mapping đã dùng từ Phase 4B-1) áp dụng cho cả response của GET và response của PUT. Request body của PUT giữ nguyên camelCase (khớp sẵn với những gì backend đã mong đợi, không cần biến đổi). Nhờ vậy `SettingsContext.jsx`/`AdminSettingsPage.jsx` không cần đổi field name nào.

`frontend_version`: xác nhận qua `schema.sql` — **không phải cột DB**, chỉ là hằng số frontend (`FRONTEND_VERSION` trong `SettingsContext.jsx`). Backend có guard `IMMUTABLE_FIELDS = ['id','version','FRONTEND_VERSION','frontend_version']` reject cứng (400) nếu các field này có mặt trong payload PUT — test field-injection xác nhận cả 4 field đều bị chặn.

**Sự cố dữ liệu phát hiện trong lúc kiểm tra (không liên quan đến migration):** `GET /api/settings` ban đầu trả `system_name`/`system_description` bị lỗi encoding (ký tự có dấu bị hỏng kiểu `H? th?ng qu?n l�...`), là tàn dư của một sự cố Bash-encoding từ phiên làm việc trước (không phải do bất kỳ hành động nào trong phase này). Đã khôi phục bằng cách ghi file `.sql` UTF-8 (qua tool Write) rồi chạy `mysql --default-character-set=utf8mb4 < restore_settings.sql`, verify lại bằng `SELECT` khớp byte-for-byte với literal gốc trong `seed.sql`. Toàn bộ test PUT sau đó trong phase này đều dùng `curl --data-binary "@file"` với file UTF-8, không dùng tham số Bash inline có dấu, theo đúng quy tắc chuẩn của dự án.

## 3. Settings model (không đổi, chỉ xác nhận lại)
```
settings: id (CHECK id=1), system_name, system_description, default_internship_period_id
  (FK NULL → internship_periods.id, ON DELETE SET NULL), allow_student_registration (TINYINT(1)),
  updated_at
```
Luôn đúng 1 dòng (`id=1`). Không có `frontend_version` trong schema. Không thêm cột/bảng nào.

## 4. API module
```
client/src/api/settingsApi.js — getSettings(), updateSettings(payload)
```
Không có `create`/`remove` (đúng bản chất single-row, không phải collection). Chứa mapper `toCamelCase()` áp dụng cho response của cả 2 hàm.

## 5. Context migration
```
SettingsContext.jsx → KHÔNG dùng createApiResourceContext (factory đó cho collection có id,
  add/update/delete từng phần tử — không phù hợp 1 bản ghi cấu hình duy nhất).
```
Giữ nguyên interface cũ `{settings, updateSettings, resetSettings, defaultSettings}`, thêm `isLoading`/`isMutating`/`error`. `updateSettings` giờ là async, gọi PUT thật, không throw — trả `{success, settings?}` hoặc `{success:false, message, status}`, đúng convention mutation của mọi Context đã migrate trước đó. `settings` được khởi tạo bằng shape mặc định (không phải `null`) để tránh crash truy cập property ở 3 consumer trong khoảng thời gian chờ GET đầu tiên — tương tự cách các Context khác khởi tạo `items = []`.

## 6. Single-row behavior
Không có UI/luồng nào tạo thêm hoặc xóa dòng settings. Đã verify `SELECT COUNT(*) FROM settings` = 1 trước và sau toàn bộ test. Không gọi POST/DELETE nào (route không tồn tại).

## 7. Authorization
```
GET /api/settings — mọi role đã đăng nhập (route không giới hạn role, đúng thiết kế sẵn có — Student
  cần đọc allowStudentRegistration/defaultInternshipPeriodId cho trang đăng ký thực tập)
PUT /api/settings — CHỈ Admin (requireRole('admin'))
```
Test thực tế bằng JWT thật: Student/Lecturer/Company Mentor GET → 200; cả 3 PUT → 403. Không sửa route/middleware.

## 8. Validation (xác nhận qua test thật, không sửa backend)
```
systemName        — bắt buộc, không rỗng (400 nếu rỗng)
systemDescription — optional, phải là string nếu có
defaultInternshipPeriodId — null hợp lệ; nếu có giá trị phải tồn tại trong internship_periods (400 nếu không)
allowStudentRegistration  — PHẢI là boolean thật (400 nếu gửi "true" (string) hoặc 1 (number))
```

## 9. frontend_version behavior
Hiển thị read-only trong form (`<input disabled>`), lấy từ hằng số `FRONTEND_VERSION` export từ Context — không bao giờ nằm trong payload gửi lên (handleSave/handleReset chỉ gửi `draft`/`DEFAULT_SETTINGS`, cả hai đều không chứa field này). Test field-injection xác nhận backend reject cứng nếu cố tình thêm vào.

## 10. Default period behavior
`defaultInternshipPeriodId` là FK nullable, map qua lại `null ↔ ""` ở `<select>` (giữ nguyên logic cũ). Test: giá trị `null`, giá trị hợp lệ (id=1, tồn tại), giá trị không tồn tại (9999 → 400) — cả 3 đều đúng như kỳ vọng.

## 11. Save / Cancel / Reset semantics
Đọc lại đúng implementation cũ trước khi quyết định (yêu cầu bắt buộc của phase):
```
Save   — PUT toàn bộ draft (full object, không phải partial merge — khớp semantics full-replace sẵn
          có của settingsService.update()). Nay là async thật, disable nút khi isMutating, báo lỗi
          rõ ràng nếu PUT thất bại (không giả vờ đã lưu).
Cancel — CHỈ setDraft(settings) cục bộ, KHÔNG gọi API — giữ nguyên 100% semantics cũ (code cũ cũng
          chưa từng gọi API ở Cancel).
Reset  — Code cũ: resetSettings() ghi đè NGAY LẬP TỨC state settings "chính thức" của Context (không
          chỉ sửa draft), không cần bấm Save riêng — tức Reset vốn đã là một hành động có hiệu lực
          ngay, tương đương 1 lần Save với giá trị mặc định. Để giữ đúng semantics quan sát được này
          khi có backend thật, resetSettings() mới gọi updateSettings(DEFAULT_SETTINGS) — tức PUT
          thẳng giá trị mặc định lên /api/settings (endpoint PUT đã có sẵn, KHÔNG tạo endpoint reset
          mới, KHÔNG phải "xóa/reset toàn bộ dữ liệu hệ thống" — chỉ là 1 lần Save với giá trị mặc
          định). Nếu không làm vậy, sau khi "Reset" rồi F5 lại trang sẽ mất hiệu lực reset (vì DB vẫn
          giữ giá trị cũ) — trái với hành vi quan sát được ở bản mock. Quyết định này được ghi nhận rõ
          ràng ở đây để có thể điều chỉnh nếu không đúng ý định ban đầu.
```

## 12. HTTP test matrix

| Test | Result |
|---|---|
| No token / invalid token GET | PASS (401 cả hai) |
| Admin GET | PASS (200, đúng shape) |
| Student / Lecturer / Company Mentor GET | PASS (200 cả ba) |
| Student / Lecturer / Company Mentor PUT | PASS (403 cả ba) |
| Admin PUT valid (full object, camelCase) | PASS (200, persist đúng, GET lại khớp) |
| Admin PUT allowStudentRegistration=false | PASS (lưu đúng `allow_student_registration=0`) |
| Field-injection `id` | PASS (400) |
| Field-injection `frontend_version` | PASS (400) |
| Field-injection `FRONTEND_VERSION` | PASS (400) |
| Field-injection `version` | PASS (400) |
| `systemName` rỗng | PASS (400) |
| `allowStudentRegistration` = "true" (string) | PASS (400 — strict boolean) |
| `allowStudentRegistration` = 1 (number) | PASS (400 — strict boolean) |
| `defaultInternshipPeriodId` = 9999 (không tồn tại) | PASS (400) |
| `defaultInternshipPeriodId` = 1 (hợp lệ) | PASS (200, lưu đúng) |
| Khôi phục dữ liệu seed gốc sau test (qua PUT thật) | PASS (khớp byte-for-byte `seed.sql`) |
| Lint | PASS (exit 0, 40 warning — baseline 39 +1, cùng class `set-state-in-effect` đã có ở ~20 file khác) |
| Build | PASS (189 modules — +1 so với baseline 188, đúng bằng 1 file `settingsApi.js` mới thêm, 0 lỗi) |

## 13. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1 → 4B-4 + Topic Approval RBAC fix: PASS (departments=4, periods=3, students=14,
  lecturers=10, companies=10, company_mentors=7, topics=10 — không đổi)
Phase 4C:    PASS (internships=12, không đổi)
Phase 4D-1:  PASS (internship_logs=3, không đổi)
Phase 4D-2:  PASS (reports=2, không đổi)
Phase 4E-1:  PASS (evaluations=2, không đổi)
Phase 4E-2:  PASS (notifications=13, không đổi)
IDOR re-check: Student A GET /internships + ?student_id=99 bypass vẫn chỉ trả 1 (của chính mình) —
  không regression ở authorization layer của các entity khác.
```

## 14. Database integrity
```
14/14 tables
19/19 foreign keys
settings = 1 row (id=1) — đúng trước/sau toàn bộ test
Tất cả bảng khác không đổi (đã verify bằng COUNT(*) thật, KHÔNG dùng information_schema.TABLE_ROWS
  — xác nhận lại estimate đó vẫn lệch so với thực tế, ví dụ hiển thị students=15/company_mentors=8/
  internship_periods=4 trong khi COUNT(*) thật là 14/7/3, khớp đúng baseline đã biết từ các phase
  trước — không phải regression, chỉ là estimate cũ không đáng tin)
system_name/system_description tiếng Việt đã khôi phục đúng, không bị hỏng lại bởi bất kỳ payload
  test nào trong phase này (toàn bộ gửi qua file UTF-8, không dùng tham số Bash inline có dấu)
```

## 15. Lint/build
```
npm run lint:  PASS (exit 0, 40 warning — +1 so với baseline 39, do useEffect đồng bộ draft từ
  settings bất đồng bộ trong AdminSettingsPage.jsx — cùng class react(set-state-in-effect) đã tồn
  tại sẵn ở ~20 file FormModal khác trong codebase, không phải loại cảnh báo mới)
npm run build: PASS (189 modules — +1 đúng bằng settingsApi.js mới, 0 lỗi)
```

## 16. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 3 file tiêu thụ `useSettings` (grep xác nhận không còn consumer nào khác, không có import mock data trực tiếp), test HTTP thật cho toàn bộ auth/role/validation/field-injection matrix (JWT thật của Admin + Student + Lecturer + Company Mentor), test DB trực tiếp (COUNT(*) thật + so khớp byte-for-byte dữ liệu tiếng Việt), `npm run lint`/`npm run build` thành công.

## 17. Known limitations
```
- Quyết định semantics "Reset = PUT ngay giá trị mặc định" (mục 11) là suy luận hợp lý nhất từ hành
  vi quan sát được ở code cũ, nhưng là một diễn giải — nếu ý định ban đầu khác (ví dụ Reset chỉ nên
  điền vào draft, chờ bấm Save riêng), cần điều chỉnh lại resetSettings() trong SettingsContext.jsx.
- Lint warning tăng từ 39 → 40 do thêm 1 useEffect đồng bộ draft (cùng pattern với ~20 file khác
  trong codebase) — không sửa vì đây là cách xử lý đúng/cần thiết cho dữ liệu bất đồng bộ, không
  phải lỗi.
- Sự cố encoding dữ liệu tiếng Việt phát hiện trong settings là tồn đọng từ phiên làm việc trước,
  không phải do phase này gây ra — đã khôi phục đầy đủ, ghi nhận minh bạch ở mục 2.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
