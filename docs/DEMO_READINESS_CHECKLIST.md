# CHECKLIST CHUẨN BỊ TRƯỚC DEMO / BẢO VỆ

Thực hiện theo đúng thứ tự. Không chạy bất kỳ thao tác nào có chữ **[PHÁ HỦY]** trừ khi thật sự cần (không có trong checklist này — không thử phương án phục hồi bằng cách phá hủy dữ liệu thật trước).

## 1. Kiểm tra database

- [ ] MariaDB/XAMPP đang chạy, nghe cổng `3306`.
- [ ] `mysql -u root --default-character-set=utf8mb4 -e "SELECT 1;"` trả về `1`.
- [ ] Database `internship_management` tồn tại, đủ 14 bảng: `SHOW TABLES;` → đếm đủ 14.
- [ ] Không chạy lại `schema.sql`/`seed.sql` trước demo (reseed sẽ xóa mọi state đã quen thuộc để demo) — chỉ làm nếu DB thật sự hỏng và không còn lựa chọn khác, và phải có người chịu trách nhiệm xác nhận trước.

## 2. Kiểm tra `.env` và cấu hình

- [ ] `server/.env` tồn tại (copy từ `.env.example`), có `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `PORT=5000`.
- [ ] `client/.env` có `VITE_API_BASE_URL=http://localhost:5000/api`.
- [ ] **Không để `DEBUG_ERRORS=true`** trong `.env` lúc demo (nếu có dòng này, phải là rỗng hoặc không tồn tại) — bật nhầm sẽ lộ stack trace nếu demo gặp lỗi 500 trước hội đồng.
- [ ] Không có mật khẩu/JWT_SECRET nào bị hiển thị trên màn hình chia sẻ (che terminal nếu cần mở file `.env`).

## 3. Khởi động Backend/Frontend

- [ ] `cd server && npm run dev` (hoặc `npm start`) — log hiện `Database connected successfully.` và `Server running on port 5000.`, không có `EADDRINUSE` hay lỗi kết nối DB.
- [ ] `cd client && npm run dev` — Vite báo chạy ở `http://localhost:5173`.
- [ ] Mở `http://localhost:5173` → thấy trang `/login`, không có lỗi console đỏ nghiêm trọng (warning CSS/font có thể bỏ qua).

## 4. Health check

- [ ] `GET http://localhost:5000/api/health` → `{"success":true,...}`.
- [ ] `GET http://localhost:5000/api/health/db` → `{"success":true,...}`. Nếu fail → quay lại Mục 1.

## 5. Kiểm tra tài khoản 4 vai trò

Đăng nhập thử (rồi đăng xuất ngay) từng vai trò bằng tài khoản ghi trong `README.md` Mục 13 — **không chép lại mật khẩu vào checklist này**:

- [ ] Admin đăng nhập được, vào `/admin/dashboard`.
- [ ] Student (`student@example.com`) đăng nhập được, vào `/student/dashboard`.
- [ ] Lecturer (`lecturer@example.com`) đăng nhập được, vào `/lecturer/dashboard`.
- [ ] Company Mentor (`company2@example.com`) đăng nhập được, vào `/company/dashboard`.
- [ ] Mỗi role chỉ thấy đúng menu/trang của role mình (không thấy menu Admin khi đăng nhập Student, v.v.).

## 6. Kiểm tra dữ liệu seed

- [ ] `internships.id=1` đang `in_progress`, có đủ Lecturer + Company + Mentor gán sẵn (dùng cho demo nhật ký/báo cáo/đánh giá, Mục 5.2–5.4 của `FINAL_DEMO_SCRIPT.md`).
- [ ] `internships.id=3` đang `pending`, **chưa** có company/mentor/lecturer (dùng cho demo phân công + đổi trạng thái, Mục 5.1). Nếu ai đó đã chạy demo trước và quên khôi phục → sửa lại qua Admin UI trước khi demo chính thức.
- [ ] `evaluations.id=1` đã `is_published=1` (dùng minh họa Student thấy đánh giá đã công bố).
- [ ] `evaluations.id=2` đang `is_published=0` (dùng minh họa Student KHÔNG thấy đánh giá chưa công bố, kể cả của chính mình).
- [ ] `internships.id=9` hoặc `id=10` đang `completed`, CẢ HAI đánh giá (`lecturer`+`company`) đã `is_published=1` (dùng minh họa Điểm tổng kết thực tập + Xếp loại — Mục 5.2 `FINAL_DEMO_SCRIPT.md`). Nếu không chắc, `GET /api/internships/9/final-result` (token Admin) phải trả `data` khác `null`.
- [ ] `settings.lecturer_weight + settings.company_weight = 100` (mặc định 60/40) — nếu ai đó đã thử đổi lúc chuẩn bị mà quên khôi phục, sửa lại qua `/admin/settings` trước demo chính thức.

## 7. Kiểm tra luồng nghiệp vụ (chạy thử 1 lượt, không để lại thay đổi vĩnh viễn)

