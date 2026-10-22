const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth: internships.id=1 (period_id=2, log_frequency_days=7 mặc định, KHÔNG set deadline) —
// internship_logs của hồ sơ này log_date mới nhất '2025-03-10' (xem seed.sql), nằm trong QUÁ KHỨ XA so
// với bất kỳ thời điểm chạy test thực tế nào (luôn sau 2025-03-17) -> logOverdue LUÔN đúng, không phụ
// thuộc ngày thật lúc chạy test — dùng để assert tồn tại mà không cần mock `now` ở tầng HTTP (mock
// `now` chính xác đã có ở tests/reminderJob.test.js, test này chỉ xác minh SCOPE/SHAPE qua HTTP thật).

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA'])
})

test.after(async () => {
  await server.close()
})

test('GET /reminders/overview — Student: chỉ thấy vấn đề của chính mình, có log_overdue', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/reminders/overview', { token: tokens.studentA.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.role, 'student')
  assert.ok(Array.isArray(res.body.data.items))
  assert.ok(res.body.data.items.some((item) => item.key === 'log_overdue'), 'Student A phải có nhắc việc "chưa ghi nhật ký"')
})

test('GET /reminders/overview — Lecturer: danh sách SV mình phụ trách, đúng mã SV 21110001', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/reminders/overview', { token: tokens.lecturerA.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.role, 'lecturer')
  const entry = res.body.data.items.find((item) => item.studentCode === '21110001')
  assert.ok(entry, 'Lecturer A phải thấy SV 21110001 (internship id=1) trong danh sách cần nhắc')
  assert.ok(entry.issues.some((issue) => issue.key === 'log_overdue'))
})

test('GET /reminders/overview — Admin: tổng hợp theo đợt, period_id=2 có logOverdueCount >= 1', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/reminders/overview', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.role, 'admin')
  const period2 = res.body.data.items.find((item) => item.periodId === 2)
  assert.ok(period2, 'Phải có bucket tổng hợp cho period_id=2')
  assert.ok(period2.logOverdueCount >= 1)
})

test('GET /reminders/overview — thiếu token -> 401', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/reminders/overview', {})
  assert.equal(res.status, 401)
})
