# API PHASE 5 — Export Internship Information + Evaluation/Comment (XLSX)

## 1. Requirement mapping
Đồ án yêu cầu: "export internship information" và "export evaluations/comments" — xác nhận ở Full System Gap Audit (sau 4F-2) đây là gap 0% duy nhất liên quan trực tiếp tới yêu cầu đồ án. Phase này implement đúng 2 export này, dạng `.xlsx`, không PDF/CSV, không file upload/storage, không bảng DB mới, không background job.

## 2. Export architecture
```
DB (MySQL, parameterized SELECT + JOIN, scope giống hệt GET /internships, /evaluations)
   ↓
exportService.js (ExcelJS Workbook, in-memory, không persist)
   ↓
exportController.js (validate filter, set HTTP headers, stream workbook vào response)
   ↓
exportRoutes.js (requireAuth, không requireRole riêng — scope tự giới hạn trong service)
   ↓
client/src/api/exportApi.js (apiClient.getBlob — capability mới)
   ↓
AdminStatisticsPage.jsx (Blob → object URL → <a download> → revoke)
```
Service hoàn toàn không biết gì về HTTP (trả `ExcelJS.Workbook`, controller tự quyết định cách gửi) — đúng tách lớp controller/service đã dùng xuyên suốt dự án.

## 3. Endpoints
```
GET /api/exports/internships.xlsx   ?period_id=&department_id=&company_id=
GET /api/exports/evaluations.xlsx   ?period_id=&department_id=&company_id=
```
Không có `/export-all-everything`, không gộp 2 export thành 1 endpoint `?format=`, không có endpoint combined package (optional ở mục 18 của đề bài — không implement vì 2 endpoint đã đủ, giữ architecture đơn giản nhất).

## 4. Role permissions
Không có `requireRole()` riêng cho export — đúng convention đã có sẵn của `GET /api/internships` và `GET /api/evaluations` (mọi role đã đăng nhập gọi được, scope tự giới hạn dữ liệu trong service). Test thật xác nhận:
```
Admin           → thấy toàn bộ phạm vi
Student         → chỉ hồ sơ/đánh giá của chính mình
Lecturer        → chỉ internship mình phụ trách + evaluation evaluator_role='lecturer'
Company Mentor  → chỉ internship mình hướng dẫn + evaluation evaluator_role='company'
Không token/token sai → 401 (cả 2 endpoint)
```

## 5. Scope rules
Mirror ĐÚNG scope đã có ở `internshipService.getAll()`/`evaluationService.getAll()` (Phase 3B), không tạo luật authorization mới:
```
Internship export:
  student        → i.student_id = ownStudentId
  lecturer       → i.lecturer_id = ownLecturerId
  company_mentor → i.company_mentor_id = ownMentorId
  admin          → không điều kiện

Evaluation export:
  student        → i.student_id = ownStudentId AND e.is_published = 1   (bắt buộc, mục 11)
  lecturer       → i.lecturer_id = ownLecturerId AND e.evaluator_role = 'lecturer'
  company_mentor → i.company_mentor_id = ownMentorId AND e.evaluator_role = 'company'
  admin          → không điều kiện
```
Filter (`period_id`/`department_id`/`company_id`) luôn áp dụng SAU scope (AND thêm vào, không bao giờ thay thế) — test xác nhận Student gửi `?department_id=999` (không khớp scope của mình) nhận về workbook rỗng (0 dòng), không lỗi, không leak.

## 6. Internship export columns
Sheet "Thông tin thực tập", 1 row = 1 internship: Mã sinh viên, Họ tên, Email, Lớp, Ngành, Khoa/Bộ môn, Mã doanh nghiệp, Doanh nghiệp, Địa chỉ doanh nghiệp, Người hướng dẫn DN, Email người hướng dẫn, Giảng viên hướng dẫn, Email giảng viên, Mã đề tài, Đề tài, Mã đợt, Đợt thực tập, Ngày bắt đầu/kết thúc đợt, Trạng thái (nhãn tiếng Việt), Tiến độ (%), Ngày bắt đầu/kết thúc thực tập. Tất cả field lấy trực tiếp từ schema hiện có (students/departments/companies/company_mentors/lecturers/topics/internship_periods/internships) — không field nào bịa thêm.

## 7. Evaluation export columns
Sheet "Đánh giá", 1 row = 1 evaluation (1 internship có cả lecturer + company evaluation → 2 dòng riêng, không gộp — xác nhận qua test Admin thấy đúng 2 dòng cho 2 evaluation hiện có): Mã sinh viên, Họ tên, Doanh nghiệp, Đề tài, Mã đợt, Đợt thực tập, Loại người đánh giá (Giảng viên/Người hướng dẫn doanh nghiệp), Người đánh giá (tên thật, suy ra từ `internship.lecturer_id`/`internship.company_mentor_id` — KHÔNG có `evaluator_id` nào được thêm, giữ đúng architecture hiện có), 4 điểm thành phần + điểm tổng kết, Nhận xét, Trạng thái công bố, Ngày công bố.

