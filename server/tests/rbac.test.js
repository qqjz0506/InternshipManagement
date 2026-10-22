const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA', 'mentorA'])
})

test.after(async () => {
  await server.close()
})

test('RBAC: GET /users is Admin-only (bắt buộc theo đề bài)', async () => {
  const admin = await apiRequest(server.baseUrl, 'GET', '/users', { token: tokens.admin.token })
  assert.equal(admin.status, 200)

  const student = await apiRequest(server.baseUrl, 'GET', '/users', { token: tokens.studentA.token })
  assert.equal(student.status, 403)

  const lecturer = await apiRequest(server.baseUrl, 'GET', '/users', { token: tokens.lecturerA.token })
  assert.equal(lecturer.status, 403)

  const mentor = await apiRequest(server.baseUrl, 'GET', '/users', { token: tokens.mentorA.token })
  assert.equal(mentor.status, 403)
})

test('RBAC: POST /departments là Admin-only mutation', async () => {
  const student = await apiRequest(server.baseUrl, 'POST', '/departments', {
    token: tokens.studentA.token,
    body: { department_code: 'X1', department_name: 'X' },
  })
  assert.equal(student.status, 403)

  const lecturer = await apiRequest(server.baseUrl, 'POST', '/departments', {
    token: tokens.lecturerA.token,
    body: { department_code: 'X1', department_name: 'X' },
  })
  assert.equal(lecturer.status, 403)
})

test('RBAC: POST /internships cho phép Admin/Student, KHÔNG cho Lecturer/Company Mentor', async () => {
  const mentor = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.mentorA.token,
    body: { student_id: 1, period_id: 1 },
  })
  assert.equal(mentor.status, 403)

  const lecturer = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.lecturerA.token,
    body: { student_id: 1, period_id: 1 },
  })
  assert.equal(lecturer.status, 403)
})

test('RBAC: POST /evaluations KHÔNG cho Student (chỉ admin/lecturer/company_mentor)', async () => {
  const student = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.studentA.token,
    body: { internship_id: 1, evaluator_role: 'lecturer', attitude_score: 8, skill_score: 8, progress_score: 8, discipline_score: 8, overall_score: 8 },
  })
  assert.equal(student.status, 403)
})

test('RBAC: DELETE /topics/:id chỉ Admin', async () => {
  const student = await apiRequest(server.baseUrl, 'DELETE', '/topics/1', { token: tokens.studentA.token })
  assert.equal(student.status, 403)
  const lecturer = await apiRequest(server.baseUrl, 'DELETE', '/topics/1', { token: tokens.lecturerA.token })
  assert.equal(lecturer.status, 403)
})

test('RBAC: no token / invalid token -> 401 trên 1 endpoint đại diện mỗi domain chính', async () => {
  for (const path of ['/users', '/internships', '/evaluations', '/students', '/notifications']) {
    const noToken = await apiRequest(server.baseUrl, 'GET', path, {})
    assert.equal(noToken.status, 401, `${path} không token phải 401`)
    const badToken = await apiRequest(server.baseUrl, 'GET', path, { token: 'garbage.token' })
    assert.equal(badToken.status, 401, `${path} token sai phải 401`)
  }
})
