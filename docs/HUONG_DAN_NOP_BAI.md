# HƯỚNG DẪN ĐÓNG GÓI SOURCE CODE ĐỂ NỘP BÀI

Hướng dẫn này mô tả cách đóng gói source code đồ án để nộp (hội đồng/giảng viên chạy lại được từ
đầu), **không kèm** các thứ sinh ra lúc build/chạy/cài đặt hoặc chứa thông tin nhạy cảm.

## 1. Những gì KHÔNG được đóng gói

| Thư mục/file | Vì sao loại trừ |
|---|---|
| `node_modules/` (ở `client/` và `server/`) | Cài lại bằng `npm install`, không cần nộp (nặng, phụ thuộc OS/arch) |
| `client/dist/` | Build output của `npm run build` — tạo lại được, không phải source |
| `server/.env`, `client/.env` | Chứa secrets (JWT_SECRET, mật khẩu DB...) — **tuyệt đối không nộp**, chỉ nộp `.env.example` |
| `server/uploads/` | File báo cáo thật do người dùng upload lúc chạy — dữ liệu runtime, không phải source |
| `.git/` (nếu có) | Lịch sử Git không cần cho bài nộp (trừ khi đề bài yêu cầu riêng) |
| `*.log`, `logs/` | Log runtime |
| `.vscode/`, `.idea/` | Cấu hình editor cá nhân |

Toàn bộ danh sách trên đã được khai trong [`.gitignore`](../.gitignore) ở gốc dự án — có thể dùng
chính file này để lọc khi đóng gói (xem Mục 2).

## 2. Cách đóng gói (chọn 1 trong 2)

### Cách A — PowerShell (Windows, không cần cài thêm gì)

Chạy từ thư mục cha của `InternshipManagement/`:

```powershell
$exclude = @('node_modules', 'dist', '.env', 'uploads', '.git', '.vscode', '.idea')
$dest = "InternshipManagement_nopbai"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
robocopy "InternshipManagement" $dest /E /XD $exclude /XF ".env"
Compress-Archive -Path $dest -DestinationPath "InternshipManagement_nopbai.zip" -Force
```

`robocopy /XD` loại trừ theo TÊN thư mục (khớp mọi cấp — `client/node_modules`, `server/node_modules`,
`client/dist`, `server/uploads` đều bị loại). `/XF ".env"` loại trừ file `.env` ở mọi cấp (không đụng
`.env.example`).

### Cách B — có Git (dùng `git archive`, tự động tôn trọng `.gitignore`)

Nếu đã `git init` cho dự án (xem README Mục 8), cách này đơn giản và chắc chắn khớp đúng `.gitignore`:

```bash
git add -A
git archive --format=zip -o InternshipManagement_nopbai.zip HEAD
```

`git archive` chỉ đóng gói các file đã được Git theo dõi (tức là đã qua `.gitignore`) — không cần tự
liệt kê loại trừ.

## 3. Kiểm tra lại trước khi nộp

Sau khi đóng gói, giải nén ra một thư mục TẠM và kiểm tra:

- [ ] Không có `node_modules/` ở đâu trong gói
- [ ] Không có `client/dist/`
- [ ] Không có `server/.env` hoặc `client/.env` (chỉ có `.env.example`)
- [ ] Không có `server/uploads/*` (thư mục này có thể trống hoặc không tồn tại — code tự tạo lại lúc chạy)
- [ ] Có đủ `README.md`, `docs/`, `client/src/`, `server/` (trừ `node_modules`), `package.json` của cả 3 cấp (root/client/server)
- [ ] Dung lượng gói hợp lý (không có file nặng bất thường lẫn vào — nếu gói vài trăm MB, khả năng cao `node_modules` chưa bị loại đúng)

## 4. Người nhận bài setup lại từ gói đã nộp

Đúng theo README Mục 7–12 — tóm tắt:

```bash
cd server && npm install && copy .env.example .env   # rồi sửa DB_PASSWORD/JWT_SECRET cho đúng máy
cd ../client && npm install && copy .env.example .env

mysql -u root --default-character-set=utf8mb4 < server/db/schema.sql
mysql -u root --default-character-set=utf8mb4 < server/db/seed.sql

cd ../server && npm run dev     # backend :5000
cd ../client && npm run dev     # frontend :5173 (terminal khác)
```

Chạy test (tùy chọn, không bắt buộc để demo): `cd server && npm run test:setup && npm test` (xem README Mục 15).