## 8. Filters
Chỉ 3 filter THỰC SỰ tồn tại ở `AdminStatisticsPage.jsx` (period/department/company) — không tạo filter mới. Test:
```
?period_id=1                        → đúng 2/12 dòng (TT2024-1)
?department_id=1                    → đúng 4/12 dòng
?period_id=2&department_id=1        → đúng 3/12 dòng (giao của cả 2)
?period_id=abc                      → 400 (format sai)
```

## 9. XLSX generation
Thư viện: `exceljs` (mới cài, version ^4.4.0 — đã kiểm tra `server/package.json` trước khi cài, chưa có thư viện XLSX nào, không cài thêm pdfkit/puppeteer/csv-writer/xlsx). Workbook build trong bộ nhớ (không ghi file tạm ra đĩa, không persist) — dataset hiện tại nhỏ (≤14 dòng mỗi export ở thời điểm test), không cần streaming/background job.

## 10. Filename convention
```
internship-information-YYYY-MM-DD.xlsx
evaluations-YYYY-MM-DD.xlsx
```
Ngày lấy từ server (`new Date()`), không dùng input từ client — tránh vấn đề overwrite và tránh rủi ro filename injection từ user input chưa sanitize.

## 11. HTTP headers
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="..."
```
Xác nhận bằng `curl -D` thật — đúng cả 2 header, không trả JSON success sau khi gửi file, không base64.

## 12. Frontend download flow
`apiClient.js` được bổ sung `getBlob(path)` (capability mới, tái dùng `getToken()`/`ApiError`/`UnauthorizedError`/`parseBody` sẵn có — không viết fetch wrapper riêng). Nếu response lỗi (xác nhận qua test thật: mọi lỗi đều trả `Content-Type: application/json`), `getBlob` parse JSON lấy đúng `message` rồi throw — KHÔNG BAO GIỜ tải nhầm JSON lỗi thành `.xlsx`. `exportApi.js` build query string từ 3 filter, gọi `apiClient.getBlob`. `AdminStatisticsPage.jsx` dùng `triggerBlobDownload()` (`client/src/utils/downloadFile.js`, hàm mới) để tạo object URL tạm → `<a download>` ẩn → click → revoke ngay — không `window.open()`, không lưu Blob vào localStorage, không lộ token trong URL (token chỉ nằm trong header `Authorization` của request `fetch`, không bao giờ xuất hiện trong URL export).

## 13. Security tests (HTTP thật)

| Test | Result |
|---|---|
| No token (cả 2 endpoint) | 401 |
| Invalid token (cả 2 endpoint) | 401 |
| Admin internship export | 200 |
| Admin evaluation export | 200 |
| Student A (own) internship export | 200, đúng 1 dòng |
| Student A evaluation export | 200, đúng 1 dòng (published) |
| Lecturer A internship export | 200, đúng 2 dòng (2 sinh viên mình phụ trách) |
| Lecturer A/B evaluation export | 200, chỉ evaluator_role='lecturer' đúng phạm vi mỗi người |
| Company Mentor A/B internship export | 200, đúng đúng số sinh viên mỗi mentor phụ trách |
| Company Mentor A evaluation export | 200, 0 dòng (chưa có evaluation 'company' nào trong seed — đúng workbook rỗng, không lỗi) |

## 14. IDOR tests (parse XLSX thật, không chỉ check status)

| Test | Result |
|---|---|
| Student A export KHÔNG chứa dòng của Student B | PASS (đã parse, StudentA chỉ thấy 21110001, StudentB chỉ thấy 21110005) |
| Lecturer A export KHÔNG chứa sinh viên của Lecturer B | PASS (LecturerA: 2 sinh viên riêng; LecturerB: 2 sinh viên khác, không giao nhau) |
| Company Mentor A export KHÔNG chứa sinh viên của Mentor B | PASS (MentorA: 1 dòng riêng; MentorB: 2 dòng khác, không giao nhau) |
| Filter không khớp scope (`department_id=999` cho Student, `department_id=3` cho Lecturer A) | PASS — trả 0 dòng, không lỗi, không leak |

## 15. Unpublished evaluation protection — PASS (critical)
Đã test tường minh: **Student B có 1 evaluation CHƯA công bố của chính mình** — export evaluation của Student B trả về **0 dòng dữ liệu** (chỉ header), xác nhận hệ thống không bao giờ để Student tải về đánh giá chưa công bố, kể cả của chính họ — đúng mirror behavior của `evaluationService.getAll()` (Student luôn bị ép `is_published=1` vô điều kiện).

## 16. File integrity

| Test | Result |
|---|---|
| File là ZIP/XLSX hợp lệ (`file` command xác nhận "Microsoft Excel 2007+") | PASS |
| Mở lại được bằng ExcelJS (`workbook.xlsx.readFile`/`load`) | PASS |
| Sheet name đúng ("Thông tin thực tập", "Đánh giá") | PASS |
| Header row đúng, in đậm | PASS |
| Row count khớp dữ liệu DB thật (Admin: 12 internship, 2 evaluation) | PASS |
| Empty export (Mentor A evaluation) vẫn là workbook hợp lệ, không 500 | PASS (Option A đã chọn — mục 16 đề bài) |

## 17. Vietnamese encoding test — PASS
Parse lại toàn bộ nội dung bằng ExcelJS, xác nhận các chuỗi: "Nguyễn Minh Anh", "Đang thực tập", "Hệ thống thông tin", "Doanh nghiệp", "Trần Quốc Bảo", "Sinh viên chủ động, hoàn thành tốt các task được giao." hiển thị đúng 100%, không mojibake, không `?` thay thế. (Lưu ý quy trình: toàn bộ test dùng `curl --data-binary`/query param ASCII, KHÔNG gõ văn bản tiếng Việt trực tiếp làm tham số dòng lệnh Bash — đúng quy tắc chuẩn đã rút ra từ các phase trước.)

## 18. Database integrity
```
14/14 tables
19/19 FKs
users=10, departments=4, students=14, lecturers=10, companies=10, company_mentors=7,
internship_periods=3, topics=10, internships=12, internship_logs=3, reports=2, evaluations=2,
notifications=13, settings=1 — TẤT CẢ không đổi so với trước Phase 5.
Không có bảng mới. Export chỉ SELECT — không có INSERT/UPDATE/DELETE nào trong exportService.js.
```

## 19. Lint/build
```
npm run lint:  40 warning — khớp baseline, 0 warning mới ở các file export (apiClient.js,
  exportApi.js, downloadFile.js, AdminStatisticsPage.jsx)
