const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens
const createdPositionIds = []

// Ground truth (seed.sql): company_mentors.id=1 (user_id=9, "company2@example.com") -> company_id=1
// (FPT Software). company_mentors.id=7 (user_id=4, "company@example.com") -> company_id=4 (XYZ) —
// CÔNG TY KHÁC, dùng để test IDOR (mentor công ty khác không sửa được vị trí của company_id=1).
// internship_periods.id=3 ('TT2025-1') status='upcoming' — KHÔNG closed, an toàn để test tạo vị trí
// mới không đụng dữ liệu period_id=2 đang dùng ở các test reminders khác.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'mentorA', 'mentorB', 'studentA'])
})

test.after(async () => {
  if (createdPositionIds.length > 0) {
    await pool.query(`DELETE FROM internship_positions WHERE id IN (${createdPositionIds.map(() => '?').join(',')})`, createdPositionIds)
  }
  await server.close()
})

test('Admin tạo vị trí thực tập cho công ty bất kỳ -> 201', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.admin.token,
    body: { company_id: 1, period_id: 3, title: 'Intern Backend', description: 'Node.js', requirements: 'SQL cơ bản', slots: 2 },
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.data.company_id, 1)
  assert.equal(res.body.data.status, 'open')
  createdPositionIds.push(res.body.data.id)
})

test('Company Mentor tạo vị trí KHÔNG gửi company_id -> tự ép company_id của chính mình', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token, // company2@example.com -> company_id=1
    body: { period_id: 3, title: 'Intern QA', slots: 1 },
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.data.company_id, 1)
  createdPositionIds.push(res.body.data.id)
})

test('Company Mentor cố gửi company_id KHÁC công ty mình -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token,
    body: { company_id: 4, period_id: 3, title: 'Intern giả mạo công ty khác', slots: 1 },
  })
  assert.equal(res.status, 403)
})

test('Student không được tạo vị trí thực tập -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.studentA.token,
    body: { company_id: 1, period_id: 3, title: 'Intern SV tự tạo', slots: 1 },
  })
  assert.equal(res.status, 403)
})

test('IDOR: Mentor công ty khác KHÔNG sửa được vị trí của company_id=1', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token,
    body: { period_id: 3, title: 'Intern để test IDOR', slots: 1 },
  })
  assert.equal(create.status, 201)
  createdPositionIds.push(create.body.data.id)

  const update = await apiRequest(server.baseUrl, 'PUT', `/internship-positions/${create.body.data.id}`, {
    token: tokens.mentorA.token, // company@example.com -> company_id=4, KHÁC company_id=1
    body: { title: 'Bị sửa trộm' },
  })
  assert.equal(update.status, 403)
})

test('Student chỉ thấy vị trí "open" của đợt KHÔNG closed', async () => {
  const closedPosition = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.admin.token,
    body: { company_id: 1, period_id: 3, title: 'Intern đã đóng', slots: 1, status: 'closed' },
  })
  assert.equal(closedPosition.status, 201)
  createdPositionIds.push(closedPosition.body.data.id)

  const res = await apiRequest(server.baseUrl, 'GET', '/internship-positions', { token: tokens.studentA.token })
  assert.equal(res.status, 200)
  assert.ok(res.body.data.every((position) => position.status === 'open'), 'Student chỉ thấy vị trí open')
  assert.ok(!res.body.data.some((position) => position.id === closedPosition.body.data.id), 'Không thấy vị trí đã đóng')
})

test('Giảm slots xuống dưới số đã accepted (2 đã nhận, giảm về 1) -> 400', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.admin.token,
    body: { company_id: 1, period_id: 3, title: 'Intern test giảm slots', slots: 2 },
  })
  createdPositionIds.push(create.body.data.id)
  await pool.query(
    "INSERT INTO position_applications (position_id, student_id, status) VALUES (?, 1, 'accepted'), (?, 2, 'accepted')",
    [create.body.data.id, create.body.data.id],
  )
  try {
    const update = await apiRequest(server.baseUrl, 'PUT', `/internship-positions/${create.body.data.id}`, {
      token: tokens.admin.token,
      body: { slots: 1 },
    })
    assert.equal(update.status, 400)
  } finally {
    await pool.execute('DELETE FROM position_applications WHERE position_id = ?', [create.body.data.id])
  }
})
