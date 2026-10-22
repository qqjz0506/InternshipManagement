const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')

let server
let tokens
const createdUserIds = []

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
})

test.after(async () => {
  // Cleanup an toàn: không có DELETE /api/users (đúng thiết kế Phase 4F-1, không tạo endpoint mới
  // chỉ để test) — dọn trực tiếp qua SQL những user do CHÍNH test này tạo ra, và gỡ lại user_id nếu
  // có link, khôi phục đúng trạng thái trước khi test chạy.
  if (createdUserIds.length > 0) {
    await pool.query('UPDATE students SET user_id = NULL WHERE user_id IN (?)', [createdUserIds])
    await pool.query('UPDATE lecturers SET user_id = NULL WHERE user_id IN (?)', [createdUserIds])
    await pool.query('UPDATE company_mentors SET user_id = NULL WHERE user_id IN (?)', [createdUserIds])
    await pool.query('DELETE FROM users WHERE id IN (?)', [createdUserIds])
  }
  // server.close() (helpers/testServer.js) cũng tự gọi pool.end() — không gọi lại ở đây để tránh
  // end() 2 lần trên cùng 1 pool.
  await server.close()
})

async function findUnlinkedProfile(resourcePath) {
  const res = await apiRequest(server.baseUrl, 'GET', resourcePath, { token: tokens.admin.token })
  const candidate = res.body.data.find((item) => !item.user_id)
  assert.ok(candidate, `Cần ít nhất 1 profile chưa link ở ${resourcePath} để test (seed hiện tại thiếu dữ liệu)`)
  return candidate
}

// LƯU Ý: profile_id luôn được tra cứu qua PROFILE_TABLE_BY_ROLE[role] (userService.js) — nghĩa là
// với role='student', profile_id LUÔN được hiểu là students.id, không có cách nào "vô tình" trỏ sang
// bảng lecturers/company_mentors chỉ bằng cách gửi 1 số nguyên tùy ý. Trường hợp role/profile mismatch
// THẬT ở create() chỉ xảy ra khi role='admin' kèm profile_id (admin không có bảng hồ sơ tương ứng).
test('Users: role/profile matching — role=admin + profile_id -> 400, không tạo user', async () => {
  const before = await rowCount('users')

  const res = await apiRequest(server.baseUrl, 'POST', '/users', {
    token: tokens.admin.token,
    body: {
      full_name: 'Test Admin Profile Reject',
      email: `admin-profile-reject-${Date.now()}@example.com`,
      password: 'testpass123',
      role: 'admin',
      profile_id: 1,
    },
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('users'), before, 'Request sai role/profile phải reject trước khi chạm DB, không để lại user mồ côi')
})

test('Users: create hợp lệ + link profile -> password không xuất hiện trong response', async () => {
  const unlinkedStudent = await findUnlinkedProfile('/students')
  const email = `create-valid-${Date.now()}@example.com`

  const res = await apiRequest(server.baseUrl, 'POST', '/users', {
    token: tokens.admin.token,
    body: {
      full_name: 'Test Create Valid',
      email,
      password: 'testpass123',
      role: 'student',
      profile_id: unlinkedStudent.id,
    },
  })
  assert.equal(res.status, 201)
  createdUserIds.push(res.body.data.id)

  const raw = JSON.stringify(res.body)
  assert.ok(!raw.includes('password_hash'))
  assert.ok(!('password' in res.body.data))

  const check = await pool.query('SELECT user_id FROM students WHERE id = ?', [unlinkedStudent.id])
  assert.equal(check[0][0].user_id, res.body.data.id, 'Profile phải được link đúng user vừa tạo')
})

test('Users: update — role/profile_id/password_hash/id là immutable (400 mỗi field)', async () => {
  const targetId = createdUserIds[0]
  assert.ok(targetId, 'Cần user đã tạo ở test trước')

  for (const field of [{ role: 'admin' }, { profile_id: 1 }, { password_hash: 'x' }, { id: 999 }]) {
    const res = await apiRequest(server.baseUrl, 'PUT', `/users/${targetId}`, {
      token: tokens.admin.token,
      body: field,
    })
    assert.equal(res.status, 400, `Field ${JSON.stringify(field)} phải bị reject`)
  }
})

test('Users: list/detail không bao giờ chứa password/password_hash', async () => {
  const list = await apiRequest(server.baseUrl, 'GET', '/users', { token: tokens.admin.token })
  assert.ok(!JSON.stringify(list.body).includes('password'))

  const detail = await apiRequest(server.baseUrl, 'GET', `/users/${tokens.admin.user.id}`, {
    token: tokens.admin.token,
  })
  assert.ok(!JSON.stringify(detail.body).includes('password'))
})

test('Users: cross-profile uniqueness — user vừa tạo (role=student) không thể bị link làm lecturer', async () => {
  const studentUserId = createdUserIds[0]
  const unlinkedLecturer = await findUnlinkedProfile('/lecturers')
  const full = await apiRequest(server.baseUrl, 'GET', `/lecturers/${unlinkedLecturer.id}`, {
    token: tokens.admin.token,
  })

  const res = await apiRequest(server.baseUrl, 'PUT', `/lecturers/${unlinkedLecturer.id}`, {
    token: tokens.admin.token,
    body: { ...full.body.data, user_id: studentUserId },
  })
  assert.equal(res.status, 400, 'User có role=student không được link làm lecturer')

  const check = await pool.query('SELECT user_id FROM lecturers WHERE id = ?', [unlinkedLecturer.id])
  assert.equal(check[0][0].user_id, null, 'Lecturer phải vẫn chưa link sau request bị reject')
})
