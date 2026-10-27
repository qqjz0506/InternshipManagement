# TRIỂN KHAI PRODUCTION

> **Lưu ý minh bạch**: Docker/Docker Compose KHÔNG có sẵn trong môi trường phát triển dùng để viết
> tài liệu này — toàn bộ `Dockerfile`/`docker-compose.yml` dưới đây đã được review kỹ theo cú pháp
> chuẩn và logic đã verify tách biệt (static serving, kiểm tra cấu hình — xem
> `server/tests/productionStaticServing.test.js`, `server/tests/productionConfig.test.js`), nhưng
> **chưa tự chạy được `docker compose up` thật để xác nhận build thành công end-to-end**. Nếu gặp
> lỗi khi chạy thật, đây là nơi đầu tiên cần nghi ngờ — ưu tiên kiểm tra phiên bản Docker, dung
> lượng đĩa, và log build (`docker compose --env-file .env.production up --build` không `-d` để
> thấy log trực tiếp).

## 1. Kiến trúc triển khai

- **1 image duy nhất** chứa backend Express + bản build tĩnh của frontend (Vite) — `server/app.js`
  tự phục vụ `client/dist` khi `NODE_ENV=production` (xem README Mục 16M), nên chỉ cần chạy 1
  container ứng dụng, không cần container Nginx riêng cho static file (dù vẫn khuyến nghị đặt Nginx
  PHÍA TRƯỚC làm reverse proxy + HTTPS, xem Mục 3).
- **1 container MySQL 8** riêng, dữ liệu lưu ở Docker volume (`db_data`) để không mất khi container
  bị xóa/tạo lại.
- **1 Docker volume riêng cho `server/uploads`** (`server_uploads`) — file báo cáo PDF/DOC sinh viên
  nộp lên phải sống sót qua các lần deploy lại (rebuild image KHÔNG được xóa file người dùng đã tải).

## 2. Chạy bằng Docker Compose

### 2.1. Chuẩn bị

```bash
cp .env.production.example .env.production
# Sửa .env.production: ĐẶC BIỆT là DB_PASSWORD, JWT_SECRET (>= 32 ký tự ngẫu nhiên), CLIENT_URL
# (domain thật sẽ dùng), ADMIN_EMAIL/ADMIN_PASSWORD (tài khoản Admin đầu tiên, xem Mục 2.2 bước 2).
# Sinh JWT_SECRET nhanh:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`.env.production` đã được gitignore — KHÔNG commit file này (chứa mật khẩu/secret thật).

### 2.2. Build + chạy

> **⚠️ KHÔNG dùng seed.sql trên production.** `docker-compose.yml` chỉ mount `server/db/schema.sql`
> (DDL thuần) vào `/docker-entrypoint-initdb.d` — DB mới tạo sẽ KHÔNG có 3 tài khoản demo/dữ liệu
> mẫu nào. Phải tự tạo Admin đầu tiên qua bước 2 dưới đây.

1. **Khởi động:**
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
   MySQL container tự khởi tạo database từ `server/db/schema.sql` — CHỈ chạy đúng 1 lần khi volume
   `db_data` còn rỗng. Nếu cần làm lại từ đầu, phải xóa volume:
   `docker compose --env-file .env.production down -v` (⚠️ **xóa toàn bộ dữ liệu**, chỉ dùng khi
   chắc chắn muốn làm mới hoàn toàn, không dùng trên dữ liệu production thật đang có người dùng).
2. **Bootstrap — chạy ĐÚNG 1 LẦN ngay sau lần `up` đầu tiên** (schema.sql không có dữ liệu, kể cả
   dòng `settings` mặc định mà nhiều tính năng cần có mới chạy được):
   ```bash
   docker compose exec app npm run admin:create
   ```
   `server/scripts/createAdmin.js` làm 3 việc trong 1 lần chạy: tạo dòng `settings` mặc định (id=1),
   baseline `schema_migrations` (để `db:migrate` sau này không chạy lại các migration mà
   `schema.sql` hiện tại đã gộp sẵn), và tạo tài khoản Admin đầu tiên từ `ADMIN_EMAIL`/
   `ADMIN_PASSWORD`/`ADMIN_FULL_NAME` trong `.env.production` (`must_change_password=1` — bắt đổi
   mật khẩu ngay lần đăng nhập đầu). An toàn chạy lại nhiều lần (idempotent) nếu cần tạo thêm Admin
   khác (đổi `ADMIN_EMAIL` trước khi chạy lại).
- App chạy ở cổng `5000` (map ra host qua `ports: 5000:5000` trong `docker-compose.yml`) — phía
  trước nên đặt Nginx (xem Mục 3), không expose thẳng cổng 5000 ra Internet.
- Xem log: `npm run docker:logs` (alias của `docker compose --env-file .env.production logs -f app`).
- Tắt: `npm run docker:down`.

### 2.3. Kiểm tra sau khi chạy

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/db
curl http://localhost:5000/           # phải trả về HTML của SPA (client/dist/index.html)
```

### 2.4. Đã verify thật trên máy này (không qua Docker — xem lưu ý minh bạch ở đầu tài liệu)

Do môi trường phát triển không có Docker, các bước 2.1–2.3 **chưa chạy được bằng `docker compose`
thật**. Đã verify tương đương bằng bản production LOCAL (không container): build client KHÔNG có
`client/.env` (để xác nhận đúng mặc định `'/api'` của `apiClient.js`, không phải giá trị dev override
trong `client/.env`), rồi chạy `NODE_ENV=production node server.js` với `JWT_SECRET` đủ dài,
`CLIENT_URL=http://localhost:5000`:

| Kiểm tra | Kết quả |
|---|---|
| `GET /` | 200, trả về `index.html` của SPA |
| `GET /admin/students` (F5 route con) | 200 HTML — SPA fallback hoạt động, không bị 404 |
| `GET /api/health` | 200 JSON như cũ |
| `GET /api/khong-ton-tai` (route API không khớp) | 404 JSON như cũ — fallback KHÔNG "ăn" nhầm request API |
| `POST /api/auth/login` (admin@example.com) | 200, đăng nhập thành công |
| Build output (`client/dist/assets/*.js`) | chứa `/api`, KHÔNG còn `localhost:5000` nào |

Phần CHƯA verify: hành vi thật của `docker-entrypoint-initdb.d` (chỉ mount `schema.sql`, không mount
`seed.sql`), healthcheck `db`, và `docker compose exec app npm run admin:create` chạy TRONG container
— chỉ được review bằng mắt (cú pháp YAML/Dockerfile + đối chiếu file thật trong repo), chưa tự
`docker build`/`docker compose up` để xác nhận end-to-end.

## 3. Triển khai lên 1 VPS (Nginx reverse proxy + HTTPS Let's Encrypt)

Giả định: VPS Ubuntu/Debian đã cài Docker + Docker Compose plugin, đã có domain trỏ về IP VPS.

1. Clone repo lên VPS, làm theo Mục 2.1–2.2 (app chạy nội bộ ở `127.0.0.1:5000`, KHÔNG mở ra
   Internet trực tiếp — đổi `ports: "5000:5000"` trong `docker-compose.yml` thành
   `"127.0.0.1:5000:5000"` nếu muốn chắc chắn chỉ Nginx trên CÙNG máy mới gọi được).
2. Cài Nginx trên VPS (ngoài Docker, hoặc 1 container Nginx riêng — ví dụ dưới dùng Nginx cài trực
   tiếp trên host cho đơn giản):
   ```bash
   sudo apt install nginx
   ```
3. Tạo file cấu hình `/etc/nginx/sites-available/internship-management`:
   ```nginx
   server {
       listen 80;
       server_name doi-domain-nay.example.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   `X-Forwarded-For` ở đây chính là lý do `TRUST_PROXY_HOPS=1` trong `.env.production` — Express cần
   biết có ĐÚNG 1 proxy tin cậy (Nginx này) phía trước để đọc đúng IP client thật từ header đó khi
   giới hạn số lần đăng nhập/quên mật khẩu (xem README Mục 16M).
   ```bash
   sudo ln -s /etc/nginx/sites-available/internship-management /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Bật HTTPS bằng Certbot (Let's Encrypt, miễn phí):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d doi-domain-nay.example.com
   ```
   Certbot tự sửa lại file Nginx ở Mục 3 để redirect HTTP → HTTPS và tự gia hạn chứng chỉ (cron/systemd
   timer có sẵn trong package certbot, không cần tự cấu hình thêm).
5. Cập nhật `CLIENT_URL` trong `.env.production` thành đúng `https://doi-domain-nay.example.com`, chạy
   lại `docker compose --env-file .env.production up -d --build` để áp dụng (CORS chỉ cho phép đúng
   origin này — xem README Mục 16M).

## 4. Sao lưu dữ liệu

### 4.1. Database (mysqldump)

```bash
docker compose --env-file .env.production exec db \
  mysqldump -u root -p"$(grep DB_PASSWORD .env.production | cut -d= -f2)" --single-transaction internship_management \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

Khôi phục lại từ file backup:

```bash
docker compose --env-file .env.production exec -T db \
  mysql -u root -p"$(grep DB_PASSWORD .env.production | cut -d= -f2)" internship_management \
  < backup-20260101-000000.sql
```

### 4.2. File báo cáo đã upload (`server_uploads` volume)

```bash
# Sao lưu — nén lại thành 1 file tar.gz trên host
docker run --rm -v internshipmanagement_server_uploads:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/uploads-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

(Tên volume thật có thể có tiền tố khác tùy tên thư mục project — chạy `docker volume ls` để xem tên
chính xác nếu lệnh trên không khớp.)

Khôi phục lại:

```bash
docker run --rm -v internshipmanagement_server_uploads:/data -v "$(pwd)":/backup alpine \
  sh -c "cd /data && tar xzf /backup/uploads-20260101-000000.tar.gz"
```

### 4.3. Khuyến nghị

- Lên lịch chạy Mục 4.1 TỰ ĐỘNG hằng ngày (cron trên VPS gọi đúng lệnh ở trên), lưu bản backup ra
  nơi KHÁC máy chủ (ví dụ object storage ngoài) — backup nằm trên cùng VPS bị mất khi ổ cứng VPS hỏng
  thì vô nghĩa.
- Test thử khôi phục (Mục 4.1/4.2 "khôi phục") ít nhất 1 lần trước khi tin tưởng hoàn toàn vào quy
  trình backup — 1 bản backup chưa bao giờ được test khôi phục không đáng tin.

## 5. Không ảnh hưởng tới cách chạy dev

Toàn bộ nội dung ở trên CHỈ áp dụng cho triển khai production qua Docker — cách chạy dev hiện tại
(`npm run dev` ở `server/` và `client/` riêng, xem README Mục 11/12) giữ nguyên hoàn toàn, không cần
Docker, không cần `.env.production`.
