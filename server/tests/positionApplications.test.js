const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens
const createdPositionIds = []

// Ground truth: students.id=12 (user_id=8, "student4@example.com"="studentD") KHÔNG có internship
// nào trong seed (an toàn làm sinh viên ứng tuyển). students.id=1 ("studentA") và students.id=5
// ("studentB") CHỈ có internship ở period_id=2 trong seed — vẫn "sạch" ở period_id=3, dùng được cho
// test race-condition 2 sinh viên cùng ứng tuyển. company_mentors.id=1 (user_id=9,
// "company2@example.com"="mentorB") -> company_id=1.

async function createPosition(slots = 1) {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-positions', {
    token: tokens.mentorB.token,
    body: { period_id: 3, title: `Intern test ${Date.now()}-${Math.random()}`, slots },
  })
  assert.equal(res.status, 201)
  createdPositionIds.push(res.body.data.id)
  return res.body.data
}

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'mentorA', 'mentorB', 'studentD', 'studentA', 'studentB'])
})

test.after(async () => {
  await pool.execute(
    `DELETE FROM position_applications WHERE position_id IN (${createdPositionIds.map(() => '?').join(',') || 'NULL'})`,
    createdPositionIds,
  )
  await pool.execute('DELETE FROM internships WHERE student_id = 12 AND period_id = 3')
  if (createdPositionIds.length > 0) {
    await pool.query(`DELETE FROM internship_positions WHERE id IN (${createdPositionIds.map(() => '?').join(',')})`, createdPositionIds)
  }
  await server.close()
})

// Mọi test dùng studentD đều phải dọn sạch position_applications của chính mình NGAY SAU test (không
// dồn về test.after) — các test SAU dựa vào "studentD đang có đúng 0 đơn applied" để kiểm tra giới
// hạn tối đa 3 đơn một cách chính xác, không bị lệch bởi đơn còn sót từ test trước.
async function cleanupStudentDApplications() {
  await pool.execute('DELETE FROM position_applications WHERE student_id = 12')
}

test('Student ứng tuyển vị trí open -> 201, status=applied', async () => {
  const position = await createPosition(2)
  try {
    const res = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: position.id, note: 'Em muốn ứng tuyển vị trí này.' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.status, 'applied')
  } finally {
    await cleanupStudentDApplications()
  }
})

