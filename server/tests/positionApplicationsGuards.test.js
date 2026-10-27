// Test các guard mới của positionApplicationService.accept()/internshipService.update() — phát
// hiện trong đợt chuẩn bị triển khai thật: accept() có thể ghi đè hồ sơ đã approved/in_progress/
// completed (bug), không re-check đợt/doanh nghiệp/mentor tại thời điểm chấp nhận, rút đơn "khác"
// không giới hạn theo đợt, và hủy hồ sơ không trả lại slot cho vị trí đã accepted.
//
// Dùng 1 đợt thực tập RIÊNG tạo trong test.before (không đụng period 1/2/3 trong seed, vốn được
// nhiều test file khác dùng chung) — xóa sạch trong test.after (internships trước, rồi period —
// internship_positions/position_applications tự cascade theo period, internships thì KHÔNG nên phải
// xóa tay trước, xem fk_internships_period ON DELETE RESTRICT).
const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens
let periodId
let periodId2

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'mentorB', 'studentA', 'studentB', 'studentD'])

  const [result] = await pool.execute(
    `INSERT INTO internship_periods (period_code, period_name, start_date, end_date, status)
     VALUES (?, 'Đợt test guard accept()', '2030-01-01', '2030-06-01', 'upcoming')`,
    [`TT-GUARD-${Date.now()}`],
  )
  periodId = result.insertId

  const [result2] = await pool.execute(
    `INSERT INTO internship_periods (period_code, period_name, start_date, end_date, status)
     VALUES (?, 'Đợt test guard accept() 2', '2030-07-01', '2030-12-01', 'upcoming')`,
    [`TT-GUARD2-${Date.now()}`],
  )
  periodId2 = result2.insertId
})

test.after(async () => {
  await pool.execute('DELETE FROM internships WHERE period_id IN (?, ?)', [periodId, periodId2])
  await pool.execute('DELETE FROM internship_periods WHERE id IN (?, ?)', [periodId, periodId2])
  await server.close()
})

async function createPosition(targetPeriodId, slots = 1) {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token,
    body: { period_id: targetPeriodId, title: `Guard test ${Date.now()}-${Math.random()}`, slots },
  })
  assert.equal(res.status, 201)
  return res.body.data
}

async function applyAs(studentToken, positionId) {
  const res = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: studentToken,
    body: { position_id: positionId },
  })
  assert.equal(res.status, 201)
  return res.body.data
}

test('accept(): hồ sơ đã approved từ 1 accept trước đó -> accept đơn khác (khác vị trí, cùng sinh viên+đợt) bị 409, KHÔNG ghi đè company/mentor', async () => {
  const positionA = await createPosition(periodId)
  const applicationA = await applyAs(tokens.studentD.token, positionA.id)
  const acceptA = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${applicationA.id}/accept`, {
    token: tokens.mentorB.token,
  })
  assert.equal(acceptA.status, 200)

  const positionB = await createPosition(periodId)
  // Chèn trực tiếp 1 đơn 'applied' cho vị trí B (bỏ qua apply() — apply() tự chặn theo lý do khác,
  // ở đây cần test ĐÚNG guard của accept()).
  const [insertResult] = await pool.execute(
    "INSERT INTO position_applications (position_id, student_id, status) VALUES (?, 12, 'applied')",
    [positionB.id],
  )

  const acceptB = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${insertResult.insertId}/accept`, {
    token: tokens.mentorB.token,
  })
  assert.equal(acceptB.status, 409)
  assert.match(acceptB.body.message, /đã có hồ sơ thực tập/)

  const [[internship]] = await pool.execute('SELECT * FROM internships WHERE student_id = 12 AND period_id = ?', [periodId])
  assert.equal(internship.company_id, positionA.company_id, 'company_id KHÔNG bị ghi đè bởi accept() thất bại')
  assert.equal(internship.status, 'approved')
})

