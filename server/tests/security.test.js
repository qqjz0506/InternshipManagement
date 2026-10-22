const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
})

test.after(async () => {
  await server.close()
})

test('Security: SQL injection string trong ?search= không crash và không bypass scope', async () => {
  const injection = "' OR 1=1 --"
  const res = await apiRequest(
    server.baseUrl,
    'GET',
    `/students?search=${encodeURIComponent(injection)}`,
    { token: tokens.admin.token },
  )
  assert.equal(res.status, 200, 'Không được crash (500) với input injection')
  assert.ok(Array.isArray(res.body.data))
  assert.equal(res.body.data.length, 0, 'Chuỗi injection không khớp LIKE thật nào — phải trả rỗng, không phải toàn bộ bảng')
})

test('Security: injection + query-param override cùng lúc (Student) vẫn không crash, không vượt scope', async () => {
  // Kết hợp 2 vector cùng lúc: chuỗi injection trong search VÀ cố ép department_id=999 (không phải
  // scope của Student A) — chuỗi injection chắc chắn không LIKE-match dữ liệu thật nên kết quả sẽ
  // rỗng; điều cần xác nhận là KHÔNG crash (500) và KHÔNG vô tình trả toàn bộ bảng.
  const injection = "x' OR '1'='1"
  const res = await apiRequest(
    server.baseUrl,
    'GET',
    `/students?search=${encodeURIComponent(injection)}&department_id=999`,
    { token: tokens.studentA.token },
  )
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.data))
  assert.ok(res.body.data.length <= 1, 'Không được trả nhiều hơn chính hồ sơ của Student A (tối đa 1 dòng)')
})

test('Security: JWT ký bằng secret SAI (role=admin giả) phải bị từ chối (401)', async () => {
  const forgedToken = jwt.sign({ sub: 1, role: 'admin' }, 'a-completely-wrong-secret-guess', {
    expiresIn: '1d',
  })
  const res = await apiRequest(server.baseUrl, 'GET', '/users', { token: forgedToken })
  assert.equal(res.status, 401, 'Token ký sai secret phải bị reject dù payload claim role=admin')
})

test('Security: token hợp lệ nhưng bị sửa 1 ký tự trong signature -> 401', async () => {
  const tampered = tokens.studentA.token.slice(0, -2) + 'zz'
  const res = await apiRequest(server.baseUrl, 'GET', '/auth/me', { token: tampered })
  assert.equal(res.status, 401)
})

test('Security: login thất bại không bao giờ trả password/password_hash trong body', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'admin@example.com', password: 'wrong' },
  })
  assert.equal(res.status, 401)
  const raw = JSON.stringify(res.body)
  assert.ok(!raw.includes('password_hash'))
  assert.ok(!raw.toLowerCase().includes('"password"'))
})
