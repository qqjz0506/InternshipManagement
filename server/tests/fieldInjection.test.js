const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { rowCount } = require('./helpers/db')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'lecturerA'])
})

test.after(async () => {
  await server.close()
})

// Mọi test ở đây gửi field bị cấm -> request phải bị reject TRƯỚC khi chạm DB — verify bằng cách
// các câu lệnh dưới chỉ assert status, không cần cleanup (không có write nào xảy ra nếu đúng hành vi).

test('Field injection: PUT /internships/:id với student_id -> 400, KHÔNG ghi DB', async () => {
  const before = await rowCount('internships')
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.admin.token,
    body: { student_id: 999 },
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('internships'), before)
})

test('Field injection: PUT /internships/:id với period_id -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.admin.token,
    body: { period_id: 999 },
  })
  assert.equal(res.status, 400)
})

test('Field injection: PUT /evaluations/:id với internship_id -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/evaluations/1', {
    token: tokens.admin.token,
    body: { internship_id: 999 },
  })
  assert.equal(res.status, 400)
})

test('Field injection: PUT /evaluations/:id với evaluator_role -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/evaluations/1', {
    token: tokens.admin.token,
    body: { evaluator_role: 'company' },
  })
  assert.equal(res.status, 400)
})

test('Field injection: Lecturer PUT /topics/:id với field ngoài status -> 403, status đi kèm bị từ chối luôn', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/topics/1', {
    token: tokens.lecturerA.token,
    body: { status: 'approved', topic_name: 'Hacked name' },
  })
  assert.equal(res.status, 403)
})

test('Field injection: Lecturer PUT /topics/:id với status ngoài approved/rejected -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/topics/1', {
    token: tokens.lecturerA.token,
    body: { status: 'proposed' },
  })
  assert.equal(res.status, 400)
})
