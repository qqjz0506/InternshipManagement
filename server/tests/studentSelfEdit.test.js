const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp trước khi viết test (Phase 7C):
//   students.id=1 (Student A) -> phone='0901234567' hiện tại.
//   students.id=5 (Student B) -> hồ sơ của người khác, dùng để test IDOR trên PUT /students/:id.
// STUDENT_SELF_EDITABLE_FIELDS thật (server/services/studentService.js):
//   ['email', 'phone', 'address', 'gender', 'date_of_birth']

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['studentA'])
})

test.after(async () => {
  await server.close()
})

test('Students: Student tự sửa field liên hệ của chính mình (phone) -> 200, khôi phục lại giá trị cũ', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/students/1', { token: tokens.studentA.token })
  assert.equal(before.status, 200)
  const originalPhone = before.body.data.phone

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
      token: tokens.studentA.token,
      body: { phone: '0909999999' },
    })
    assert.equal(update.status, 200)
    assert.equal(update.body.data.phone, '0909999999')
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
      token: tokens.studentA.token,
      body: { phone: originalPhone },
    })
    assert.equal(restore.status, 200)
    assert.equal(restore.body.data.phone, originalPhone, 'Phải khôi phục đúng phone gốc')
  }
})

test('Students: Student gửi field ngoài whitelist (full_name) -> 403, không ghi DB', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
    token: tokens.studentA.token,
    body: { full_name: 'Tên giả mạo' },
  })
  assert.equal(res.status, 403)

  const check = await apiRequest(server.baseUrl, 'GET', '/students/1', { token: tokens.studentA.token })
  assert.notEqual(check.body.data.full_name, 'Tên giả mạo')
})

test('Students: Student A không sửa được hồ sơ của Student B (403, không bypass bằng URL)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/students/5', {
    token: tokens.studentA.token,
    body: { phone: '0900000000' },
  })
  assert.equal(res.status, 403)
})
