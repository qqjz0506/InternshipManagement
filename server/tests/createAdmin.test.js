// Test server/scripts/createAdmin.js — bootstrap production KHÔNG dùng seed.sql (xem
// docs/TRIEN_KHAI.md). Gọi trực tiếp các hàm export (không qua CLI/process.env) để test với giá trị
// giả, không phụ thuộc ADMIN_EMAIL/ADMIN_PASSWORD thật nào.
const test = require('node:test')
const assert = require('node:assert/strict')
const { pool } = require('./helpers/db')
const { ensureDefaultSettings, createAdminUser, bootstrapProduction } = require('../scripts/createAdmin')
const { createConnection } = require('../db/sqlRunner')
const { dbName } = require('../config/database')

const createdEmails = []

test.after(async () => {
  if (createdEmails.length > 0) {
    await pool.query(`DELETE FROM users WHERE email IN (${createdEmails.map(() => '?').join(',')})`, createdEmails)
  }
  await pool.end()
})

async function withConnection(fn) {
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

test('ensureDefaultSettings: DB test (seed đã có settings id=1) -> idempotent, không đổi dữ liệu hiện có', async () => {
  await withConnection(async (connection) => {
    const [[before]] = await connection.execute('SELECT * FROM settings WHERE id = 1')
    assert.ok(before, 'Setup: DB test phải đã có settings id=1 (từ seed.sql)')

    await ensureDefaultSettings(connection)
    await ensureDefaultSettings(connection) // gọi 2 lần — phải không throw, không đổi gì

    const [[after]] = await connection.execute('SELECT * FROM settings WHERE id = 1')
    assert.deepEqual(after, before, 'ON DUPLICATE KEY UPDATE id = id -> không ghi đè settings đã có')
  })
})

test('createAdminUser: email/password hợp lệ -> tạo user role=admin, must_change_password=1', async () => {
  await withConnection(async (connection) => {
    const email = `admin-test-${Date.now()}@example.com`
    createdEmails.push(email)

    const userId = await createAdminUser(connection, { email, password: 'MatKhauManh123', fullName: 'Admin Test' })
    assert.ok(userId > 0)

    const [[user]] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId])
    assert.equal(user.role, 'admin')
    assert.equal(user.must_change_password, 1)
    assert.equal(user.full_name, 'Admin Test')
    assert.notEqual(user.password_hash, 'MatKhauManh123')
  })
})

test('createAdminUser: ADMIN_EMAIL không hợp lệ -> throw, không tạo user', async () => {
  await withConnection(async (connection) => {
    await assert.rejects(
      () => createAdminUser(connection, { email: 'khong-hop-le', password: 'MatKhauManh123' }),
      /không hợp lệ/,
    )
  })
})

test('createAdminUser: ADMIN_PASSWORD yếu -> throw, không tạo user', async () => {
  await withConnection(async (connection) => {
    const email = `admin-weakpw-${Date.now()}@example.com`
    await assert.rejects(
      () => createAdminUser(connection, { email, password: '123' }),
      /tối thiểu 8 ký tự/,
    )
    const [rows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email])
    assert.equal(rows.length, 0)
  })
})

test('createAdminUser: email đã tồn tại -> throw, không tạo thêm user trùng', async () => {
  await withConnection(async (connection) => {
    const email = `admin-dup-${Date.now()}@example.com`
    createdEmails.push(email)
    await createAdminUser(connection, { email, password: 'MatKhauManh123' })

    await assert.rejects(
      () => createAdminUser(connection, { email, password: 'MatKhauManh456' }),
      /đã có tài khoản/,
    )

    const [rows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email])
    assert.equal(rows.length, 1, 'Chỉ đúng 1 user với email này, không tạo trùng')
  })
})

test('bootstrapProduction: end-to-end (settings + baseline migrations + tạo admin) -> không throw, admin tạo đúng', async () => {
  const email = `admin-bootstrap-${Date.now()}@example.com`
  createdEmails.push(email)

  const userId = await bootstrapProduction({ email, password: 'MatKhauManh123', fullName: 'Bootstrap Admin' })
  assert.ok(userId > 0)

  await withConnection(async (connection) => {
    const [[user]] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId])
    assert.equal(user.role, 'admin')
    assert.equal(user.email, email)
  })
})
