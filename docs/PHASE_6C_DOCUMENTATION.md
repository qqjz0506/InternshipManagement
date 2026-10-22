# PHASE 6C — Project Documentation & Architecture Baseline

## 1. Goal
Tạo baseline tài liệu dự án chính xác, mô tả đúng codebase hiện tại (không phải hệ thống lý tưởng hóa trong tương lai) — đủ để setup lại từ đầu, demo cho giảng viên, và bàn giao dự án.

## 2. Phạm vi — chỉ documentation
Phase này **không sửa bất kỳ code production nào** (frontend/backend/database/business logic/test behavior). Toàn bộ thay đổi là file `.md` mới + 1 file `README.md` mới ở gốc dự án.

## 3. Phương pháp
Mọi thông tin trong tài liệu được lấy trực tiếp từ việc đọc code thật (`package.json` × 3, `.env.example` × 2, `.gitignore`, toàn bộ `server/routes/`, cấu trúc `client/src/`, kết quả `npm test`/`npm run lint`/`npm run build` chạy thật ngay trước khi viết) — không đoán command, không đoán biến môi trường, không bịa tính năng chưa tồn tại (CSRF, refresh token, rate limiting, HTTPS... đều được ghi rõ là **chưa có**, không phải "có nhưng chưa test").

## 4. Files Created

```
README.md                      (gốc dự án — MỚI)
docs/ARCHITECTURE.md           (MỚI)
docs/API_INDEX.md              (MỚI)
docs/PHASE_INDEX.md            (MỚI)
docs/PHASE_6C_DOCUMENTATION.md (MỚI — tài liệu này)
```

Không sửa `.env.example` (đã đúng, đã kiểm tra tên biến khớp 100% với `server/config/database.js`/`server.js`/`client/src/api/apiClient.js` — không cần cập nhật). Không sửa `.gitignore` (đã có `node_modules/`, `.env`, logs, editor files ở gốc; `client/.gitignore` đã có `dist/` riêng — không thiếu gì cần bổ sung).

## 5. Known naming/documentation notes (không sửa code)
```
- client/src/data/*.js (trừ mockUsers.js) vẫn còn tồn tại nhưng không còn được import ở đâu (dead
  code từ trước khi migrate sang REST API) — ghi nhận trong README Mục 18, KHÔNG xóa (ngoài phạm vi
  phase này, đã từng được Full System Gap Audit xếp P3 LOW).
- AccountDetailModal.jsx đọc `account.linkedLabel` nhưng AdminAccountsPage spread field `label` (lệch
  tên, cosmetic, đã ghi nhận từ Phase 4F-2) — không sửa ở đây.
- Export chỉ có UI ở Admin dù backend hỗ trợ scope cho cả 4 role — ghi nhận đúng trong README Mục 18,
  không tự thêm UI cho 3 role còn lại (ngoài phạm vi, đã là quyết định có chủ đích từ Phase 5).
```
Các điểm trên được MÔ TẢ ĐÚNG hiện trạng trong README/ARCHITECTURE, không được "sửa cho đẹp".

## 6. Validation sau khi viết tài liệu

```
cd client && npm run lint   → 40 warning (baseline không đổi — xác nhận lại fresh ngay trước khi viết
                                 README, không phải số liệu cũ)
cd client && npm run build  → 192 modules, 0 lỗi
cd server && npm test       → 86/86 PASS, ~6-7s
GET /api/health             → {"success":true,"message":"Backend is running"}
GET /api/health/db          → {"success":true,"message":"Database connection is working"}
```
Không có số liệu nào bị thay đổi so với cuối Phase 6B — đúng kỳ vọng, vì Phase 6C không sửa code.

## 7. Known limitations của chính tài liệu này
```
- README/ARCHITECTURE mô tả đúng hiện trạng tại THỜI ĐIỂM Phase 6C hoàn thành — nếu phase sau thay
  đổi API/schema/Provider loading, các tài liệu này cần được cập nhật lại (không có cơ chế tự động
  đồng bộ doc↔code).
- Không tạo diagram hình ảnh (chỉ sơ đồ dạng text/ASCII trong .md) — đủ chính xác và dễ maintain hơn
  diagram hình ảnh có thể lệch khỏi code theo thời gian, đúng nguyên tắc "không tạo diagram không
  khớp implementation" (mục 22 đề bài).
```

## FINAL VERDICT
PHASE 6C COMPLETE