npm run build: 191 modules (+2: exportApi.js, downloadFile.js — đúng số file mới thêm), 0 lỗi
```
Backend: `node server.js` khởi động thành công, `GET /api/health` + `GET /api/health/db` đều PASS. Dependency mới: `exceljs@^4.4.0` (đã thêm vào `server/package.json`, không cài thêm thư viện export nào khác).

## 20. Test infrastructure (tự động vs thủ công)
```
Tự động (MỚI, lần đầu trong dự án): server/services/exportService.test.js — dùng node:test built-in
  (Node 24, không cài Jest/Mocha/Supertest), chạy qua `npm test` (server/package.json). 6 test, chạy
  thẳng trên DB thật (không mock), KHÔNG mutate dữ liệu (export read-only, tái dùng user seed có sẵn,
  không tạo/xoá gì) — PASS 6/6. Phạm vi: scope đúng/sai, filter+scope intersection không leak, Student
  không thấy unpublished evaluation của chính mình, workbook roundtrip (ghi buffer → đọc lại được).
Thủ công: toàn bộ test HTTP thật qua curl (auth/role-gate route-level, HTTP headers, download thật,
  IDOR giữa 6 tài khoản Student/Lecturer/Mentor A&B, filter combination) — ghi rõ đây là MANUAL, không
  tự nhận là "automated coverage" (đúng yêu cầu mục 44 — không phóng đại mức độ tự động hoá).
```

## 21. Browser status
```
NOT VERIFIED
```
Không có browser automation tool trong môi trường này (đã xác nhận lại qua ToolSearch). Đã bù đắp bằng: (a) test HTTP thật mô phỏng đúng request mà frontend sẽ gửi (cùng query string, cùng header), (b) xác nhận error response luôn là `application/json` (điều kiện tiên quyết để logic `apiClient.getBlob()` không tải nhầm file lỗi), (c) đọc lại toàn bộ code `AdminStatisticsPage.jsx`/`exportApi.js`/`downloadFile.js` để xác nhận luồng Blob→object URL→`<a download>`→revoke đúng như thiết kế. Đây KHÔNG thay thế click-through thật trên trình duyệt — nếu người dùng mở được `http://localhost:5173`, nên tự xác nhận bước tải file trước khi coi phase này hoàn thiện tuyệt đối.

## 22. Known limitations
```
- Chỉ Admin có UI export (AdminStatisticsPage) — Student/Lecturer/Company Mentor KHÔNG có nút export
  trên UI, dù backend đã hỗ trợ đúng scope cho cả 4 role (test xác nhận PASS toàn bộ qua HTTP trực
  tiếp). Quyết định này dựa trên: yêu cầu đồ án không chỉ định rõ role nào export, UI hiện tại của 3
  role còn lại không có chỗ tự nhiên để đặt nút export, và nguyên tắc "không mở UI cho đủ role nếu
  không cần" (mục 26 đề bài). Có thể thêm sau nếu được yêu cầu — backend không cần sửa gì.
- Export không hỗ trợ sort/group theo yêu cầu riêng ngoài mặc định (đợt → mã sinh viên cho Internship;
  mã sinh viên → loại đánh giá cho Evaluation) — không có UI nào yêu cầu sort khác.
- Test tự động (node:test) chỉ bao phủ lớp exportService (scope + workbook) — KHÔNG bao phủ route-
  level (`requireAuth`)/controller (validate query)/HTTP headers — các phần đó vẫn chỉ được xác minh
  thủ công qua curl, nêu rõ ở mục 20, không tự nhận là coverage đầy đủ.
- Report file_name (text field) hoàn toàn không liên quan tới export này — không đụng tới, đúng mục
  32 đề bài.
```
