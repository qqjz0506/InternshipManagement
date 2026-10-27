# KỊCH BẢN DEMO — HỆ THỐNG QUẢN LÝ THỰC TẬP TỐT NGHIỆP

Mọi route/trang/thao tác dưới đây đã được xác nhận có thật trong code (`client/src/App.jsx`, các trang tương ứng) và dữ liệu seed thật (`server/db/seed.sql`, kiểm tra trực tiếp qua SQL ngày viết tài liệu). Ký hiệu:

- **[API/TEST]** — hành vi đã được xác minh qua HTTP thật + automated test (`server/tests/*.test.js`), có thể tin tưởng 100%.
- **[CODE REVIEW]** — đã đọc code xác nhận đúng, nhưng chưa click-through qua browser thật trong môi trường này.
- **[CHƯA XÁC MINH BROWSER]** — bước này **phải được chính người trình bày tự tay thử trước** (Playwright E2E — Mục 10 — đã verify được luồng chính tự động, nhưng KHÔNG thay thế việc tự tay rehearsal 1 lần trước hội đồng cho các bước UI chi tiết/ít dùng) — xem `DEMO_READINESS_CHECKLIST.md`.

## 1. Mục tiêu và thời lượng dự kiến

Minh họa đầy đủ: (1) quy trình nghiệp vụ thực tập từ đăng ký đến đánh giá, nối giữa 4 vai trò; (2) phân quyền/bảo mật (RBAC + scope, không bypass được); (3) thống kê + xuất Excel. Thời lượng gợi ý: **12–15 phút demo** (trong tổng buổi bảo vệ), chia:

| Phần | Thời gian |
|---|---|
| Khởi động + health check | 1 phút (nên làm TRƯỚC khi vào phòng, không demo live) |
| Admin: danh mục, phân công, duyệt hồ sơ | 3–4 phút |
| Student: đăng ký, nhật ký, báo cáo | 3 phút |
| Lecturer: duyệt đề tài, nhận xét, đánh giá | 2–3 phút |
| Company Mentor: nhận xét, đánh giá | 1–2 phút |
| Thống kê + xuất Excel | 1–2 phút |
| Minh họa phân quyền (không bypass được) | 1–2 phút |

## 2. Điều kiện chuẩn bị trước demo

- MariaDB/XAMPP đang chạy, database `internship_management` đã có đủ 15 bảng + seed data (không reseed ngay trước demo — seed data hiện tại đã được dùng xuyên suốt các phase, không reset).
- Nếu muốn demo gửi email thật (không bắt buộc — mặc định ghi `server/logs/mail-outbox.log`, xem README Mục 16I): cấu hình `MAIL_ENABLED=true` + `SMTP_*` trong `server/.env` TRƯỚC khi khởi động backend.
- Backend chạy ở `http://localhost:5000`, Frontend ở `http://localhost:5173`.
- **`npm test` (backend) giờ chạy trên database TEST riêng** (`DB_NAME_TEST`, xem README Mục 10/15) — an toàn chạy song song lúc demo, không còn đụng dữ liệu dev đang hiển thị trên UI (khác với trước đây). Chỉ cần tránh chạy `npm run test:setup`/`npm run test:e2e` lúc demo (2 lệnh đó build lại DB TEST, không phải DB dev — vẫn an toàn với demo, nhưng tốn tài nguyên máy không cần thiết giữa buổi).
- Đăng xuất hết các tab trình duyệt đang mở trước đó để demo từ trạng thái sạch (`/login`).
- Tài khoản demo: xem Mục 13 `README.md` (gốc dự án) — **không chép lại mật khẩu vào đây**, luôn tham chiếu `README.md` để tránh lệch khi mật khẩu đổi.

## 3. Khởi động hệ thống (dựa trên `README.md` thật)

```bash
# 1. MariaDB (XAMPP) — phải chạy trước, nghe cổng 3306
#    (Windows: mở XAMPP Control Panel → Start MySQL,
#     hoặc dòng lệnh: "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini")

# 2. Backend
cd server
npm run dev        # hoặc: npm start

# 3. Frontend (terminal khác)
cd client
npm run dev
```

