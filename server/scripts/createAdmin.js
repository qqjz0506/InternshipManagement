// Bootstrap production KHÔNG dùng seed.sql (xem docs/TRIEN_KHAI.md) — docker-compose chỉ mount
// schema.sql (DDL thuần, không dữ liệu demo), nên trước khi hệ thống dùng được thật cần đúng 1 lần:
//   1) đảm bảo có dòng settings mặc định (id=1) — nhiều service đọc settings.lecturer_weight/
//      allow_student_registration KHÔNG qua optional chaining (ví dụ evaluationService,
//      internshipService) nên bảng rỗng sẽ crash ngay khi có hoạt động thật đầu tiên.
//   2) baseline schema_migrations — schema.sql hiện tại đã gộp sẵn toàn bộ các migration trong
//      server/db/migrations/, tái dùng ĐÚNG logic đã test ở server/db/migrate.js (runMigrations
//      baselineOnly) để lần `db:migrate` sau không chạy lại và lỗi "column already exists".
//   3) tạo tài khoản Admin đầu tiên từ ADMIN_EMAIL/ADMIN_PASSWORD (KHÔNG hardcode tài khoản demo).
// Idempotent — chạy lại nhiều lần an toàn (settings/migrations là no-op nếu đã có, admin thứ 2 chỉ
// cần đổi ADMIN_EMAIL). CHỈ dùng cho DB vừa tạo từ schema.sql HIỆN TẠI (như testSetup.js tự baseline
// ngay sau khi áp schema.sql) — không chạy trên DB cũ đã có dữ liệu/migration áp dụng dở dang, sẽ
// baseline sai các migration thực ra chưa chạy DDL.
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { createConnection } = require('../db/sqlRunner')
const { resolveDbName, ensureMigrationsTable, runMigrations } = require('../db/migrate')
const { isValidEmail, isStrongPassword } = require('../utils/validators')

const BCRYPT_COST = 10
const DEFAULT_SYSTEM_NAME = 'Hệ thống quản lý thực tập tốt nghiệp'

async function ensureDefaultSettings(connection) {
  await connection.execute(
    `INSERT INTO settings (id, system_name, allow_student_registration)
     VALUES (1, ?, 1)
     ON DUPLICATE KEY UPDATE id = id`,
    [DEFAULT_SYSTEM_NAME],
  )
}

async function createAdminUser(connection, { email, password, fullName }) {
  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL không hợp lệ.')
  }
  if (!isStrongPassword(password)) {
    throw new Error('ADMIN_PASSWORD phải tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.')
  }

  const [existingRows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email])
  if (existingRows.length > 0) {
    throw new Error(`Email "${email}" đã có tài khoản — không tạo mới (không ghi đè tài khoản đã tồn tại).`)
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const [result] = await connection.execute(
    "INSERT INTO users (full_name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, 'admin', 1)",
    [fullName || 'Quản trị viên', email, passwordHash],
  )
  return result.insertId
}

// Tham số rõ ràng (không tự đọc process.env bên trong) — để test gọi trực tiếp với giá trị giả,
// cùng nguyên tắc tách "đọc env" (main()) khỏi "logic thuần" đã áp dụng cho productionChecks.js.
async function bootstrapProduction({ email, password, fullName }) {
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
    await ensureDefaultSettings(connection)
    await ensureMigrationsTable(connection)
    await runMigrations(connection, dbName, { baselineOnly: true })
    return await createAdminUser(connection, { email, password, fullName })
  } finally {
    await connection.end()
  }
}

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const fullName = process.env.ADMIN_FULL_NAME

  if (!email || !password) {
    throw new Error('Thiếu ADMIN_EMAIL/ADMIN_PASSWORD trong biến môi trường.')
  }

  const userId = await bootstrapProduction({ email, password, fullName })
  console.log(`[admin:create] Đã tạo tài khoản Admin "${email}" (id=${userId}) — phải đổi mật khẩu khi đăng nhập lần đầu.`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[admin:create] Lỗi:', error.message)
    process.exitCode = 1
  })
}

module.exports = { ensureDefaultSettings, createAdminUser, bootstrapProduction }
