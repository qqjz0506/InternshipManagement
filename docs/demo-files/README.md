# File PDF mẫu cho demo

4 file PDF nhỏ (<1KB, hợp lệ thật — mở được bằng mọi trình đọc PDF), dùng để demo chức năng **upload
báo cáo thực tập** (`POST /api/reports`, xem README gốc mục "Báo cáo thực tập") khi bảo vệ đồ án,
không cần tự chuẩn bị file trước.

| File | Dùng để demo |
|---|---|
| `bao-cao-tuan-mau.pdf` | Sinh viên nộp báo cáo tuần (`report_type=weekly`) |
| `bao-cao-tong-ket-mau.pdf` | Sinh viên nộp báo cáo tổng kết (`report_type=final`) — cần có báo cáo này đã duyệt mới chuyển hồ sơ sang `completed` được |
| `bao-cao-rejected-mau.pdf` | Demo luồng Giảng viên từ chối → Sinh viên nộp lại (chọn file này cho lần nộp lại) |
| `Báo cáo thực tập tuần 1.pdf` | Tên file CÓ DẤU tiếng Việt — demo/verify upload không bị mojibake (`server/config/upload.js` `defParamCharset: 'utf8'`); dùng ở `e2e/full-workflow.spec.js` Bước 4 |

Tạo bằng script thủ công (PDF hợp lệ tối thiểu, không qua thư viện ngoài) — nội dung chỉ mang tính minh họa, không phải báo cáo thật.

## File Excel mẫu cho demo nhập danh sách (Admin)

2 file `.xlsx` đã điền sẵn 3 dòng dữ liệu hợp lệ, dùng để demo chức năng **Admin nhập danh sách từ
Excel** (`POST /api/imports/students/*`, `/api/imports/lecturers/*` — xem README gốc mục "16H. Nhập
danh sách từ Excel (Admin)") khi bảo vệ đồ án, không cần tự điền file mẫu trước.

| File | Dùng để demo |
|---|---|
| `students-import-demo.xlsx` | Nhập 3 Sinh viên — dùng ở `e2e/adminImport.spec.js` |
| `lecturers-import-demo.xlsx` | Nhập 3 Giảng viên |

Tạo bằng `server/scripts/generateImportDemoFiles.js` (dùng `exceljs`, đã có sẵn trong dependencies) —
chạy `node server/scripts/generateImportDemoFiles.js` để tái tạo lại nếu cần (vd. đổi mã khoa demo).