## 4. Xác nhận health check (làm trước demo, KHÔNG live trước hội đồng)

```
GET http://localhost:5000/api/health      -> {"success":true,"message":"Backend is running"}
GET http://localhost:5000/api/health/db   -> {"success":true,"message":"Database connection is working"}
```

Nếu `health/db` lỗi → MariaDB chưa chạy hoặc `.env` sai `DB_*` → xem `DEMO_READINESS_CHECKLIST.md` Mục "Phương án dự phòng".

Mở `http://localhost:5173` → phải thấy `/login`. **[API/TEST]**

## 5. Demo theo vai trò

### 5.1. Admin (đăng nhập `admin@example.com`)

1. **Dashboard** (`/admin/dashboard`) — tổng quan số liệu. **[CHƯA XÁC MINH BROWSER]**
2. **Danh mục** — vào `/admin/departments`, `/admin/internship-periods`, `/admin/topics`: cho thấy CRUD cơ bản (ví dụ sửa 1 Khoa rồi sửa lại ngay, không để lại thay đổi vĩnh viễn). **[CODE REVIEW]** (CRUD đã test qua `tests/crudSmoke.test.js` ở tầng API)
3. **Hồ sơ thực tập** (`/admin/internships`) → mở `internships.id=3` (`/admin/internships/3`, sinh viên **Lê Hoàng Nam**, trạng thái **"pending"**, chưa có doanh nghiệp/giảng viên):
   - Phân công giảng viên qua `AssignLecturerModal` (giao diện "Phân công Giảng viên").
   - Phân công doanh nghiệp + người hướng dẫn qua `AssignCompanyModal` — chọn 1 công ty, hệ thống chỉ cho chọn mentor **thuộc đúng công ty đó** (cascading select) — đây là luật đã kiểm chứng qua `tests/internshipWorkflow.test.js` ("Assignment: company_mentor không thuộc company đã chọn → 400"). **[API/TEST]**
   - Chuyển trạng thái **pending → approved** qua nút đổi trạng thái trên `InternshipDetailPage.jsx`.
   - **Kết quả mong đợi**: chuyển thành công, không cho nhảy thẳng sang `in_progress` (thử bấm sai thứ tự nếu UI cho phép chọn tự do — sẽ bị chặn 409). **[API/TEST]** (`tests/internshipWorkflow.test.js`)
   - **Quan trọng — khôi phục lại sau demo**: đây là dữ liệu seed dùng chung cho automated test (`tests/internshipWorkflow.test.js`, `tests/internshipAdminLifecycle.test.js` đều ground-truth từ `internships.id=3` ở trạng thái `pending`, chưa gán company/mentor/lecturer). Sau khi demo xong, **đổi lại `internships.id=3` về `pending` và gỡ company/mentor/lecturer đã gán** (PUT lại `company_id=null, company_mentor_id=null, lecturer_id=null, status='pending'`) để lần chạy `npm test` tiếp theo không bị lệch ground-truth. Nếu không chắc khôi phục đúng, dùng tài khoản demo riêng/hồ sơ khác để tránh đụng `internships.id=3`.
