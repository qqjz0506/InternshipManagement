const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { rowCount } = require('./helpers/db')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp trước khi viết test (Phase 7C):
//   students.id=12 -> KHÔNG có internship nào (LEFT JOIN internships ra NULL) -> an toàn để Admin
//     tạo hồ sơ thực tập mới cho sinh viên này mà không đụng dữ liệu seed.
//   internship_periods.id=3 (TT2025-1, status='upcoming') -> student_id=12 chưa có hồ sơ trong đợt này.
//   internships.id=1 -> status='in_progress' (KHÔNG 'pending') -> dùng để xác nhận DELETE bị chặn.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
})

test.after(async () => {
  await server.close()
})

test('Internships: DELETE khi status != pending -> 409, không xóa', async () => {
  const before = await rowCount('internships')
  const res = await apiRequest(server.baseUrl, 'DELETE', '/internships/1', { token: tokens.admin.token })
  assert.equal(res.status, 409)
  assert.equal(await rowCount('internships'), before, 'Không được xóa internships.id=1 (đang in_progress)')
})

test('Internships: Student không có quyền DELETE (403 route-level)', async () => {
  const res = await apiRequest(server.baseUrl, 'DELETE', '/internships/3', { token: tokens.studentA.token })
  assert.equal(res.status, 403)
})

test('Internships: Admin tạo hồ sơ thực tập cho sinh viên khác (bypass scope) -> 201 pending, rồi xóa khi còn pending -> 200', async () => {
  const before = await rowCount('internships')

  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 3 },
  })
  assert.equal(create.status, 201)
  assert.equal(create.body.data.student_id, 12)
  assert.equal(create.body.data.period_id, 3)
  assert.equal(create.body.data.status, 'pending')
  assert.equal(await rowCount('internships'), before + 1)

  const createdId = create.body.data.id

  const remove = await apiRequest(server.baseUrl, 'DELETE', `/internships/${createdId}`, {
    token: tokens.admin.token,
  })
  assert.equal(remove.status, 200)
  assert.equal(await rowCount('internships'), before, 'Phải khôi phục đúng số lượng internships ban đầu')
})
