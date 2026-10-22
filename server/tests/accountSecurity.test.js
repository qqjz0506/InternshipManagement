const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll, SEED_ACCOUNTS } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')
const userService = require('../services/userService')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
})

test.after(async () => {
  await server.close()
})

// Tạo 1 user tạm qua đúng API thật (POST /users, Admin) — dọn lại bằng SQL trực tiếp trong finally
// (không có DELETE /api/users theo thiết kế, giống convention tests/users.test.js).
async function createTempUser({ role = 'student', email }) {
  const res = await apiRequest(server.baseUrl, 'POST', '/users', {
    token: tokens.admin.token,
    body: {
      full_name: 'Temp Account Security Test',
      email,
      password: 'TempPass123',
      role,
    },
  })
  assert.equal(res.status, 201, `Tạo temp user thất bại: ${JSON.stringify(res.body)}`)
  return res.body.data.id
}

async function deleteTempUser(id) {
  await pool.execute('DELETE FROM users WHERE id = ?', [id])
}

// ---- Đổi mật khẩu ----

test('Change password: sai mật khẩu hiện tại -> 401, không đổi', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
    token: tokens.studentA.token,
    body: { currentPassword: 'sai-mat-khau', newPassword: 'NewPass123' },
  })
  assert.equal(res.status, 401)
})

test('Change password: mật khẩu mới yếu (ngắn/thiếu chữ hoặc số) -> 400', async () => {
  for (const weak of ['short1', 'alllettersnodigit', '12345678']) {
    const res = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
      token: tokens.studentA.token,
      body: { currentPassword: SEED_ACCOUNTS.studentA.password, newPassword: weak },
    })
    assert.equal(res.status, 400, `"${weak}" phải bị reject`)
  }
})

test('Change password: mật khẩu mới giống mật khẩu hiện tại -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
    token: tokens.studentA.token,
    body: { currentPassword: SEED_ACCOUNTS.studentA.password, newPassword: SEED_ACCOUNTS.studentA.password },
  })
  assert.equal(res.status, 400)
})

test('Change password: đổi thành công, đăng nhập lại bằng mật khẩu mới, rồi khôi phục mật khẩu gốc', async () => {
  const original = SEED_ACCOUNTS.studentA.password
  const newPassword = 'NewPass123'

  try {
    const change = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
      token: tokens.studentA.token,
      body: { currentPassword: original, newPassword },
    })
    assert.equal(change.status, 200)

    const loginWithNew = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email: SEED_ACCOUNTS.studentA.email, password: newPassword },
    })
    assert.equal(loginWithNew.status, 200, 'Phải đăng nhập được bằng mật khẩu mới')

    const loginWithOld = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email: SEED_ACCOUNTS.studentA.email, password: original },
    })
    assert.equal(loginWithOld.status, 401, 'Mật khẩu cũ không còn hợp lệ sau khi đổi')
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
      token: tokens.studentA.token,
      body: { currentPassword: newPassword, newPassword: original },
    })
    assert.equal(restore.status, 200, 'Phải khôi phục được mật khẩu gốc')

    const loginRestored = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email: SEED_ACCOUNTS.studentA.email, password: original },
    })
    assert.equal(loginRestored.status, 200, 'Phải đăng nhập lại được bằng mật khẩu gốc sau khi khôi phục')
  }
})

// ---- Admin đặt lại mật khẩu cho tài khoản khác ----

test('Admin reset-password: sinh mật khẩu tạm, user đăng nhập được bằng mật khẩu đó', async () => {
  const email = `reset-pw-test-${Date.now()}@example.com`
  const userId = await createTempUser({ role: 'student', email })

  try {
    const reset = await apiRequest(server.baseUrl, 'PUT', `/users/${userId}/reset-password`, {
      token: tokens.admin.token,
    })
    assert.equal(reset.status, 200)
    assert.ok(reset.body.data.temporaryPassword, 'Phải trả về mật khẩu tạm')
    assert.ok(!('password_hash' in reset.body.data.user), 'Không được lộ password_hash')

    const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: reset.body.data.temporaryPassword },
    })
    assert.equal(login.status, 200, 'Phải đăng nhập được bằng mật khẩu tạm vừa được cấp')

    // Student không có quyền reset-password cho tài khoản khác (route-level Admin-only).
    const nonAdmin = await apiRequest(server.baseUrl, 'PUT', `/users/${userId}/reset-password`, {
      token: tokens.studentA.token,
    })
    assert.equal(nonAdmin.status, 403)
  } finally {
    await deleteTempUser(userId)
  }
})