4. **Đề tài** (`/admin/topics`) — xem danh sách đề tài, trạng thái `proposed`/`approved`/`rejected`.
5. **Tài khoản** (`/admin/accounts`) — xem danh sách user. Minh họa khóa/mở tài khoản: bấm "Khóa" trên 1 account KHÔNG dùng ở demo (ví dụ `student3@example.com`) → xác nhận → badge chuyển "Đã khóa"; thử đăng nhập bằng account đó ở tab ẩn danh → 403 → quay lại bấm "Mở khóa" để khôi phục ngay. Minh họa reset mật khẩu tạm: mở chi tiết account đó → "Đặt lại mật khẩu" → hệ thống trả mật khẩu tạm (chỉ hiện đúng 1 lần) → đăng nhập thử bằng mật khẩu tạm đó → bị ép chuyển sang `/change-password` ngay (không vào được trang khác) cho tới khi đổi mật khẩu — đây là `users.must_change_password`, mới bổ sung ở đợt kiểm tra trước bảo vệ. **[API/TEST]** (`tests/accountSecurity.test.js`)
6. **Cấu hình** (`/admin/settings`) — minh họa `allowStudentRegistration`: tắt → sang tab Student xác nhận nút "Đăng ký thực tập" biến mất (REQ-043) → bật lại ngay. Minh họa thêm: trọng số điểm tổng kết (Giảng viên/Doanh nghiệp, mặc định 60/40) — thử đổi 1 ô sao cho tổng ≠ 100 → nút Lưu tự khóa + cảnh báo đỏ ngay trên form (không cần gọi API mới thấy lỗi). **[CHƯA XÁC MINH BROWSER]** — đây chính là bước cần tự tay thử trước (xem checklist).
7. **Nhập danh sách từ Excel** (`/admin/students` → nút "Nhập từ Excel") — bấm "Tải file mẫu" để cho thấy file có sẵn header + ví dụ + hướng dẫn, nhưng để demo nhanh thì chọn luôn file đã điền sẵn `docs/demo-files/students-import-demo.xlsx` (3 dòng hợp lệ) → "Xem trước" → bảng hiện "hợp lệ 3, lỗi 0" (tô xanh, không có dòng đỏ) → tick "Tạo luôn tài khoản đăng nhập" → "Xác nhận nhập" → thông báo "Đã nhập thành công 3 dòng" + nút tải file tài khoản (email + mật khẩu tạm) → đóng modal, tìm `99990001` trong danh sách để xác nhận đã có. Có thể lặp lại với file KHÔNG hợp lệ (xóa email 1 dòng trong file demo trước) để minh họa bảng preview tô đỏ dòng lỗi kèm lý do tiếng Việt, và nút "Xác nhận nhập" bị khóa cho tới khi hết lỗi. **[API/TEST]** (`server/tests/importStudents.test.js`, `e2e/adminImport.spec.js`) — *dọn dẹp sau demo: xóa 3 sinh viên `99990001`–`99990003` (và tài khoản liên kết, nếu đã tạo) qua UI để không tích lũy dữ liệu demo qua nhiều lần chạy.*
8b. **Nhắc việc tự động + báo cáo nộp trễ** — dùng đúng `internships.id=1` (Student A, Lecturer A, Mentor B — xem Mục 5.2–5.4) vì nhật ký gần nhất của hồ sơ này (`2025-03-10` trong seed) đã TỰ NHIÊN quá hạn 7 ngày tính tới bất kỳ ngày demo thật nào:
   - `/admin/internship-periods` → sửa đợt "TT2024-2" → đặt "Hạn nộp báo cáo tổng kết" và "Hạn hoàn tất đánh giá" = **ngày mai thật** (tính theo ngày demo) → Lưu.
   - Vào `/admin/dashboard` → thẻ "Việc cần làm theo đợt" hiện số liệu cho TT2024-2 (≥1 hồ sơ trễ nhật ký, ≥1 hồ sơ sắp hạn báo cáo/đánh giá).
   - Đăng xuất, đăng nhập lại `student@example.com`/`lecturer@example.com`/`company2@example.com` → mỗi Dashboard đều có thẻ "Việc cần làm" riêng (Student: nhắc chính mình; Lecturer/Mentor: thấy đúng SV "Nguyễn Minh Anh - 21110001").
   - Mở terminal: `cd server && npm run reminders:run` → log in ra số nhắc việc đã gửi → vào `/student/notifications`, `/lecturer/notifications`, `/company/notifications` xác nhận có thông báo mới loại "reminder".
   - Student nộp 1 báo cáo tổng kết mới (`StudentReportsPage.jsx`, dùng file demo PDF) → vì đã qua hạn vừa đặt → báo cáo hiện ngay badge đỏ "Nộp trễ"; thử xuất lại `internships.xlsx` để thấy cột "Báo cáo tổng kết nộp trễ" = "Có". **[API/TEST]** (`server/tests/reminderJob.test.js`, `server/tests/reportLateFlag.test.js`)
   - **Dọn dẹp sau demo**: xóa báo cáo final vừa nộp (Admin, `/admin/reports`), đặt lại 2 hạn của TT2024-2 về trống (bấm xóa nội dung ô ngày), và chạy `DELETE FROM reminder_logs WHERE sent_date = CURDATE();` (hoặc đợi qua ngày — `reminder_logs` không ảnh hưởng gì tới demo lần sau ngoài việc job sẽ bỏ qua các reminder_key đã gửi trong NGÀY HÔM ĐÓ).

