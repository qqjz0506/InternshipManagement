// Test phân trang phía server cho GET /api/students, /api/internships, /api/reports,
// /api/internship-logs — yêu cầu trực tiếp của người dùng: KHÔNG truyền `page` phải giữ nguyên hành
// vi cũ (trả toàn bộ, không có field total/page/pageSize nào xuất hiện); CÓ `page` mới trả 1 trang +
// { total, page, pageSize }; pageSize tối đa 100; scope theo role phải giữ nguyên (không bị phân
// trang làm lộ dữ liệu ngoài scope).
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
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

const ENDPOINTS = ['/students', '/internships', '/reports', '/internship-logs']

for (const endpoint of ENDPOINTS) {
  test(`Pagination ${endpoint}: không truyền page -> giữ nguyên hành vi cũ (trả toàn bộ, không có total/page/pageSize)`, async () => {
    const res = await apiRequest(server.baseUrl, 'GET', endpoint, { token: tokens.admin.token })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data), 'data phải là array (full list) khi không truyền page')
    assert.equal(res.body.total, undefined, 'Không truyền page thì KHÔNG được có field total')
    assert.equal(res.body.page, undefined)
    assert.equal(res.body.pageSize, undefined)
  })

  test(`Pagination ${endpoint}: truyền page -> trả 1 trang + { total, page, pageSize } khớp đúng tổng số dòng không phân trang`, async () => {
    const full = await apiRequest(server.baseUrl, 'GET', endpoint, { token: tokens.admin.token })
    assert.equal(full.status, 200)
    const totalExpected = full.body.data.length

    const paged = await apiRequest(server.baseUrl, 'GET', `${endpoint}?page=1&pageSize=1`, {
      token: tokens.admin.token,
    })
    assert.equal(paged.status, 200)
    assert.ok(Array.isArray(paged.body.data))
    assert.ok(paged.body.data.length <= 1, 'pageSize=1 -> tối đa 1 dòng')
    assert.equal(paged.body.total, totalExpected, 'total phải khớp đúng tổng số dòng (không phân trang) cùng scope')
    assert.equal(paged.body.page, 1)
    assert.equal(paged.body.pageSize, 1)

    if (totalExpected > 1) {
      assert.equal(paged.body.data.length, 1, 'Có >1 dòng thì trang đầu phải đủ đúng 1 dòng (pageSize=1)')
    }
  })

  test(`Pagination ${endpoint}: pageSize vượt quá 100 bị chặn (clamp về 100), không trả nhiều hơn 100 dòng/trang`, async () => {
    const res = await apiRequest(server.baseUrl, 'GET', `${endpoint}?page=1&pageSize=500`, {
      token: tokens.admin.token,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.pageSize, 100, 'pageSize phải bị clamp về tối đa 100')
    assert.ok(res.body.data.length <= 100)
  })

  test(`Pagination ${endpoint}: trang 2 không trùng dữ liệu với trang 1 (khi đủ dữ liệu)`, async () => {
    const page1 = await apiRequest(server.baseUrl, 'GET', `${endpoint}?page=1&pageSize=1`, {
      token: tokens.admin.token,
    })
    const page2 = await apiRequest(server.baseUrl, 'GET', `${endpoint}?page=2&pageSize=1`, {
      token: tokens.admin.token,
    })
    assert.equal(page1.status, 200)
    assert.equal(page2.status, 200)
    if (page1.body.total > 1) {
      assert.notDeepEqual(page1.body.data, page2.body.data, 'Trang 2 phải khác trang 1 khi có >1 dòng')
    }
  })
}

// ---- Scope theo role phải giữ nguyên khi phân trang (không bị lộ dữ liệu ngoài scope) ----

test('Pagination /students: Student chỉ thấy đúng 1 hồ sơ của chính mình (total=1) dù có page', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/students?page=1&pageSize=10', {
    token: tokens.studentA.token,
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.total, 1, 'Student chỉ scope đúng 1 hồ sơ của chính mình')
  assert.equal(res.body.data.length, 1)
  assert.equal(res.body.data[0].student_code, '21110001')
})

test('Pagination /internships: Student chỉ thấy đúng hồ sơ thực tập của chính mình dù có page', async () => {
  const unpaged = await apiRequest(server.baseUrl, 'GET', '/internships', { token: tokens.studentA.token })
  const paged = await apiRequest(server.baseUrl, 'GET', '/internships?page=1&pageSize=10', {
    token: tokens.studentA.token,
  })
  assert.equal(paged.status, 200)
  assert.equal(paged.body.total, unpaged.body.data.length)
  assert.ok(
    paged.body.data.every((row) => unpaged.body.data.some((full) => full.id === row.id)),
    'Mọi dòng trả về khi phân trang phải nằm trong đúng scope (tập không phân trang)',
  )
})