- [ ] Admin phân công + đổi trạng thái `internships.id=3` (pending→approved) rồi **đổi lại về pending, gỡ hết company/mentor/lecturer** ngay sau khi thử.
- [ ] Student ghi 1 nhật ký test trên `internships.id=1` rồi **xóa lại** (log chưa `reviewed` nên xóa được).
- [ ] Lecturer nhận xét 1 log rồi — **nếu không định giữ** — ghi lại giá trị `lecturer_comment` cũ trước khi sửa, để khôi phục sau.
- [ ] Sau khi thử xong, chạy lại `cd server && npm test` **một lần** để xác nhận không làm lệch ground-truth mà các test tự động dựa vào (nếu `npm test` fail sau khi thử luồng nghiệp vụ thủ công → có khả năng đã quên khôi phục 1 field nào đó — xem log fail để biết chính xác field nào).

## 8. Kiểm tra tải Excel

- [ ] Admin → `/admin/statistics` → bấm "Xuất thông tin thực tập (.xlsx)" → file tải xuống, mở được bằng Excel/LibreOffice, có dữ liệu.
- [ ] Bấm "Xuất đánh giá (.xlsx)" → tương tự.
- [ ] Nếu trình duyệt chặn download (popup blocker) → cho phép download cho `localhost:5173` trước giờ demo, không xử lý live.

## 9. Kiểm tra lỗi API (xác nhận bảo mật, không lộ thông tin)

- [ ] Gọi 1 API không có token (ví dụ `GET /api/internships` không kèm `Authorization`) → 401, body không có stack trace.
- [ ] Gọi 1 API với role sai (ví dụ Student gọi `GET /api/users`) → 403.
- [ ] (Tùy chọn, nếu có thời gian) Gọi API gây lỗi 500 thật (ví dụ payload sai định dạng JSON) → xác nhận response KHÔNG có `stack`, chỉ có message chung — đúng theo `tests/errorHandling.test.js`.

## 10. Kiểm tra database sau demo

- [ ] `npm test` (backend) giờ chạy trên **database test riêng** (`DB_NAME_TEST`), KHÔNG phải database dev vừa demo — PASS/FAIL của `npm test` không còn phản ánh trực tiếp "demo có làm hỏng dữ liệu dev không". Vẫn nên chạy `cd server && npm test` **một lần** sau demo để xác nhận code không bị lỗi gì mới (phải PASS toàn bộ — chạy lại để lấy số chính xác tại thời điểm hiện tại, xem README Mục 15, không chép số cũ vào đây).
- [ ] `COUNT(*)` trực tiếp (không dùng `information_schema`) các bảng chính trên **database dev** (`students`, `internships`, `internship_logs`, `reports`, `evaluations`, `users`, `settings`) — so với số liệu đã biết trước demo, không được âm thầm tăng/giảm ngoài dự kiến (đây mới là cách xác nhận đúng "demo có làm hỏng dữ liệu dev không").

## 11. Backup / phương án khôi phục an toàn

- [ ] **Trước ngày bảo vệ** (không phải ngay trước giờ demo): cân nhắc backup 1 lần bằng `mysqldump` (không bắt buộc, không phá hủy dữ liệu hiện tại để "test" backup — chỉ cần có bản dump để yên tâm):
  ```bash
  mysqldump -u root --default-character-set=utf8mb4 internship_management > backup_truoc_bao_ve.sql
  ```
- [ ] Nếu lỡ làm hỏng dữ liệu nghiêm trọng giữa lúc chuẩn bị (không phải lúc demo live) và không tự khôi phục được qua UI: restore lại từ `schema.sql` + `seed.sql` gốc (chấp nhận mất các chỉnh sửa thủ công đã làm, KHÔNG mất gì về code/test vì test tự dọn dẹp độc lập với state demo).
- [ ] Không thực hiện bất kỳ thao tác phá hủy dữ liệu nào chỉ để "thử xem phương án khôi phục có hoạt động không" — theo đúng nguyên tắc của Phase 7C.

## 12. Tùy chọn: chạy Playwright E2E 1 lần trước (xác nhận UI không có lỗi mới)

- [ ] (Không bắt buộc, làm vài giờ/1 ngày trước — không làm NGAY trước giờ demo để tránh chiếm máy) `npx playwright install chromium` (1 lần đầu) rồi `npm run test:e2e` từ gốc dự án — PASS hết (hiện 13/13, xem README Mục 15) nghĩa là luồng chính 4 role không có lỗi UI mới phát sinh. Chạy trên database TEST riêng, không đụng dữ liệu dev dùng để demo.

## 13. Checklist ngay trước khi bắt đầu thuyết trình (5 phút cuối)

- [ ] Backend + Frontend đang chạy, 2 terminal vẫn mở (không tắt nhầm).
- [ ] Health check lại 1 lần cuối (Mục 4).
- [ ] Trình duyệt đang ở `/login`, đã đăng xuất hết session cũ.
- [ ] Tắt các tab/app không liên quan (tránh lộ thông tin khác trên màn hình chia sẻ).
- [ ] Đã mở sẵn `DEFENSE_QA.md` ở 1 tab/cửa sổ riêng (không chia sẻ màn hình) để tra cứu nhanh nếu cần.
- [ ] Đã xác nhận `internships.id=3` đang ở trạng thái `pending`, sạch (Mục 6) — nếu có buổi chạy thử trước đó trong ngày, kiểm tra lại kỹ mục này.