9b. **Vị trí thực tập + Ứng tuyển** — dùng `company2@example.com` ("mentorB", công ty FPT Software) và `student4@example.com` ("studentD", chưa có hồ sơ thực tập nào):
    - Đăng nhập mentorB → `/company/positions` → "+ Đăng vị trí mới" → chọn đợt "TT2025-1" → nhập tên vị trí, số lượng (slots) = 1 → Lưu → vị trí mới hiện trong danh sách, trạng thái "Còn nhận đơn".
    - Đăng xuất, đăng nhập studentD → `/student/positions` → thấy vị trí vừa đăng ở danh sách "Vị trí thực tập" → bấm "Ứng tuyển" → nhập ghi chú (tùy chọn) → "Gửi đơn ứng tuyển" → mục "Đơn ứng tuyển của tôi" hiện đơn mới, trạng thái "Đang chờ".
    - Đăng xuất, đăng nhập lại mentorB → `/company/positions` → "Xem đơn ứng tuyển" trên vị trí đó → thấy đơn của studentD → bấm "Chấp nhận" → trạng thái đổi "Đã nhận" → đóng modal → vị trí tự chuyển "1/1" + "Đã đóng" (hết slot).
    - Vào `/admin/internships` (đăng nhập Admin) → tìm hồ sơ thực tập mới của studentD (đợt TT2025-1, trạng thái "Đã duyệt") → chỉ ra hồ sơ này được **tự động tạo** từ hành động chấp nhận, không qua luồng đăng ký/duyệt thủ công thông thường. **[API/TEST]** (`server/tests/positionApplications.test.js`, `e2e/internshipPositions.spec.js`) — *dọn dẹp sau demo: Admin xóa hồ sơ thực tập vừa tạo (`/admin/internships`, chỉ xóa được khi `pending` — nếu đã `approved` thì sửa trực tiếp qua SQL hoặc để lại, không ảnh hưởng demo lần sau vì dùng period/slots mới mỗi lần).*

9. **Quên mật khẩu + email** (làm TRƯỚC khi đăng nhập Admin, ở `/login`): bấm "Quên mật khẩu?" → nhập `student4@example.com` → "Gửi yêu cầu đặt lại mật khẩu" → thông báo chung (không lộ email có tồn tại hay không). Vì `.env` demo không bật `MAIL_ENABLED=true` (xem README Mục 16I), mở file `server/logs/mail-outbox.log` (dòng JSON cuối cùng) để lấy link + token thay cho việc đọc hộp thư thật — copy link dạng `.../reset-password?token=...` dán vào trình duyệt → nhập mật khẩu mới → tự chuyển về `/login` → đăng nhập thử bằng mật khẩu mới để xác nhận. Minh họa thêm: đăng nhập Admin → `/change-password` → tắt checkbox "Nhận email khi có thông báo mới" → thực hiện 1 hành động tạo thông báo (vd. duyệt báo cáo) → mở lại `mail-outbox.log`, chỉ ra KHÔNG có dòng mới cho Admin (notification vẫn có trong `/admin/notifications` như thường) → bật lại checkbox để khôi phục. **[API/TEST]** (`server/tests/passwordReset.test.js`, `server/tests/mail.test.js`) — *nếu có cấu hình SMTP thật (Gmail App Password/Mailtrap — README Mục 16I) trước giờ demo, có thể bật `MAIL_ENABLED=true` để mở hộp thư thật cho hội đồng xem trực tiếp, ấn tượng hơn đọc file log.*

### 5.2. Student (đăng nhập `student@example.com` — Nguyễn Minh Anh, `students.id=1`, có hồ sơ `internships.id=1` đang `in_progress`, GVHD = Trần Quốc Bảo, Mentor = Nguyễn Thị Hạnh)

