require('dotenv').config()
const path = require('path')
const { createConnection, runSqlFile } = require('./sqlRunner')
const { resolveDbName } = require('./migrate')

// Reseed database hiện tại (dev hoặc test — theo đúng NODE_ENV, giống migrate.js) từ seed.sql.
// seed.sql tự TRUNCATE rồi INSERT lại toàn bộ bảng dữ liệu nghiệp vụ (không đụng schema) — an toàn
// chạy lại nhiều lần trên cùng DB.
async function main() {
  const dbName = resolveDbName()
  if (!dbName) {
    throw new Error('Thiếu DB_NAME (hoặc DB_NAME_TEST khi NODE_ENV=test) trong .env')
  }

  const connection = await createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  try {
    await connection.query(`USE \`${dbName}\`;`)
    await runSqlFile(connection, path.join(__dirname, 'seed.sql'), dbName)
    console.log(`[seed] Đã reseed database "${dbName}" từ seed.sql.`)
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error('[seed] Lỗi:', err.message)
  process.exitCode = 1
})
