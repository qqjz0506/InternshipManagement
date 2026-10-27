// Test escape HTML trong email tự động (notificationService.sendNotificationEmail) — tiêu đề vị
// trí thực tập do Company Mentor tự đặt (KHÔNG sanitize ở backend, xem internshipPositionService)
// chèn thẳng vào content của notify() -> nếu không escape, 1 Mentor có thể chèn HTML/script vào
// email gửi cho Admin/Mentor khác (XSS trong mail client).
const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { readOutboxEntries } = require('./helpers/mailOutbox')
const { pool } = require('./helpers/db')

let server
let tokens
let positionId

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'mentorB', 'studentD'])
})

test.after(async () => {
  if (positionId) {
    await pool.execute('DELETE FROM position_applications WHERE position_id = ?', [positionId])
    await pool.execute('DELETE FROM internship_positions WHERE id = ?', [positionId])
  }
  await server.close()
})

test('Tiêu đề vị trí chứa HTML -> email outbox phải escape, KHÔNG chứa thẻ HTML sống', async () => {
  const maliciousTitle = 'Intern <a href="https://evil.example.com">click</a>'
  const createPosition = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token,
    body: { period_id: 3, title: maliciousTitle, slots: 1 },
  })
  assert.equal(createPosition.status, 201)
  positionId = createPosition.body.data.id

  const before = readOutboxEntries().length
  const apply = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: tokens.studentD.token,
    body: { position_id: positionId },
  })
  assert.equal(apply.status, 201)

  const entries = readOutboxEntries().slice(before)
  const adminEntry = entries.find((entry) => entry.to === 'admin@example.com')
  assert.ok(adminEntry, 'Phải có email mới gửi tới Admin (notifyCompanyMentorsAndAdmins)')

  assert.ok(
    !adminEntry.html.includes('<a href="https://evil.example.com">'),
    'HTML KHÔNG được chứa thẻ <a> sống từ tiêu đề do Mentor tự đặt',
  )
  assert.ok(
    adminEntry.html.includes('&lt;a href=&quot;https://evil.example.com&quot;&gt;'),
    'Thẻ <a> phải được escape thành &lt;a ...&gt; trong HTML',
  )
  // text (plain) không cần escape — vẫn phải giữ nguyên nội dung gốc để đọc được link gốc nếu cần.
  assert.ok(adminEntry.text.includes(maliciousTitle))

  await pool.execute('DELETE FROM position_applications WHERE position_id = ?', [positionId])
})