1. **Hồ sơ thực tập** (`/student/internship`) — xem thông tin hồ sơ của chính mình (đã có, không cần đăng ký mới — tránh tạo thêm internship lúc demo).
2. **Nhật ký** (`/student/logs`) — xem 2 nhật ký đã có (`internship_logs.id=1` đã `reviewed`, `id=2` còn `submitted`). Thử **sửa nội dung log đã `reviewed`** → hệ thống chặn (khóa 1 chiều, `tests/businessRules.test.js`). **[API/TEST]**
3. Ghi 1 nhật ký mới (form `LogFormModal`) → submit → thấy log mới trạng thái `submitted`. **Kết quả mong đợi**: 201, xuất hiện ngay trong danh sách. **[API/TEST]** (`tests/internshipLogsAuthorization.test.js`, case "ghi nhật ký mới hợp lệ")
   - *(Tùy chọn dọn dẹp sau demo: xóa log vừa tạo bằng nút Xóa trên UI — log chưa `reviewed` nên xóa được.)*
4. **Báo cáo** (`/student/reports`) — xem báo cáo đã nộp, thử nộp báo cáo mới: chọn loại báo cáo + **upload file PDF thật** (dùng sẵn 1 file trong `docs/demo-files/` — không cần tự chuẩn bị file trước giờ demo), `submitted_at` tự sinh theo đúng ngày giờ Việt Nam (không cho nhập tay, không còn lệch UTC lúc sáng sớm — xem README Mục 16D). Thử bấm "Tải xuống" ngay sau khi nộp → tải lại đúng file vừa upload.
5. **Đánh giá** (`/student/evaluations`) — chỉ thấy đánh giá **đã công bố** (`evaluations.id=1`, `evaluator_role=lecturer`, `is_published=1`) — **không** thấy đánh giá công ty nếu chưa công bố (minh họa REQ-038, `tests/idor.test.js`). Nếu hồ sơ nào đã có CẢ HAI đánh giá công bố (ví dụ `internships.id=9` hoặc `10`, đã `completed`), trang này còn hiện thêm **Điểm tổng kết thực tập + Xếp loại** (tính từ 2 đánh giá theo trọng số ở `/admin/settings`) — nếu chưa đủ 2 đánh giá công bố thì phần này không hiện (không phải lỗi). **[API/TEST]**

### 5.3. Lecturer (đăng nhập `lecturer@example.com` — Trần Quốc Bảo, phụ trách `internships.id=1`)

1. **Sinh viên phụ trách** (`/lecturer/students`) → mở chi tiết (`/lecturer/students/1`) — chỉ thấy sinh viên mình phụ trách, không thấy sinh viên của giảng viên khác.
2. **Duyệt đề tài** trên `LecturerStudentDetailPage.jsx` (nếu sinh viên có đề tài `proposed`) — duyệt/từ chối.
3. **Nhật ký** (`/lecturer/logs`) — mở log `id=2` (`submitted`) → nhận xét (`lecturer_comment`) → chuyển `reviewed`. **Kết quả mong đợi**: 200, sau đó log bị khóa nội dung (quay lại tab Student xác nhận không sửa được nữa). **[API/TEST]** — *nhớ khôi phục `lecturer_comment` gốc sau demo nếu muốn giữ seed data sạch, tương tự cách `tests/internshipLogsAuthorization.test.js` làm.*
4. **Báo cáo** (`/lecturer/reports`) — duyệt báo cáo (set `status` + `reviewer_comment`).
5. **Đánh giá** (`/lecturer/evaluations`) — tạo/sửa đánh giá cho sinh viên mình phụ trách, minh họa "Công bố" là hành động 1 chiều (công bố rồi không gỡ được, trừ Admin). **[API/TEST]** (`tests/businessRules.test.js`)

### 5.4. Company Mentor (đăng nhập `company2@example.com` — Nguyễn Thị Hạnh, hướng dẫn `internships.id=1` — **CÙNG hồ sơ với Student/Lecturer ở trên**, dùng để minh họa rõ "1 hồ sơ, nhiều góc nhìn theo scope")