test('accept(): đợt đã đóng ngay lúc chấp nhận -> 409, không tạo hồ sơ', async () => {
  const position = await createPosition(periodId)
  const application = await applyAs(tokens.studentA.token, position.id)

  await pool.execute("UPDATE internship_periods SET status = 'closed' WHERE id = ?", [periodId])
  try {
    const res = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${application.id}/accept`, {
      token: tokens.mentorB.token,
    })
    assert.equal(res.status, 409)
    assert.match(res.body.message, /đợt thực tập/i)
  } finally {
    await pool.execute("UPDATE internship_periods SET status = 'upcoming' WHERE id = ?", [periodId])
  }

  const [rows] = await pool.execute('SELECT * FROM internships WHERE student_id = 1 AND period_id = ?', [periodId])
  assert.equal(rows.length, 0)
  await pool.execute('DELETE FROM position_applications WHERE id = ?', [application.id]) // studentA sạch cho test sau (giới hạn tối đa 3 đơn 'applied')
})

test('accept(): doanh nghiệp của vị trí đang inactive -> 409, không tạo hồ sơ', async () => {
  const position = await createPosition(periodId) // company_id = 1 (mentorB)
  const application = await applyAs(tokens.studentA.token, position.id)

  await pool.execute("UPDATE companies SET status = 'inactive' WHERE id = ?", [position.company_id])
  try {
    const res = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${application.id}/accept`, {
      token: tokens.admin.token, // Admin chấp nhận — tránh phụ thuộc trạng thái mentor ở test này
    })
    assert.equal(res.status, 409)
    assert.match(res.body.message, /doanh nghiệp/i)
  } finally {
    await pool.execute("UPDATE companies SET status = 'active' WHERE id = ?", [position.company_id])
  }

  const [rows] = await pool.execute('SELECT * FROM internships WHERE student_id = 1 AND period_id = ?', [periodId])
  assert.equal(rows.length, 0)
  await pool.execute('DELETE FROM position_applications WHERE id = ?', [application.id]) // studentA sạch cho test sau
})

test('accept(): mentor (company_mentor) đang inactive -> 403, không tạo hồ sơ', async () => {
  const position = await createPosition(periodId)
  const application = await applyAs(tokens.studentA.token, position.id)

  const mentorRows = await pool.execute('SELECT id FROM company_mentors WHERE user_id = (SELECT id FROM users WHERE email = ?)', [
    'company2@example.com',
  ])
  const mentorId = mentorRows[0][0].id

  await pool.execute("UPDATE company_mentors SET status = 'inactive' WHERE id = ?", [mentorId])
  try {
    const res = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${application.id}/accept`, {
      token: tokens.mentorB.token,
    })
    assert.equal(res.status, 403)
    assert.match(res.body.message, /không hoạt động/)
  } finally {
    await pool.execute("UPDATE company_mentors SET status = 'active' WHERE id = ?", [mentorId])
  }

  const [rows] = await pool.execute('SELECT * FROM internships WHERE student_id = 1 AND period_id = ?', [periodId])
  assert.equal(rows.length, 0)
  await pool.execute('DELETE FROM position_applications WHERE id = ?', [application.id]) // studentA sạch cho test sau
})

test('accept(): chỉ rút các đơn applied KHÁC trong CÙNG đợt — đơn applied ở đợt khác không bị đụng', async () => {
  const positionOtherPeriod = await createPosition(periodId2)
  const applicationOtherPeriod = await applyAs(tokens.studentA.token, positionOtherPeriod.id)

  const position = await createPosition(periodId)
  const application = await applyAs(tokens.studentA.token, position.id)
  const accept = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${application.id}/accept`, {
    token: tokens.mentorB.token,
  })
  assert.equal(accept.status, 200)

  const [[stillApplied]] = await pool.execute('SELECT status FROM position_applications WHERE id = ?', [applicationOtherPeriod.id])
  assert.equal(stillApplied.status, 'applied', 'Đơn ở đợt KHÁC không bị tự rút khi accept() 1 đơn ở đợt này')
})

test('internshipService.update(): chuyển "cancelled" -> trả slot (đơn accepted -> withdrawn, vị trí closed -> mở lại open nếu còn chỗ)', async () => {
  const position = await createPosition(periodId, 1)
  const application = await applyAs(tokens.studentB.token, position.id)
  const accept = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${application.id}/accept`, {
    token: tokens.mentorB.token,
  })
  assert.equal(accept.status, 200)

  const [[closedPosition]] = await pool.execute('SELECT status FROM internship_positions WHERE id = ?', [position.id])
  assert.equal(closedPosition.status, 'closed', 'Setup: slots=1, 1 đơn accepted -> vị trí phải tự đóng')

  const [[internship]] = await pool.execute('SELECT * FROM internships WHERE student_id = 5 AND period_id = ?', [periodId])
  const cancelRes = await apiRequest(server.baseUrl, 'PUT', `/internships/${internship.id}`, {
    token: tokens.admin.token,
    body: { status: 'cancelled' },
  })
  assert.equal(cancelRes.status, 200)

  const [[applicationAfter]] = await pool.execute('SELECT status FROM position_applications WHERE id = ?', [application.id])
  assert.equal(applicationAfter.status, 'withdrawn', 'Đơn đã accepted phải chuyển withdrawn sau khi hồ sơ hủy')

  const [[positionAfter]] = await pool.execute('SELECT status FROM internship_positions WHERE id = ?', [position.id])
  assert.equal(positionAfter.status, 'open', 'Vị trí phải mở lại "open" vì đã trả slot, không còn ai accepted')
})
