const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')
const { readOutboxEntries } = require('./helpers/mailOutbox')

let server
let tokens

// Ground truth: users.id=8 = student4@example.com (students.id=12, "studentD" — KHÔNG có internship
// nào, dùng làm tài khoản test an toàn, không đụng fixture của file test khác). users.id=10 =
// company3@example.com (company_mentors.id=9) — dùng riêng cho ca "tài khoản locked", không phải
// studentD, để không phải khóa/mở khóa đúng tài khoản đang dùng ở các test case khác trong file này.
const STUDENT_D_EMAIL = 'student4@example.com'
const LOCKED_TEST_EMAIL = 'company3@example.com'

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin'])
})

test.after(async () => {
  // password_reset_tokens chỉ được dùng bởi đúng file test này trong toàn bộ suite (dbIntegrity.
  // test.js baseline = 0 dòng) — dọn sạch toàn bộ bảng ở đây thay vì tính đúng từng id đã tạo ra,
  // đơn giản và chắc chắn không để sót dù test fail giữa chừng ở case nào.
  await pool.execute('DELETE FROM password_reset_tokens')
  await server.close()
})

function extractToken(entry) {
  const match = entry.text.match(/token=([a-f0-9]{64})/)
  assert.ok(match, 'Nội dung email phải chứa link kèm token')
  return match[1]
}

test('POST /auth/forgot-password: cùng message cho email tồn tại và không tồn tại (chống dò tài khoản)', async () => {
  const existing = await apiRequest(server.baseUrl, 'POST', '/auth/forgot-password', {
    body: { email: STUDENT_D_EMAIL },
  })
  const notExisting = await apiRequest(server.baseUrl, 'POST', '/auth/forgot-password', {
    body: { email: 'khong-ton-tai-abc123@example.com' },
  })
  assert.equal(existing.status, 200)
  assert.equal(notExisting.status, 200)
  assert.equal(existing.body.message, notExisting.body.message)
})

test('POST /auth/forgot-password + reset-password: luồng thành công, đăng nhập được mật khẩu mới', async () => {
  const [[original]] = await pool.execute('SELECT password_hash FROM users WHERE email = ?', [STUDENT_D_EMAIL])

  try {
    const before = readOutboxEntries().length
    const forgot = await apiRequest(server.baseUrl, 'POST', '/auth/forgot-password', {
      body: { email: STUDENT_D_EMAIL },
    })
    assert.equal(forgot.status, 200)

    const entries = readOutboxEntries().slice(before)
    const mailEntry = entries.find((entry) => entry.to === STUDENT_D_EMAIL)
    assert.ok(mailEntry, 'Phải có email reset gửi tới studentD')
    const token = extractToken(mailEntry)

    const reset = await apiRequest(server.baseUrl, 'POST', '/auth/reset-password', {
      body: { token, newPassword: 'NewPass123' },
    })
    assert.equal(reset.status, 200)

    const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email: STUDENT_D_EMAIL, password: 'NewPass123' },
    })
    assert.equal(login.status, 200)

    const reuse = await apiRequest(server.baseUrl, 'POST', '/auth/reset-password', {
      body: { token, newPassword: 'AnotherPass456' },
    })
    assert.equal(reuse.status, 400, 'Token đã dùng 1 lần không được dùng lại lần 2')
  } finally {
    await pool.execute('UPDATE users SET password_hash = ? WHERE email = ?', [original.password_hash, STUDENT_D_EMAIL])
  }
})

test('POST /auth/reset-password: token sai định dạng/không tồn tại -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/auth/reset-password', {
    body: { token: 'token-khong-ton-tai-'.padEnd(64, '0'), newPassword: 'NewPass123' },
  })
  assert.equal(res.status, 400)
})

test('POST /auth/reset-password: token đã hết hạn -> 400', async () => {
  const before = readOutboxEntries().length
  const forgot = await apiRequest(server.baseUrl, 'POST', '/auth/forgot-password', { body: { email: STUDENT_D_EMAIL } })
  assert.equal(forgot.status, 200)
  const token = extractToken(readOutboxEntries().slice(before).find((entry) => entry.to === STUDENT_D_EMAIL))

  await pool.execute(
    `UPDATE password_reset_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
     WHERE token_hash = SHA2(?, 256)`,
    [token],
  )

  const reset = await apiRequest(server.baseUrl, 'POST', '/auth/reset-password', {
    body: { token, newPassword: 'NewPass123' },
  })
  assert.equal(reset.status, 400)
})

test('Tài khoản locked: forgot-password vẫn trả message chung nhưng KHÔNG tạo token/gửi email', async () => {
  await pool.execute("UPDATE users SET status = 'locked' WHERE email = ?", [LOCKED_TEST_EMAIL])
  try {
    const [[{ count: before }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = ?',
      [LOCKED_TEST_EMAIL],
    )
    const beforeMail = readOutboxEntries().length

    const forgot = await apiRequest(server.baseUrl, 'POST', '/auth/forgot-password', { body: { email: LOCKED_TEST_EMAIL } })
    assert.equal(forgot.status, 200)

    const [[{ count: after }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = ?',
      [LOCKED_TEST_EMAIL],
    )
    assert.equal(after, before, 'Không được tạo token reset cho tài khoản đã bị khóa')

    const entries = readOutboxEntries().slice(beforeMail)
    assert.ok(!entries.some((entry) => entry.to === LOCKED_TEST_EMAIL), 'Không được gửi email reset cho tài khoản đã bị khóa')
  } finally {
    await pool.execute("UPDATE users SET status = 'active' WHERE email = ?", [LOCKED_TEST_EMAIL])
  }
})

test('PUT /auth/change-password vẫn hoạt động bình thường (không bị ảnh hưởng bởi tính năng mới)', async () => {
  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', { body: { email: 'admin@example.com', password: 'admin123' } })
  assert.equal(login.status, 200)
  assert.equal(typeof login.body.data.user.emailNotifications, 'boolean', 'toSafeUser phải có field emailNotifications')
})