1. **Sinh viên hướng dẫn** (`/company/students`) — chỉ thấy đúng 1 sinh viên (Nguyễn Minh Anh) vì chỉ phụ trách 1 hồ sơ.
2. **Nhật ký** (`/company/logs`) — thêm `company_comment` cho log — thử gửi kèm `lecturer_comment` (nếu có cách nào từ UI) → bị chặn 403 field ngoài whitelist (`tests/internshipLogsAuthorization.test.js`). **[API/TEST]**
3. **Đánh giá** (`/company/evaluations`) — tạo đánh giá độc lập với đánh giá Lecturer (unique theo `(internship_id, evaluator_role)`).

10. **Xuất giấy tờ PDF** — dùng `internships.id=1` (Student A, `in_progress`, đã có company) để demo giấy giới thiệu, và hồ sơ bất kỳ đã `completed` (vd. sau khi hoàn thành Bước 7 Mục 6 dưới đây) để demo phiếu kết quả:
    - (Tùy chọn trước) `/admin/settings` → điền "Tên trường"/"Tên khoa" → Lưu → PDF sẽ có tên trường/khoa thay cho dòng chấm trống.
    - Đăng nhập `student@example.com` → `/student/internship` → bấm "Tải giấy giới thiệu thực tập (PDF)" → file PDF tải xuống, mở ra xem đúng tên trường/khoa (hoặc dòng chấm nếu chưa cấu hình), thông tin sinh viên + doanh nghiệp, chữ tiếng Việt có dấu hiển thị đúng (không ô vuông/lỗi font).
    - Với 1 hồ sơ đã `completed` (Admin, `/admin/internships/:id`, hoặc Lecturer ở `/lecturer/students/:id`) → bấm "Phiếu kết quả (PDF)" → file PDF có điểm 4 thành phần của cả Giảng viên/Doanh nghiệp, điểm tổng kết + xếp loại, nhận xét 2 phía.
    - Minh họa chặn đúng điều kiện: thử gọi trực tiếp `GET /api/internships/3/documents/introduction-letter.pdf` (hồ sơ `pending`, chưa có company — qua Postman/trình duyệt) → nhận 409, không phải file PDF giả/lỗi. **[API/TEST]** (`server/tests/internshipDocuments.test.js`)

## 6. Luồng nghiệp vụ liên kết giữa các vai trò

Dùng đúng **`internships.id=3`** (Mục 5.1) để trình diễn full chuỗi trong 1 phiên:

```
Admin: phân công (Lecturer + Company + Mentor + Topic) → đổi pending → approved
Admin: đổi approved → in_progress
Student (của hồ sơ id=3, là Lê Hoàng Nam — KHÔNG có tài khoản demo sẵn liên kết thuận tiện,
  nên bước "Student ghi log" minh họa lại trên internships.id=1 ở Mục 5.2, giải thích bằng lời
  rằng đây là CÙNG MỘT LOGIC áp dụng cho mọi hồ sơ, không riêng gì id=1)
Lecturer/Mentor: nhận xét log, duyệt báo cáo, đánh giá
Admin: đổi in_progress → completed (ép progress=100 tự động)
```

> **Ghi chú trung thực**: `students.id=3` (Lê Hoàng Nam, chủ hồ sơ `internships.id=3`) hiện **chưa có tài khoản đăng nhập liên kết** (`students.user_id = NULL` theo seed thật) — nên không thể đăng nhập "với vai Student của hồ sơ id=3" để demo full round-trip bằng đúng 1 bộ tài khoản. Giải pháp: minh họa Admin-side (phân công + đổi trạng thái) trên `internships.id=3`, còn Student/Lecturer/Mentor-side nhật ký/báo cáo/đánh giá minh họa trên `internships.id=1` (đã có đủ cả 3 tài khoản liên kết thật) — nêu rõ với hội đồng đây là 2 hồ sơ khác nhau dùng để tách minh họa 2 nhóm chức năng, tránh gây hiểu nhầm "APP chỉ chạy đúng 1 luồng cứng".

## 7. Demo thống kê và xuất Excel

