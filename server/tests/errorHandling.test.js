const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')

let server

test.before(async () => {
  server = await startTestServer()
})

test.after(async () => {
  await server.close()
})

function assertNoLeak(body) {
  const raw = JSON.stringify(body)
  assert.ok(!('error' in body) || body.error === undefined, 'response không được có field error khi DEBUG_ERRORS tắt')
  assert.ok(!raw.includes('.js:'), 'response không được chứa đường dẫn file/số dòng (stack trace)')
  assert.ok(!raw.toLowerCase().includes('at object.'), 'response không được chứa dòng stack trace kiểu "at Object..."')
  assert.ok(!raw.includes('InternshipManagement\\\\server'), 'response không được chứa đường dẫn tuyệt đối nội bộ server')
}

test('Error handling: 401 (thiếu token) — giữ đúng status/message, không lộ stack trace (mặc định, không cần set NODE_ENV)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/users', {})
  assert.equal(res.status, 401)
  assert.equal(res.body.success, false)
  assert.ok(typeof res.body.message === 'string' && res.body.message.length > 0)
  assertNoLeak(res.body)
})

test('Error handling: 403 (RBAC) — message nghiệp vụ giữ nguyên, không lộ stack trace', async () => {
  // Dùng 1 token hợp lệ nhưng sai role để trigger AppError 403 thật (không phải lỗi không lường trước).
  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'student@example.com', password: 'student123' },
  })
  const res = await apiRequest(server.baseUrl, 'GET', '/users', { token: login.body.data.accessToken })
  assert.equal(res.status, 403)
  assert.equal(res.body.message, 'Bạn không có quyền thực hiện hành động này.')
  assertNoLeak(res.body)
})

test('Error handling: lỗi KHÔNG lường trước (JSON malformed, không phải AppError) -> message chung, KHÔNG lộ message gốc của parser', async () => {
  const response = await fetch(`${server.baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid json',
  })
  const body = await response.json()
  assert.equal(body.success, false)
  assert.equal(body.message, 'Đã xảy ra lỗi máy chủ.', 'Lỗi không lường trước phải hiện message chung, không lộ message gốc (vd. "Unexpected token...")')
  assertNoLeak(body)
})

test('Error handling: AppError nghiệp vụ (400 validate) vẫn giữ đúng message cụ thể (không bị đổi thành message chung)', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/auth/login', { body: {} })
  assert.equal(res.status, 400)
  assert.equal(res.body.message, 'Vui lòng nhập email.', 'Message nghiệp vụ cụ thể của AppError phải giữ nguyên — frontend đang phụ thuộc đúng các message này')
})

test('Error handling: DEBUG_ERRORS=true (bật tường minh) mới trả kèm stack — xác nhận cờ hoạt động đúng, KHÔNG phải mặc định', async () => {
  process.env.DEBUG_ERRORS = 'true'
  try {
    const res = await apiRequest(server.baseUrl, 'GET', '/users', {})
    assert.equal(res.status, 401)
    assert.ok(typeof res.body.error === 'string' && res.body.error.length > 0, 'Khi DEBUG_ERRORS=true, error (stack) phải xuất hiện')
  } finally {
    delete process.env.DEBUG_ERRORS
  }
})

test('Error handling: sau khi tắt lại DEBUG_ERRORS, hành vi trở lại an toàn mặc định', async () => {
  assert.equal(process.env.DEBUG_ERRORS, undefined, 'Test trước phải đã dọn sạch biến môi trường')
  const res = await apiRequest(server.baseUrl, 'GET', '/users', {})
  assertNoLeak(res.body)
})
