const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth đã verify trực tiếp qua SQL trước khi viết test (không đoán):
//   internships.id=1  -> student_id=1 (studentA/student@), lecturer_id=1 (lecturerA/lecturer@)
//   internships.id=4  -> student_id=5 (studentB/student2@), lecturer_id=3 (lecturerB/lecturer2@)
//   internship_logs.id=1 (internship_id=1, status='reviewed')
//   internship_logs.id=3 (internship_id=4, status='reviewed')
//   evaluations.id=1  (internship_id=1, evaluator_role='lecturer', is_published=1)
//   evaluations.id=2  (internship_id=4, evaluator_role='lecturer', is_published=0)
const STUDENT_A_OWN_INTERNSHIP_ID = 1
const STUDENT_B_OWN_INTERNSHIP_ID = 4
const STUDENT_B_REVIEWED_LOG_ID = 3
const STUDENT_B_UNPUBLISHED_EVAL_ID = 2

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, [
    'admin', 'studentA', 'studentB', 'lecturerA', 'lecturerB', 'mentorA', 'mentorB',
  ])
})

test.after(async () => {
  await server.close()
})

function ids(list) {
  return new Set(list.map((item) => item.id))
}

test('IDOR: Student A own internship list non-empty, không chứa internship của Student B', async () => {
  const ownA = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.studentA.token })
  assert.equal(ownA.status, 200)
  assert.ok(ownA.body.data.length > 0, 'Student A phải thấy ít nhất 1 hồ sơ của chính mình')
  const aIds = ids(ownA.body.data)
  assert.ok(!aIds.has(STUDENT_B_OWN_INTERNSHIP_ID), 'Student A không được thấy hồ sơ của Student B')

  const ownB = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.studentB.token })
  const bIds = ids(ownB.body.data)
  assert.ok(!bIds.has(STUDENT_A_OWN_INTERNSHIP_ID), 'Student B không được thấy hồ sơ của Student A')

  const intersection = [...aIds].filter((id) => bIds.has(id))
  assert.equal(intersection.length, 0, 'Danh sách internship của 2 Student không được giao nhau')
})

test('IDOR: Student A GET trực tiếp internship của Student B theo ID -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', `/internships/${STUDENT_B_OWN_INTERNSHIP_ID}`, {
    token: tokens.studentA.token,
  })
  assert.equal(res.status, 403)
})

test('IDOR: query-param bypass — Student A gửi ?student_id=<StudentB> vẫn chỉ thấy đúng của mình', async () => {
  const res = await apiRequest(
    server.baseUrl,
    'GET',
    `/internships?student_id=${STUDENT_B_OWN_INTERNSHIP_ID}`,
    { token: tokens.studentA.token },
  )
  assert.equal(res.status, 200)
  const returnedIds = ids(res.body.data)
  assert.ok(!returnedIds.has(STUDENT_B_OWN_INTERNSHIP_ID), 'Query param không được ghi đè scope')
  for (const row of res.body.data) {
    assert.notEqual(row.student_id, 5, 'Mọi hồ sơ trả về phải thuộc đúng Student A, không phải Student B')
  }
})

test('IDOR: Lecturer A/B isolation trên /internships', async () => {
  const ownA = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.lecturerA.token })
  const ownB = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.lecturerB.token })
  assert.ok(ownA.body.data.length > 0 && ownB.body.data.length > 0)
  const aIds = ids(ownA.body.data)
  const bIds = ids(ownB.body.data)
  assert.equal([...aIds].filter((id) => bIds.has(id)).length, 0, 'Internship của 2 Lecturer không được giao nhau')

  const crossAccess = await apiRequest(server.baseUrl, 'GET', `/internships/${STUDENT_B_OWN_INTERNSHIP_ID}`, {
    token: tokens.lecturerA.token,
  })
  assert.equal(crossAccess.status, 403, 'Lecturer A không được xem internship do Lecturer B phụ trách')
})

test('IDOR: Company Mentor A/B isolation trên /internships', async () => {
  const ownA = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.mentorA.token })
  const ownB = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.mentorB.token })
  assert.ok(ownA.body.data.length > 0 && ownB.body.data.length > 0)
  const aIds = ids(ownA.body.data)
  const bIds = ids(ownB.body.data)
  assert.equal([...aIds].filter((id) => bIds.has(id)).length, 0, 'Internship của 2 Mentor không được giao nhau')
})

test('IDOR: Student A không đọc được log của Student B (log đã reviewed)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', `/internship-logs/${STUDENT_B_REVIEWED_LOG_ID}`, {
    token: tokens.studentA.token,
  })
  assert.equal(res.status, 403)
})

test('IDOR: evaluation chưa công bố KHÔNG xuất hiện trong list của chính Student (Student B)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/evaluations', { token: tokens.studentB.token })
  assert.equal(res.status, 200)
  const returnedIds = ids(res.body.data)
  assert.ok(
    !returnedIds.has(STUDENT_B_UNPUBLISHED_EVAL_ID),
    'Student không được thấy đánh giá chưa công bố, kể cả của chính mình',
  )
})

test('IDOR: Student A GET trực tiếp evaluation chưa công bố của Student B -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', `/evaluations/${STUDENT_B_UNPUBLISHED_EVAL_ID}`, {
    token: tokens.studentA.token,
  })
  assert.equal(res.status, 403)
})

test('IDOR: Notifications — Student A không thấy notification của Student B qua query override', async () => {
  const ownA = await apiRequest(server.baseUrl, 'GET', '/notifications', { token: tokens.studentA.token })
  assert.equal(ownA.status, 200)
  for (const n of ownA.body.data) {
    assert.equal(n.user_id, tokens.studentA.user.id, 'Mọi notification trả về phải thuộc đúng user hiện tại')
  }

  const bypassAttempt = await apiRequest(
    server.baseUrl,
    'GET',
    `/notifications?user_id=${tokens.studentB.user.id}`,
    { token: tokens.studentA.token },
  )
  assert.equal(bypassAttempt.status, 200)
  for (const n of bypassAttempt.body.data) {
    assert.equal(n.user_id, tokens.studentA.user.id, 'Query param user_id không được ghi đè identity thật')
  }
})
