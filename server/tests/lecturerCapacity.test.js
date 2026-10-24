const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens
let lecturer
let originalMaxStudents
const createdInternshipIds = []

// Ground truth: students.id=12 và students.id=14 KHÔNG có internship nào trong seed (an toàn tạo
// fixture tạm ở period_id=3 — period chưa dùng bởi bất kỳ internship nào trong seed, xem seed.sql).
// lecturers.id=1 (Trần Quốc Bảo) đã có internship trong period_id=2 — dùng lecturers.id=9 (Ngô Văn
// Phúc, không có internship nào trong seed) để test giới hạn max_students không bị nhiễu bởi dữ liệu
// đã gán từ trước.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin'])

  const getLecturer = await apiRequest(server.baseUrl, 'GET', '/lecturers/9', { token: tokens.admin.token })
  lecturer = getLecturer.body.data
  originalMaxStudents = lecturer.max_students

  await pool.query(
    "INSERT INTO internships (student_id, period_id, status, progress) VALUES (12, 3, 'pending', 0), (14, 3, 'pending', 0)",
  )
  const [rows] = await pool.query(
    "SELECT id, student_id FROM internships WHERE period_id = 3 AND student_id IN (12, 14) ORDER BY student_id",
  )
  createdInternshipIds.push(...rows.map((row) => row.id))
})

test.after(async () => {
  await apiRequest(server.baseUrl, 'PUT', '/lecturers/9', {
    token: tokens.admin.token,
    body: { ...lecturer, max_students: originalMaxStudents },
  })
  if (createdInternshipIds.length > 0) {
    await pool.query(`DELETE FROM internships WHERE id IN (${createdInternshipIds.map(() => '?').join(',')})`, createdInternshipIds)
  }
  await server.close()
})

test('Giới hạn lecturers.max_students: đặt = 1, gán internship thứ 2 trong CÙNG đợt -> 409', async () => {
  const setLimit = await apiRequest(server.baseUrl, 'PUT', '/lecturers/9', {
    token: tokens.admin.token,
    body: { ...lecturer, max_students: 1 },
  })
  assert.equal(setLimit.status, 200)
  assert.equal(setLimit.body.data.max_students, 1)

  const assignFirst = await apiRequest(server.baseUrl, 'PUT', `/internships/${createdInternshipIds[0]}`, {
    token: tokens.admin.token,
    body: { lecturer_id: 9 },
  })
  assert.equal(assignFirst.status, 200, 'Giảng viên đang hướng dẫn 0/1 -> gán được')

  const assignSecond = await apiRequest(server.baseUrl, 'PUT', `/internships/${createdInternshipIds[1]}`, {
    token: tokens.admin.token,
    body: { lecturer_id: 9 },
  })
  assert.equal(assignSecond.status, 409, 'Giảng viên đã đủ 1/1 -> không gán được internship thứ 2')
  assert.match(assignSecond.body.message, /1\/1/)
})

test('Giữ nguyên lecturer_id cũ (re-assign chính nó) không bị đếm 2 lần (ignoreInternshipId)', async () => {
  // internship đầu đã gán lecturer_id=9 ở test trước — gửi lại ĐÚNG lecturer_id đó (đổi field khác,
  // vd progress) không được báo 409 dù max_students=1 (không tự đếm chính mình là "internship khác").
  const res = await apiRequest(server.baseUrl, 'PUT', `/internships/${createdInternshipIds[0]}`, {
    token: tokens.admin.token,
    body: { lecturer_id: 9, progress: 5 },
  })
  assert.equal(res.status, 200)
})
