const fs = require('fs')
const mysql = require('mysql2/promise')

// schema.sql/seed.sql/migrations/*.sql đều hardcode `CREATE DATABASE IF NOT EXISTS
// internship_management` / `USE internship_management;` (viết cho con người chạy tay qua
// `mysql ... < file.sql`). Để tái dùng NGUYÊN VẸN các file này cho cả DB dev và DB test (không phải
// duy trì 2 bản SQL song song), thay thế tên DB gốc bằng tên DB đích trước khi thực thi. Word-boundary
// (\b) để không khớp nhầm "internships"/"internship_logs" (tên bảng khác, không phải tiền tố của
// "internship_management").
const SOURCE_DB_NAME = 'internship_management'

function rewriteDbName(sql, targetDbName) {
  if (!targetDbName || targetDbName === SOURCE_DB_NAME) {
    return sql
  }
  return sql.replace(new RegExp(`\\b${SOURCE_DB_NAME}\\b`, 'g'), targetDbName)
}

async function runSqlFile(connection, filePath, targetDbName) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const sql = rewriteDbName(raw, targetDbName)
  await connection.query(sql)
}

// multipleStatements: true — CHỈ dùng cho các script quản trị DB chạy 1 lần (migrate/seed/test:setup),
// KHÔNG áp dụng cho `config/database.js` (pool chính của app, giữ nguyên an toàn — mỗi request 1
// statement, không mở khả năng multi-statement injection).
async function createConnection({ host, port, user, password }) {
  return mysql.createConnection({
    host,
    port: Number(port),
    user,
    password,
    charset: 'utf8mb4',
    multipleStatements: true,
  })
}

module.exports = { SOURCE_DB_NAME, rewriteDbName, runSqlFile, createConnection }