test('Admin reset-password: bật must_change_password=true; đổi mật khẩu thành công thì tự tắt lại', async () => {
  const email = `must-change-pw-test-${Date.now()}@example.com`
  const userId = await createTempUser({ role: 'student', email })

  try {
    const reset = await apiRequest(server.baseUrl, 'PUT', `/users/${userId}/reset-password`, {
      token: tokens.admin.token,
    })
    assert.equal(reset.status, 200)
    assert.equal(reset.body.data.user.mustChangePassword, true, 'Reset mật khẩu phải bật must_change_password')

    const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: reset.body.data.temporaryPassword },
    })
    assert.equal(login.status, 200)
    assert.equal(
      login.body.data.user.mustChangePassword,
      true,
      'Response đăng nhập phải báo mustChangePassword để client bắt chuyển trang đổi mật khẩu',
    )

    const me = await apiRequest(server.baseUrl, 'GET', '/auth/me', { token: login.body.data.accessToken })
    assert.equal(me.status, 200)
    assert.equal(me.body.data.mustChangePassword, true, 'GET /auth/me cũng phải phản ánh đúng cờ (F5 giữa chừng)')

    // Chặn ở SERVER (requireAuth) — không chỉ ở frontend (ProtectedRoute.jsx). Gọi 1 API bất kỳ khác
    // /auth/me và /auth/change-password phải bị 403 kèm code "MUST_CHANGE_PASSWORD" để client tự
    // nhận biết và điều hướng, không phải đoán qua message.
    const blockedOtherApi = await apiRequest(server.baseUrl, 'GET', '/departments', {
      token: login.body.data.accessToken,
    })
    assert.equal(blockedOtherApi.status, 403)
    assert.equal(blockedOtherApi.body.code, 'MUST_CHANGE_PASSWORD')

    const blockedWrite = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
      token: login.body.data.accessToken,
      body: { phone: '0900000000' },
    })
    assert.equal(blockedWrite.status, 403)
    assert.equal(blockedWrite.body.code, 'MUST_CHANGE_PASSWORD')

    const changeResult = await apiRequest(server.baseUrl, 'PUT', '/auth/change-password', {
      token: login.body.data.accessToken,
      body: { currentPassword: reset.body.data.temporaryPassword, newPassword: 'BrandNewPass123' },
    })
    assert.equal(changeResult.status, 200)

    const loginAfterChange = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: 'BrandNewPass123' },
    })
    assert.equal(loginAfterChange.status, 200)
    assert.equal(
      loginAfterChange.body.data.user.mustChangePassword,
      false,
      'Sau khi tự đổi mật khẩu thành công, must_change_password phải tự tắt',
    )

    const unblockedNow = await apiRequest(server.baseUrl, 'GET', '/departments', {
      token: loginAfterChange.body.data.accessToken,
    })
    assert.equal(unblockedNow.status, 200, 'Sau khi đổi mật khẩu, API khác phải gọi được bình thường')
  } finally {
    await deleteTempUser(userId)
  }
})

// ---- Khóa / mở tài khoản ----

test('Lock account: đăng nhập bị chặn (403); token cũ (đã cấp trước đó) cũng bị chặn ngay; mở lại thì dùng được bình thường', async () => {
  const email = `lock-test-${Date.now()}@example.com`
  const userId = await createTempUser({ role: 'student', email })

  try {
    const loginBeforeLock = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: 'TempPass123' },
    })
    assert.equal(loginBeforeLock.status, 200)
    const tokenIssuedBeforeLock = loginBeforeLock.body.data.accessToken

    const lock = await apiRequest(server.baseUrl, 'PUT', `/users/${userId}/status`, {
      token: tokens.admin.token,
      body: { status: 'locked' },
    })
    assert.equal(lock.status, 200)
    assert.equal(lock.body.data.status, 'locked')

    const loginAfterLock = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: 'TempPass123' },
    })
    assert.equal(loginAfterLock.status, 403, 'Tài khoản đã khóa không được đăng nhập')

    const meWithOldToken = await apiRequest(server.baseUrl, 'GET', '/auth/me', { token: tokenIssuedBeforeLock })
    assert.equal(meWithOldToken.status, 403, 'Token cũ cấp trước khi khóa cũng phải bị chặn ngay (requireAuth luôn query lại DB)')

    const unlock = await apiRequest(server.baseUrl, 'PUT', `/users/${userId}/status`, {
      token: tokens.admin.token,
      body: { status: 'active' },
    })
    assert.equal(unlock.status, 200)
    assert.equal(unlock.body.data.status, 'active')

    const loginAfterUnlock = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email, password: 'TempPass123' },
    })
    assert.equal(loginAfterUnlock.status, 200, 'Mở khóa xong phải đăng nhập lại được')
  } finally {
    await deleteTempUser(userId)
  }
})

test('Set status: Student không có quyền gọi (403 route-level)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', `/users/${tokens.admin.user.id}/status`, {
    token: tokens.studentA.token,
    body: { status: 'locked' },
  })
  assert.equal(res.status, 403)
})

