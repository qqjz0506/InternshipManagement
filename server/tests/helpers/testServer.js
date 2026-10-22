// Khởi động app Express THẬT (server/app.js — không mock) trên 1 ephemeral port (listen(0)), để test
// có thể gọi HTTP thật (fetch) đi qua đúng toàn bộ chain requireAuth -> requireRole -> controller ->
// service -> MySQL, không cần chạy riêng `npm run server`. Mỗi file test tự start/stop server của
// riêng mình (node:test chạy mỗi file trong process riêng — không xung đột port giữa các file).
require('dotenv').config()
// Đặt TRƯỚC khi require app.js — loginLimiter (middleware/rateLimiter.js) đọc NODE_ENV mỗi request
// để tự skip trong test (10 lần/15 phút sẽ chặn hầu hết test suite nếu không tắt). Đặt ở đây (thay vì
// qua biến môi trường shell) để không phụ thuộc cách `npm test` được gọi (Bash/PowerShell/CI khác nhau).
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
const app = require('../../app')
const { pool } = require('../../config/database')

async function startTestServer() {
  // Thông báo tự động (notificationService.notify, bổ sung sau Phase "Notifications tự động") là
  // SIDE EFFECT của rất nhiều business action đã có test từ trước (đổi trạng thái internship, nhận
  // xét log/report, công bố evaluation...) — nếu không dọn, mỗi lần `npm test` sẽ để lại hàng chục
  // notification rác, phá baseline COUNT(*) của dbIntegrity.test.js. Thay vì sửa riêng từng file test
  // cũ (rất nhiều điểm chạm), chụp snapshot MAX(id) ở đây và dọn mọi row có id lớn hơn trong close() —
  // áp dụng tự động cho MỌI file test (cũ và mới sau này), không cần sửa gì thêm ở từng file.
  const [[{ maxNotificationId }]] = await pool.query(
    'SELECT COALESCE(MAX(id), 0) AS maxNotificationId FROM notifications',
  )

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        // require('../../app') nạp toàn bộ routes -> controllers -> services -> config/database, tạo
        // pool mysql2 NGAY LÚC REQUIRE dù file test có dùng helpers/db.js hay không — pool giữ kết nối
        // idle sống vĩnh viễn (connectionLimit, không tự đóng), khiến process con của `node --test`
        // không bao giờ tự exit nếu không gọi pool.end(). closeAllConnections() cũng được gọi để
        // không phải chờ các socket keep-alive của fetch tự đóng.
        close: async () => {
          server.closeAllConnections()
          await new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()))
          })
          await pool.execute('DELETE FROM notifications WHERE id > ?', [maxNotificationId])
          await pool.end()
        },
      })
    })
    server.on('error', reject)
  })
}

module.exports = { startTestServer }
