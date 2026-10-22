// Test server/db/migrate.js — phát hiện trong đợt kiểm tra "cài đặt từ đầu" trước bảo vệ: chạy
// `db:migrate` trên database MỚI tạo từ schema.sql hiện tại (đã gộp sẵn thay đổi của migrations/
// 001-003) mà CHƯA baseline qua test:setup sẽ crash "Duplicate column name" — không idempotent thật
// như README mô tả. Test này lock lại fix: migrate.js phải tự phát hiện lớp lỗi "đã áp dụng rồi"
// (mã 1060/1061/1826) và ghi nhận tiếp, không throw giữa chừng.
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { pool, dbName } = require('../config/database')
const { runMigrations, listMigrationFiles, getAppliedMigrations } = require('../db/migrate')
const { createConnection } = require('../db/sqlRunner')

test.after(async () => {
  await pool.end()
})

// runMigrations/runSqlFile cần connection multipleStatements:true (file migration có >1 statement:
// USE + ALTER) — KHÔNG dùng pool.getConnection() của app (multipleStatements:false, đúng chủ đích an
// toàn cho request thường), phải tạo connection riêng giống đúng cách migrate.js/testSetup.js tự làm.
async function withMigrationConnection(fn) {
  const connection = await createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  try {
    await connection.query(`USE \`${dbName}\`;`)
    return await fn(connection)
  } finally {
    await connection.end()
  }
}

test('migrate: DB test (đã baseline qua test:setup) -> không còn migration pending', async () => {
  await withMigrationConnection(async (connection) => {
    const applied = await getAppliedMigrations(connection)
    const files = listMigrationFiles()
    for (const file of files) {
      assert.ok(applied.has(file), `${file} phải đã được ghi nhận trong schema_migrations`)
    }
  })
})

test('migrate: gỡ 1 migration khỏi schema_migrations rồi chạy lại -> KHÔNG crash (tự phát hiện "đã áp dụng" qua lỗi duplicate column), ghi nhận lại đúng', async () => {
  await withMigrationConnection(async (connection) => {
    const files = listMigrationFiles()
    const targetFile = files[0] // 001_users_status.sql — cột đã tồn tại sẵn trên DB test (từ schema.sql)

    await connection.execute('DELETE FROM schema_migrations WHERE migration_name = ?', [targetFile])
    const beforeApplied = await getAppliedMigrations(connection)
    assert.ok(!beforeApplied.has(targetFile), 'Setup: phải thực sự gỡ được khỏi schema_migrations')

    // Không throw — đây chính là hành vi bug cũ (trước fix) sẽ làm fail test này.
    const pending = await runMigrations(connection, dbName)
    assert.ok(pending.includes(targetFile), 'Phải coi targetFile là "pending" (vừa gỡ ra) rồi xử lý lại')

    const afterApplied = await getAppliedMigrations(connection)
    assert.ok(afterApplied.has(targetFile), 'Phải tự ghi nhận lại targetFile sau khi phát hiện đã áp dụng')
  })
})