test('Rút đơn rồi ứng tuyển lại CÙNG vị trí -> UPDATE lại đúng dòng cũ, không tạo dòng mới', async () => {
  const position = await createPosition(1)
  try {
    const apply1 = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: position.id },
    })
    assert.equal(apply1.status, 201)
    const applicationId = apply1.body.data.id

    const withdraw = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${applicationId}/withdraw`, {
      token: tokens.studentD.token,
    })
    assert.equal(withdraw.status, 200)
    assert.equal(withdraw.body.data.status, 'withdrawn')

    const apply2 = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: position.id },
    })
    assert.equal(apply2.status, 201)
    assert.equal(apply2.body.data.id, applicationId, 'Phải là ĐÚNG dòng cũ (UPDATE), không phải dòng mới')
    assert.equal(apply2.body.data.status, 'applied')
  } finally {
    await cleanupStudentDApplications()
  }
})

test('Tối đa 3 đơn đang chờ cùng lúc -> đơn thứ 4 bị 409', async () => {
  const positions = [await createPosition(1), await createPosition(1), await createPosition(1), await createPosition(1)]
  const applicationIds = []
  try {
    for (let i = 0; i < 3; i += 1) {
      const res = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
        token: tokens.studentD.token,
        body: { position_id: positions[i].id },
      })
      assert.equal(res.status, 201, `Đơn thứ ${i + 1} phải thành công`)
      applicationIds.push(res.body.data.id)
    }
    const fourth = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: positions[3].id },
    })
    assert.equal(fourth.status, 409)
  } finally {
    await cleanupStudentDApplications()
  }
})

test('Đã có internship approved trong đợt -> không ứng tuyển được vị trí khác trong đợt đó', async () => {
  const [[existing]] = await pool.query('SELECT id FROM internships WHERE student_id = 12 AND period_id = 3')
  assert.equal(existing, undefined, 'Pre-condition: studentD chưa có internship nào ở period 3')
  await pool.execute(
    "INSERT INTO internships (student_id, period_id, status, progress) VALUES (12, 3, 'approved', 0)",
  )
  try {
    const position = await createPosition(1)
    const res = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: position.id },
    })
    assert.equal(res.status, 409)
  } finally {
    await pool.execute("DELETE FROM internships WHERE student_id = 12 AND period_id = 3 AND status = 'approved'")
    await cleanupStudentDApplications()
  }
})

test('Admin/Mentor từ chối đơn -> status=rejected, Student không tự từ chối được', async () => {
  const position = await createPosition(1)
  try {
    const apply = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
      token: tokens.studentD.token,
      body: { position_id: position.id },
    })
    const applicationId = apply.body.data.id

    const studentTriesReject = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${applicationId}/reject`, {
      token: tokens.studentD.token,
    })
    assert.equal(studentTriesReject.status, 403)

    const reject = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${applicationId}/reject`, {
      token: tokens.mentorB.token,
    })
    assert.equal(reject.status, 200)
    assert.equal(reject.body.data.status, 'rejected')
  } finally {
    await cleanupStudentDApplications()
  }
})

test('Mentor chấp nhận đơn -> tạo internship approved, position tự đóng khi đủ slot, auto rút các đơn khác', async () => {
  const position = await createPosition(1)
  const apply = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: tokens.studentD.token,
    body: { position_id: position.id },
  })
  const applicationId = apply.body.data.id

  // Đơn thứ 2 (vị trí khác) để kiểm tra bị auto-withdraw sau khi đơn đầu được accept.
  const otherPosition = await createPosition(1)
  const otherApply = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: tokens.studentD.token,
    body: { position_id: otherPosition.id },
  })

  try {
    const accept = await apiRequest(server.baseUrl, 'PUT', `/position-applications/${applicationId}/accept`, {
      token: tokens.mentorB.token,
    })
    assert.equal(accept.status, 200)
    assert.equal(accept.body.data.status, 'accepted')

    const [[internship]] = await pool.query(
      'SELECT * FROM internships WHERE student_id = 12 AND period_id = 3',
    )
    assert.ok(internship, 'Phải tự tạo internship cho studentD')
    assert.equal(internship.status, 'approved')
    assert.equal(internship.company_id, 1)
    assert.equal(internship.company_mentor_id, 1, 'company_mentor_id phải là ĐÚNG hồ sơ mentorB (id=1)')

    const [[closedPosition]] = await pool.query('SELECT status FROM internship_positions WHERE id = ?', [position.id])
    assert.equal(closedPosition.status, 'closed', 'slots=1, 1 accepted -> tự đóng')

    const [[otherApplicationFresh]] = await pool.query(
      'SELECT status FROM position_applications WHERE id = ?',
      [otherApply.body.data.id],
    )
    assert.equal(otherApplicationFresh.status, 'withdrawn', 'Đơn khác của cùng SV phải tự rút')
  } finally {
    await pool.execute('DELETE FROM internships WHERE student_id = 12 AND period_id = 3')
    await cleanupStudentDApplications()
  }
})

test('Race condition: 2 request accept đồng thời cho vị trí 1 slot -> đúng 1 thành công, 1 bị 409 hết chỗ', async () => {
  const position = await createPosition(1)
  const applyA = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: tokens.studentA.token,
    body: { position_id: position.id },
  })
  const applyB = await apiRequest(server.baseUrl, 'POST', '/position-applications', {
    token: tokens.studentB.token,
    body: { position_id: position.id },
  })
  assert.equal(applyA.status, 201)
  assert.equal(applyB.status, 201)

  try {
    const [resultA, resultB] = await Promise.all([
      apiRequest(server.baseUrl, 'PUT', `/position-applications/${applyA.body.data.id}/accept`, { token: tokens.mentorB.token }),
      apiRequest(server.baseUrl, 'PUT', `/position-applications/${applyB.body.data.id}/accept`, { token: tokens.mentorB.token }),
    ])
    const statuses = [resultA.status, resultB.status].sort()
    assert.deepEqual(statuses, [200, 409], 'Đúng 1 request 200 (thành công), 1 request 409 (hết chỗ)')

    const [[{ acceptedCount }]] = await pool.query(
      "SELECT COUNT(*) AS acceptedCount FROM position_applications WHERE position_id = ? AND status = 'accepted'",
      [position.id],
    )
    assert.equal(acceptedCount, 1, 'Không được vượt slot dù 2 request đồng thời')
  } finally {
    await pool.execute(
      "DELETE FROM internships WHERE (student_id = 1 OR student_id = 5) AND period_id = 3 AND status = 'approved'",
    )
  }
})
