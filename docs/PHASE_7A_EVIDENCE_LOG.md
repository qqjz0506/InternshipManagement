# PHASE 7A — Evidence Log

Ghi lại chính xác lệnh đã chạy, kết quả thật, file đã đọc, và giới hạn xác minh. Không có secret/password/token nào được ghi trong tài liệu này.

## 1. Môi trường trước khi audit

```
curl GET /api/health      → {"success":true,"message":"Backend is running"}
curl GET /api/health/db   → LẦN ĐẦU: {"success":false,"message":"Database connection failed"}
                             (MariaDB service không tự khởi động lại giữa các phiên làm việc — đã
                             xảy ra tương tự ở Phase 6A/6B, không liên quan code)
→ khởi động lại: "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini"
→ curl GET /api/health/db (lần 2) → {"success":true,"message":"Database connection is working"}
```

## 2. Database — chỉ truy vấn đọc (SELECT/COUNT), không ghi

```sql
-- Table/FK count (information_schema, KHÔNG dùng TABLE_ROWS estimate)
SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='internship_management';        → 14
SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='internship_management'
  AND REFERENCED_TABLE_NAME IS NOT NULL;                                                            → 19

-- Row count từng bảng (COUNT(*) thật)
users=10, departments=4, internship_periods=3, students=14, lecturers=10, companies=10,
company_mentors=7, topics=10, internships=12, internship_logs=3, reports=2, evaluations=2,
notifications=13, settings=1
```
Toàn bộ số liệu khớp đúng baseline đã ghi nhận xuyên suốt Phase 4E-3 → 6C — không có sai lệch.

## 3. Test suite backend (`npm test`, chạy thật, không mock)

```
cd server && npm test
→ tests 86, pass 86, fail 0, cancelled 0, skipped 0, todo 0
→ duration_ms ≈ 15086 (lần chạy này, do MySQL vừa khởi động lại/cold cache — lần chạy trước
  (Phase 6B/6C) đo được ~6000-6500ms; chênh lệch không phải do code, do trạng thái máy)
```
Verify sau khi test xong (đúng cam kết "không mutate dữ liệu vĩnh viễn" của Phase 6B):
```
SELECT COUNT(*) FROM users       → 10 (không đổi)
SELECT COUNT(*) FROM evaluations → 2 (không đổi)
SELECT COUNT(*) FROM students WHERE user_id IS NULL → 10 (không đổi so với trước khi chạy test)
```

## 4. Frontend lint/build (chạy thật)

```
cd client && npm run lint   → 40 warning (đếm qua grep -c "warning"), khớp baseline đã ghi nhận
cd client && npm run build  → ✓ 192 modules transformed, 0 lỗi
```

## 5. Code đã đọc lại trong Phase 7A (không suy đoán từ trí nhớ)

```
server/middleware/errorHandler.js        — xác nhận lại err.stack logic
client/src/components/accounts/AccountDetailModal.jsx  — xác nhận field account.linkedLabel
client/src/pages/admin/AdminAccountsPage.jsx            — xác nhận row spread field `label` (không
  phải `linkedLabel`) — XÁC NHẬN mismatch #5 ở mục 6 đề bài VẪN TỒN TẠI
client/src/components/layout/Topbar.jsx   — phát hiện <input disabled> global search (chưa từng ghi
  nhận trước đây — phát hiện MỚI trong Phase 7A)
client/src/pages/PlaceholderPage.jsx      — xác nhận 0 route nào trong App.jsx tham chiếu tới
server/.env, server/.env.example          — xác nhận KHÔNG có biến NODE_ENV nào được set
```

## 6. Grep đã chạy

```
grep "exportApi|Xuất" client/src/pages/**            → chỉ AdminStatisticsPage.jsx (xác nhận #1)
grep "from '../data/<entity>.js'" client/src/**      → 0 kết quả (xác nhận #4 — dead mock files)
grep "TODO|FIXME|chưa triển khai|placeholder" client/src/** → chỉ CSS class name + input placeholder
  text thông thường (không có TODO/FIXME thật nào trong code)
grep "console.log|onClick={() => {}}" client/src/**  → 0 kết quả
So sánh "pages dùng isLoading" × "pages có if(isLoading)/isLoading ?" → 4 "false positive" đọc lại
  thủ công, xác nhận cả 4 đều xử lý loading đúng (chỉ khác style early-return vs ternary)
So sánh "pages dùng error" × "pages render .form-field-error" → 1 "false positive"
  (LoginPage.jsx dùng class "login-error" riêng, không phải thiếu xử lý)
```

## 7. Những gì KHÔNG thể xác minh trong phiên audit này

```
- Browser click-through thật: KHÔNG CÓ browser automation tool trong môi trường này (đã xác nhận
  qua ToolSearch ở nhiều phase trước, nhất quán). Toàn bộ "xác minh UI" trong report này dựa trên
  đọc code component + test HTTP thật, KHÔNG phải quan sát trực tiếp trên trình duyệt.
- Hiệu năng dưới tải thật (nhiều user đồng thời) — ngoài phạm vi, không có công cụ load-test.
- Trải nghiệm responsive/mobile — chỉ đọc CSS, không có công cụ render trình duyệt để xác nhận.
- Một số validation string chi tiết (vd. toàn bộ regex số điện thoại, định dạng email) đã đọc code
  (`server/utils/validators.js`) nhưng KHÔNG test exhaustive mọi input biên qua HTTP trong phase này
  — các rule CHÍNH (bắt buộc, enum, FK tồn tại, range điểm 0-10, range tiến độ 0-100) đã có test tự
  động từ Phase 6B.
```

## 8. Nguồn của "yêu cầu nghiệp vụ" dùng trong Requirement Traceability Matrix

```
Không tìm thấy tài liệu đặc tả/use-case gốc độc lập nào trong docs/ (đã grep "require|spec|usecase"
trên tên file — không có kết quả). Yêu cầu trong REQUIREMENT_TRACEABILITY_MATRIX.md được TÁI DỰNG từ:
  1. Tên đề tài: "Xây dựng hệ thống quản lý thực tập tốt nghiệp".
  2. docs/DATABASE_DESIGN.md — ghi rõ tự suy ra từ mock data/Context gốc trước khi có backend.
  3. Yêu cầu "export internship information/evaluations" — do người dùng nêu rõ bằng văn bản khi
     giao Phase 5 (trích trong docs/API_PHASE_5.md mục 1), không phải suy đoán của Claude.
  4. Toàn bộ business rule đã implement và có bằng chứng test thật xuyên suốt Phase 2–6B.
Mọi REQ trong ma trận đều ghi rõ cột "Nguồn tham chiếu" theo đúng 1 trong 4 nguồn trên — không có
REQ nào tự bịa thêm ngoài phạm vi này.
```
