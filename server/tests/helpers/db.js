require('dotenv').config()
const { pool, dbName: DB_NAME } = require('../../config/database')

// schema_migrations (server/db/migrate.js) là bảng HẠ TẦNG quản lý migration, không phải 1 trong 14
// bảng nghiệp vụ mà docs/DATABASE_DESIGN.md mô tả — loại trừ khỏi count để baseline "14 bảng/19 FK"
// không đổi dù DB (dev hoặc test) có bảng này hay không.
async function tableCount() {
  const [[row]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME != 'schema_migrations'",
    [DB_NAME],
  )
  return row.count
}

async function foreignKeyCount() {
  const [[row]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME != 'schema_migrations'",
    [DB_NAME],
  )
  return row.count
}

async function rowCount(table) {
  const [[row]] = await pool.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
  return row.count
}

module.exports = { pool, tableCount, foreignKeyCount, rowCount }