1. Admin → `/admin/statistics`.
2. Chọn filter (Khoa/Đợt/Doanh nghiệp) → bảng số liệu cập nhật — **gọi `GET /api/statistics/summary` thật** (tính bằng SQL `GROUP BY` ở server, đợt kiểm tra trước bảo vệ chuyển từ tính ở client sang tính ở server), có thể mở DevTools Network để chỉ ra request này nếu hội đồng hỏi.
3. Bấm "Xuất thông tin thực tập (.xlsx)" và "Xuất đánh giá (.xlsx)" → file `.xlsx` tải xuống (file đánh giá có thêm cột "Điểm tổng kết thực tập"/"Xếp loại" ở cuối bảng). **[API/TEST]** (`server/services/exportService.test.js`, scope/IDOR đã kiểm chứng qua HTTP thật ở Phase 5).
4. **Lecturer/Company Mentor cũng có nút xuất Excel** (trang danh sách sinh viên + trang đánh giá, mỗi trang 1 nút tương ứng) — bổ sung ở đợt vừa rồi, có thể demo nhanh bằng tài khoản Lecturer/Mentor nếu hội đồng muốn thấy phân quyền export áp dụng đúng theo scope của từng role.
5. **Giới hạn cần nói rõ nếu được hỏi**: Student hiện vẫn **chưa có nút xuất Excel trên UI** (backend đã hỗ trợ đúng scope, test PASS, chỉ thiếu nút) — không thuộc phạm vi đã yêu cầu bổ sung, có thể minh họa bằng gọi API trực tiếp nếu hội đồng muốn thấy (xem `DEFENSE_QA.md`).

## 8. Demo quyền truy cập — vì sao không bypass được

Giải thích bằng lời + (nếu có thời gian) mở DevTools/Postman minh họa trực tiếp:

1. **Đổi ID trên URL không giúp xem dữ liệu người khác**: Student A thử mở `/student/logs` rồi gọi thủ công `GET /api/internship-logs/3` (log của Student B) qua DevTools Network hoặc Postman với token Student A → nhận **403**, không phải dữ liệu thật, không phải 404 (không lộ cả việc tài nguyên có tồn tại hay không). Đây là do **scope luôn được backend tự suy ra từ JWT** (`scopeService`), không tin bất kỳ ID nào từ client — xem `server/tests/idor.test.js` và `server/tests/internshipLogsAuthorization.test.js`.
2. **Tự gọi API với field bị khóa cũng không vượt qua được**: ví dụ Student gửi `PUT /api/internships/1` kèm `student_id` khác → 400 ngay (immutable field, `tests/fieldInjection.test.js`), hoặc gửi field ngoài whitelist cho vai của mình → 403 (`tests/internshipLogsAuthorization.test.js`, `tests/reportsAuthorization.test.js`).
3. **Response lỗi không lộ thông tin nội bộ**: dù có cố tình gây lỗi server (ví dụ payload sai kiểu dữ liệu gây exception), response vẫn chỉ trả message chung, không có stack trace — trừ khi biến môi trường `DEBUG_ERRORS=true` được bật tường minh (`server/middleware/errorHandler.js`, Phase 7B fix F-03, `tests/errorHandling.test.js`).

## 9. Kết quả mong đợi sau mỗi bước

Đã ghi trực tiếp trong từng mục ("Kết quả mong đợi: ..."). Quy tắc chung: mọi hành động hợp lệ trả **2xx** và dữ liệu cập nhật ngay trên UI (không cần F5); mọi hành động vi phạm business rule/scope trả **4xx** đúng mã (400 validate, 403 quyền, 404 không tồn tại, 409 xung đột trạng thái) và **không** đổi dữ liệu.

## 10. Tùy chọn: chạy lại luồng demo tự động bằng Playwright (không bắt buộc)

Nếu muốn có 1 bản "chạy thử tự động" của gần như toàn bộ luồng ở Mục 5–6 trước khi demo live (để chắc chắn UI không có lỗi mới phát sinh), chạy:

```bash
npx playwright install chromium   # 1 lần đầu nếu máy chưa có
npm run test:e2e                  # chạy từ gốc dự án
```

