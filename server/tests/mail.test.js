const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { readOutboxEntries } = require('./helpers/mailOutbox')

let server
let tokens

// Ground truth: students.id=12 (user_id=8, login student4@example.com="studentD") KHÔNG có
// internship nào trong seed — tự đăng ký (POST /internships {period_id}) kích hoạt
// internshipService.create() -> notificationService.notify({userId: adminId, ...}) cho MỌI admin
// (users.id=1 là admin seed duy nhất) — đúng side effect dùng để test notify()->email ở đây.
// period_id=2 ('TT2024-2') là đợt 'ongoing' (không bị closed) — xem server/db/seed.sql.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentD'])
})

test.after(async () => {
  await server.close()
})

async function registerAndCleanup(run) {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.studentD.token,
    body: { period_id: 2 },
  })
  assert.equal(create.status, 201)
  try {
    await run(create.body.data)
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/internships/${create.body.data.id}`, {
      token: tokens.admin.token,
    })
    assert.equal(cleanup.status, 200)
  }
}

test('notify() gửi email tới Admin khi Sinh viên tự đăng ký (email_notifications=1 mặc định)', async () => {
  const before = readOutboxEntries().length

  await registerAndCleanup(async (internship) => {
    const entries = readOutboxEntries().slice(before)
    const adminEntry = entries.find((entry) => entry.to === 'admin@example.com')
    assert.ok(adminEntry, 'Phải có 1 email mới gửi tới admin@example.com')
    assert.match(adminEntry.subject, /chờ duyệt/)
    assert.match(adminEntry.text, new RegExp(`#${internship.id}`))
    assert.match(adminEntry.html, /href="/)
  })
})

test('Tắt email_notifications -> không gửi email, nhưng notification vẫn được tạo trong DB', async () => {
  const toggleOff = await apiRequest(server.baseUrl, 'PUT', '/auth/email-notifications', {
    token: tokens.admin.token,
    body: { emailNotifications: false },
  })
  assert.equal(toggleOff.status, 200)
  assert.equal(toggleOff.body.data.emailNotifications, false)

  try {
    const beforeMail = readOutboxEntries().length
    const beforeNotif = await apiRequest(server.baseUrl, 'GET', '/notifications?user_id=1', {
      token: tokens.admin.token,
    })
    const beforeCount = beforeNotif.body.data.length

    await registerAndCleanup(async () => {
      const entries = readOutboxEntries().slice(beforeMail)
      assert.ok(
        !entries.some((entry) => entry.to === 'admin@example.com'),
        'Không được có email mới gửi tới admin@example.com khi đã tắt email_notifications',
      )

      const afterNotif = await apiRequest(server.baseUrl, 'GET', '/notifications?user_id=1', {
        token: tokens.admin.token,
      })
      assert.equal(
        afterNotif.body.data.length,
        beforeCount + 1,
        'Notification vẫn phải được ghi vào DB dù tắt email',
      )
    })
  } finally {
    const toggleOn = await apiRequest(server.baseUrl, 'PUT', '/auth/email-notifications', {
      token: tokens.admin.token,
      body: { emailNotifications: true },
    })
    assert.equal(toggleOn.status, 200)
    assert.equal(toggleOn.body.data.emailNotifications, true)
  }
})

test('PUT /auth/email-notifications: thiếu/sai kiểu field -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/auth/email-notifications', {
    token: tokens.admin.token,
    body: { emailNotifications: 'yes' },
  })
  assert.equal(res.status, 400)
})
