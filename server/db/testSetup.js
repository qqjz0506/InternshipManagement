require('dotenv').config()
const path = require('path')
const { createConnection, runSqlFile } = require('./sqlRunner')
const { runMigrations } = require('./migrate')

// Tạo (hoặc tạo lại từ đầu) database test RIÊNG BIỆT khỏi DB dev — luôn đọc DB_NAME_TEST trực tiếp
// (KHÔNG qua resolveDbName()/NODE_ENV) vì mục đích của script này LUÔN LUÔN là chuẩn bị DB test, bất
// kể NODE_ENV đang là gì lúc gọi `npm run test:setup`.
async function main() {
  const dbName = process.env.DB_NAME_TEST
  if (!dbName) {
    throw new Error(
      'Thiếu DB_NAME_TEST trong .env — cần khai tên database test riêng (khác DB_NAME) trước khi chạy test:setup.',
    )
  }
  if (dbName === process.env.DB_NAME) {
    throw new Error(
      'DB_NAME_TEST không được trùng DB_NAME — test:setup sẽ DROP DATABASE này, tránh xóa nhầm DB dev thật.',
    )
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  try {
    console.log(`[test:setup] Xóa và tạo lại database "${dbName}"...`)
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`)

    await runSqlFile(connection, path.join(__dirname, 'schema.sql'), dbName)
    console.log('[test:setup] Đã áp dụng schema.sql.')

    await connection.query(`USE \`${dbName}\`;`)
    await runSqlFile(connection, path.join(__dirname, 'seed.sql'), dbName)
    console.log('[test:setup] Đã áp dụng seed.sql.')

    // schema.sql hiện tại đã gộp sẵn toàn bộ thay đổi của migrations/001-003 (xem comment đầu mỗi
    // file migration) — baseline-mark để lần `db:migrate` sau (nếu có ai nhắm vào DB test) không
    // chạy lại các file này và lỗi "column already exists".
    const baselined = await runMigrations(connection, dbName, { baselineOnly: true })
    console.log(`[test:setup] Đã baseline ${baselined.length} migration (nội dung đã có sẵn trong schema.sql).`)

    console.log(`[test:setup] Database test "${dbName}" đã sẵn sàng.`)
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error('[test:setup] Lỗi:', err.message)
  process.exitCode = 1
})
