require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { createConnection, runSqlFile } = require('./sqlRunner')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

// Cùng quy tắc chọn DB với server/config/database.js: NODE_ENV=test + có khai DB_NAME_TEST -> dùng
// DB test riêng, ngược lại dùng DB_NAME (dev) như cũ.
function resolveDbName() {
  if (process.env.NODE_ENV === 'test' && process.env.DB_NAME_TEST) {
    return process.env.DB_NAME_TEST
  }
  return process.env.DB_NAME
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `)
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query('SELECT migration_name FROM schema_migrations')
  return new Set(rows.map((row) => row.migration_name))
}

async function markApplied(connection, fileName) {
  await connection.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', [fileName])
}

// Mã lỗi MySQL/MariaDB khi cột/khóa/constraint ĐÃ TỒN TẠI (đã verify thực tế: cả 3 migration hiện có
// đều trả đúng 1060 khi chạy trên DB đã có sẵn cột đó, vd. tạo mới từ schema.sql hiện tại mà quên
// baseline) — coi là "đã áp dụng rồi" thay vì lỗi thật, giữ cho `db:migrate` THỰC SỰ idempotent như
// mô tả ở README (không chỉ đúng khi luôn baseline qua test:setup). Lỗi KHÁC (sai cú pháp, cột không
// tồn tại để ALTER...) vẫn phải throw — chỉ nuốt đúng lớp lỗi "trùng, vô hại" này.
const ALREADY_APPLIED_ERRNOS = new Set([
  1060, // ER_DUP_FIELDNAME — Duplicate column name
  1061, // ER_DUP_KEYNAME — Duplicate key name
  1826, // ER_DUP_CONSTRAINT_NAME (MySQL 8) — Duplicate check constraint name
])

// baselineOnly=true: ghi nhận các migration còn thiếu là "đã áp dụng" mà KHÔNG chạy nội dung file —
// dùng ngay sau khi tạo DB mới từ schema.sql (schema.sql hiện tại đã gộp sẵn toàn bộ thay đổi của
// các migration cũ), để lần chạy `db:migrate` sau đó không chạy lại và lỗi "column already exists"
// (xem server/db/testSetup.js). KHÔNG bắt buộc phải baseline trước — nếu quên, runSqlFile ở dưới vẫn
// tự phát hiện "đã áp dụng" qua ALREADY_APPLIED_ERRNOS và tự ghi nhận, không crash giữa chừng.
async function runMigrations(connection, dbName, { baselineOnly = false } = {}) {
  await ensureMigrationsTable(connection)
  const applied = await getAppliedMigrations(connection)
  const files = listMigrationFiles()
  const pending = files.filter((file) => !applied.has(file))

  for (const file of pending) {
    if (baselineOnly) {
      console.log(`[migrate] Baseline (không chạy, chỉ ghi nhận đã áp dụng): ${file}`)
    } else {
      console.log(`[migrate] Đang áp dụng: ${file}`)
      try {
        await runSqlFile(connection, path.join(MIGRATIONS_DIR, file), dbName)
        console.log(`[migrate] Hoàn tất: ${file}`)
      } catch (err) {
        if (!ALREADY_APPLIED_ERRNOS.has(err.errno)) {
          throw err
        }
        console.log(`[migrate] Bỏ qua (đã áp dụng từ trước, phát hiện qua lỗi "${err.message}"): ${file}`)
      }
    }
    await markApplied(connection, file)
  }

  return pending
}

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
    const pending = await runMigrations(connection, dbName)
    if (pending.length === 0) {
      console.log(`[migrate] Database "${dbName}" đã cập nhật đầy đủ — không có migration mới.`)
    } else {
      console.log(`[migrate] Database "${dbName}" đã áp dụng ${pending.length} migration mới: ${pending.join(', ')}`)
    }
  } finally {
    await connection.end()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[migrate] Lỗi:', err.message)
    process.exitCode = 1
  })
}

module.exports = {
  resolveDbName,
  listMigrationFiles,
  ensureMigrationsTable,
  getAppliedMigrations,
  markApplied,
  runMigrations,
  MIGRATIONS_DIR,
}
