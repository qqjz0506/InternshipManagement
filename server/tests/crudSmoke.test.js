const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Smoke test: mỗi domain chính phải trả đúng status + shape cơ bản cho Admin. Không tạo dữ liệu rác
// (chỉ GET) — mục tiêu là bắt regression kiểu "route bị xóa nhầm"/"response shape đổi", không phải
// coverage đầy đủ (mục 11 Phase 6B).
const LIST_DOMAINS = [
  ['/departments', 'array'],
  ['/students', 'array'],
  ['/lecturers', 'array'],
  ['/companies', 'array'],
  ['/company-mentors', 'array'],
  ['/internship-periods', 'array'],
  ['/topics', 'array'],
  ['/internships', 'array'],
  ['/internship-logs', 'array'],
  ['/reports', 'array'],
  ['/evaluations', 'array'],
  ['/notifications', 'array'],
  ['/users', 'array'],
]

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin'])
})

test.after(async () => {
  await server.close()
})

for (const [path] of LIST_DOMAINS) {
  test(`CRUD smoke: GET ${path} -> 200 + array`, async () => {
    const res = await apiRequest(server.baseUrl, 'GET', path, { token: tokens.admin.token })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data), `${path} phải trả data dạng array`)
  })
}

test('CRUD smoke: GET /settings -> 200 + object đơn (không phải array)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(typeof res.body.data, 'object')
  assert.ok(!Array.isArray(res.body.data), 'Settings là single-row, không phải collection')
  assert.equal(res.body.data.id, 1)
})

test('CRUD smoke: GET /departments/:id -> 200, shape đúng field cơ bản', async () => {
  const list = await apiRequest(server.baseUrl, 'GET', '/departments', { token: tokens.admin.token })
  const firstId = list.body.data[0].id
  const detail = await apiRequest(server.baseUrl, 'GET', `/departments/${firstId}`, { token: tokens.admin.token })
  assert.equal(detail.status, 200)
  assert.ok('department_name' in detail.body.data)
})

test('CRUD smoke: GET /departments/:id nonexistent -> 404', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/departments/999999', { token: tokens.admin.token })
  assert.equal(res.status, 404)
})