test('Set status: Admin không thể tự khóa chính mình (403), không đổi', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', `/users/${tokens.admin.user.id}/status`, {
    token: tokens.admin.token,
    body: { status: 'locked' },
  })
  assert.equal(res.status, 403)

  const [[row]] = await pool.query('SELECT status FROM users WHERE id = ?', [tokens.admin.user.id])
  assert.equal(row.status, 'active', 'Admin đang đăng nhập không được bị khóa sau request bị reject')
})

test('Set status: không khóa được admin cuối cùng đang active (409)', async () => {
  // Ground truth quan trọng: mọi actor gọi được API này đều PHẢI đang active (requireAuth chặn tài
  // khoản locked trước khi tới route) — nên nếu actor != target, actor luôn được tính là "1 admin
  // active khác", khiến rule "admin cuối cùng" không có đường tái tạo thuần qua HTTP tuần tự (sẽ
  // luôn trùng với rule "tự khóa chính mình" ở trên, vốn chặn TRƯỚC với message khác). Test này gọi
  // trực tiếp userService.setStatus() để kiểm tra đúng logic COUNT(*) của rule — vẫn là test THẬT
  // (chạy đúng code thật, đúng DB thật), chỉ bỏ qua tầng HTTP/JWT vì tầng đó không thể dựng được
  // trạng thái cần kiểm tra.
  const email = `last-admin-test-${Date.now()}@example.com`
  const tempAdminId = await createTempUser({ role: 'admin', email })

  // Khóa tạm mọi admin khác (kể cả seed admin id=1) để tempAdminId trở thành admin active DUY NHẤT.
  const [otherAdmins] = await pool.query(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND id != ?",
    [tempAdminId],
  )
  const otherAdminIds = otherAdmins.map((row) => row.id)
  await pool.query('UPDATE users SET status = ? WHERE id IN (?)', ['locked', otherAdminIds])

  try {
    const [[check]] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'",
    )
    assert.equal(check.count, 1, 'Ground truth: phải đúng 1 admin active trước khi test')

    await assert.rejects(
      () => userService.setStatus(tempAdminId, 'locked', { id: 999999999, role: 'admin' }),
      (error) => {
        assert.equal(error.statusCode, 409)
        return true
      },
      'Phải chặn khóa admin cuối cùng đang active',
    )
  } finally {
    await pool.query('UPDATE users SET status = ? WHERE id IN (?)', ['active', otherAdminIds])
    await deleteTempUser(tempAdminId)
  }
})

// ---- Helmet / body size limit (code review bổ sung bằng test tự động ở mức có thể) ----

test('Security headers: helmet gắn header bảo mật cơ bản vào mọi response', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/health', {})
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
  assert.ok(res.headers['x-dns-prefetch-control'] !== undefined)
})

test('Body size limit: payload > 1MB bị chặn, không crash server', async () => {
  const hugeString = 'x'.repeat(1024 * 1024 + 100) // ~1MB + 100 byte, vượt giới hạn express.json({limit:'1mb'})
  const res = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'a@a.com', password: hugeString },
  })
  assert.ok([413, 400].includes(res.status), `Phải bị chặn (413 payload too large), nhận ${res.status}`)

  // Server phải vẫn sống — gọi tiếp 1 request bình thường phải vẫn hoạt động.
  const health = await apiRequest(server.baseUrl, 'GET', '/health', {})
  assert.equal(health.status, 200)
})

test('Rate limit: bị tắt khi NODE_ENV=test (không chặn test suite đăng nhập nhiều lần)', async () => {
  // Ghi nhận minh bạch: KHÔNG test được hành vi "chặn sau 10 lần/15 phút" một cách an toàn trong
  // cùng tiến trình test (sẽ phải tạm đổi NODE_ENV giữa lúc chạy, rủi ro ảnh hưởng các test khác chạy
  // cùng server) — hành vi skip khi NODE_ENV=test được xác nhận GIÁN TIẾP nhưng CHẮC CHẮN: toàn bộ
  // 150+ test trong suite này gọi POST /auth/login tổng cộng hàng chục lần từ CÙNG 1 IP (127.0.0.1)
  // trong vài giây, vượt xa ngưỡng 10 lần/15 phút — nếu middleware không skip đúng, cả suite đã
  // fail 429 từ lâu. Test này xác nhận rõ ràng bằng cách gọi login 12 lần liên tiếp (> ngưỡng 10) và
  // yêu cầu KHÔNG có request nào bị 429.
  for (let i = 0; i < 12; i += 1) {
    const res = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
      body: { email: SEED_ACCOUNTS.admin.email, password: 'wrong-password' },
    })
    assert.notEqual(res.status, 429, `Lần gọi thứ ${i + 1} không được bị rate-limit khi NODE_ENV=test`)
  }
})
