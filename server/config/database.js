const mysql = require('mysql2/promise')

// Database test riêng (DB_NAME_TEST) khi NODE_ENV=test — tách khỏi DB dev đang dùng để code/demo thủ
// công (trước đây test suite chạy thẳng trên DB dev, rủi ro: ai đó debug tay đúng lúc `npm test` chạy
// sẽ bị dọn/ghi đè dữ liệu đang xem). Fallback về DB_NAME nếu DB_NAME_TEST chưa khai trong .env (máy
// chưa cập nhật .env mới vẫn chạy được như cũ, không bị phá).
const dbName = process.env.NODE_ENV === 'test' && process.env.DB_NAME_TEST ? process.env.DB_NAME_TEST : process.env.DB_NAME

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: dbName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
})

async function testConnection() {
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}

module.exports = { pool, testConnection, dbName }