Đây là smoke test tự động (không phải buổi demo thật) — tự dựng backend+frontend thật trên **database test riêng** (không đụng database dev đang dùng để demo), đăng nhập cả 4 role, đăng ký thực tập, ghi nhật ký, upload báo cáo PDF thật, nhận xét/duyệt, chấm+công bố điểm, chuyển `completed`, xem điểm tổng kết, xuất Excel, khóa/mở tài khoản, Admin nhập 3 sinh viên từ file Excel mẫu, và Mentor đăng vị trí thực tập → Sinh viên ứng tuyển → Mentor chấp nhận. PASS hết nghĩa là luồng chính không có lỗi UI mới — không thay thế cho việc tự tay thử lại 1 lần trước hội đồng (UI thật có thể còn vài tiểu tiết trình bày Playwright không kiểm tra, ví dụ màu sắc/responsive).

## 11. Tình huống lỗi và phương án dự phòng an toàn

| Tình huống | Phương án |
|---|---|
| MariaDB không chạy / health check `db` fail | Khởi động lại MariaDB (XAMPP Control Panel hoặc `mysqld.exe` dòng lệnh), xác nhận lại `GET /api/health/db` **trước khi** mở lại trình duyệt trước hội đồng |
| Backend không start (port 5000 đã bị chiếm) | Kiểm tra process cũ còn chạy (`node server.js` từ phiên trước chưa tắt) — tắt process cũ, không đổi `PORT` giữa buổi demo |
| Lỡ tay sửa/xóa dữ liệu seed quan trọng (ví dụ hồ sơ `internships.id=3`) | **Không reseed toàn bộ DB giữa buổi bảo vệ** (rủi ro cao, tốn thời gian) — chỉ cần sửa lại đúng field đã đổi qua UI (đổi `status` về `pending`, gỡ `company_id`/`lecturer_id`/`company_mentor_id` về `null`) bằng chính Admin UI, không cần chạm SQL trực tiếp |
| Trình duyệt bị văng về `/login` giữa demo (token hết hạn) | Đăng nhập lại — `JWT_EXPIRES_IN=1d` theo `.env`, không nên kéo dài 1 session quá 1 ngày, nhưng nếu hết hạn thì đăng nhập lại là đủ, không mất dữ liệu |
| Export Excel không tải được (lỗi mạng/trình duyệt chặn download) | Thử lại 1 lần; nếu vẫn lỗi, chuyển sang minh họa qua Postman/curl gọi trực tiếp `GET /api/exports/internships.xlsx` với token Admin để cho thấy backend vẫn hoạt động đúng |
| Hội đồng yêu cầu xem 1 chức năng không có trong kịch bản | Trả lời trung thực theo đúng trạng thái trong `docs/REQUIREMENT_TRACEABILITY_MATRIX.md`/`DEFENSE_QA.md` — không bịa, không demo chức năng chưa tồn tại |
| Hội đồng hỏi về triển khai thật (production/Docker) | Đây KHÔNG phải nội dung demo live (demo luôn chạy ở môi trường dev — 2 server riêng, xem Mục 3) — trả lời bằng `docs/TRIEN_KHAI.md` (chạy qua `docker compose`, VPS + Nginx + HTTPS, sao lưu DB/uploads) và README Mục 16M/`DEFENSE_QA.md` Mục V/W; nói rõ Docker build/up chưa được chạy thật trong môi trường phát triển (chỉ code review + verify tương đương bằng bản production local không container, xem `docs/TRIEN_KHAI.md` Mục 2.4), không bịa đã verify |
| Demo "Vị trí thực tập + Ứng tuyển" (Mục 5) — Mentor chấp nhận đơn bị 409 ngoài ý muốn | `positionApplicationService.accept()` vừa siết thêm vài điều kiện (sinh viên đã có hồ sơ không ở trạng thái `pending`, đợt/doanh nghiệp/mentor không còn hoạt động — xem README Mục 16M, `DEFENSE_QA.md` Mục W câu 83) — luồng happy-path của demo (sinh viên mới, chưa có hồ sơ gì trong đợt) không bị ảnh hưởng; nếu tái dùng dữ liệu demo cũ đã từng accept/cancel trước đó, kiểm tra lại đúng trạng thái hồ sơ trước khi demo |
