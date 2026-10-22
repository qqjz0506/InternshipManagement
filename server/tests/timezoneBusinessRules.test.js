// Test tích hợp (HTTP thật + JWT thật) cho rule "hôm nay"/"tương lai" lúc 01:00 sáng giờ Việt Nam —
// mock global Date (node:test mock.timers, Node 20+) để verify hành vi THỰC TẾ qua API, không chỉ
// test đơn vị hàm `todayDateString()` (xem tests/dateTime.test.js). Mốc mock: 2026-10-20T18:00:00Z
// (UTC) = 01:00 sáng 21/10/2026 giờ Việt Nam — "hôm nay" ĐÚNG phải là 2026-10-21, cách cũ (UTC) sẽ
// cho 2026-10-20 (sai, lùi 1 ngày).
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { buildReportFormData } = require('./helpers/fileFixtures')
const { loginAll } = require('./helpers/auth')
const { pool } = require('../config/database')

const MOCKED_NOW = new Date('2026-10-20T18:00:00.000Z') // 01:00 VN 21/10/2026
const VN_TODAY = '2026-10-21'
const BUGGY_UTC_TODAY = '2026-10-20'

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  // Login TRƯỚC khi mock clock — jsonwebtoken ký iat/exp theo Date.now() thật, không cần mock lúc này.
  tokens = await loginAll(server.baseUrl, ['admin', 'studentD'])
})

test.after(async () => {
  await server.close()
})

async function createInProgressInternship(adminToken) {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: adminToken,
    body: { student_id: 12, period_id: 3 },
  })
  assert.equal(create.status, 201, `Tạo internship fixture thất bại: ${JSON.stringify(create.body)}`)
  const internshipId = create.body.data.id

  const assign = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: adminToken,
    body: { company_id: 1, lecturer_id: 2, company_mentor_id: 1 },
  })
  assert.equal(assign.status, 200)

  const toApproved = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: adminToken,
    body: { status: 'approved' },
  })
  assert.equal(toApproved.status, 200)

  const toInProgress = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: adminToken,
    body: { status: 'in_progress' },
  })
  assert.equal(toInProgress.status, 200)

  return internshipId
}

async function deleteInternshipFixture(internshipId) {
  await pool.execute('DELETE FROM internships WHERE id = ?', [internshipId])
}

test('Timezone: ghi nhật ký với log_date = hôm nay giờ Việt Nam lúc 01:00 sáng -> KHÔNG bị chặn "tương lai" (201)', async (t) => {
  const internshipId = await createInProgressInternship(tokens.admin.token)
  try {
    t.mock.timers.enable({ apis: ['Date'], now: MOCKED_NOW })
    try {
      const res = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
        token: tokens.studentD.token,
        body: {
          internship_id: internshipId,
          log_date: VN_TODAY,
          title: 'Nhật ký test timezone',
          content: 'Nội dung test.',
          progress: 10,
        },
      })
      assert.equal(
        res.status,
        201,
        `log_date=${VN_TODAY} (hôm nay giờ VN) phải được chấp nhận lúc 01:00 sáng, không bị coi là tương lai. Response: ${JSON.stringify(res.body)}`,
      )

      // Xác nhận rõ: nếu dùng cách cũ (UTC), log_date này sẽ bị reject vì "tương lai" so với BUGGY_UTC_TODAY.
      assert.ok(
        VN_TODAY > BUGGY_UTC_TODAY,
        'Xác nhận test case này THỰC SỰ rơi vào khoảng giờ dễ gây lệch ngày (VN_TODAY phải lớn hơn ngày UTC lúc đó)',
      )
    } finally {
      t.mock.timers.reset()
    }
  } finally {
    await deleteInternshipFixture(internshipId)
  }
})

test('Timezone: nộp báo cáo lúc 01:00 sáng giờ Việt Nam -> submitted_at ghi đúng ngày Việt Nam (không lùi 1 ngày theo UTC)', async (t) => {
  const internshipId = await createInProgressInternship(tokens.admin.token)
  let reportId = null
  try {
    t.mock.timers.enable({ apis: ['Date'], now: MOCKED_NOW })
    try {
      const report = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
        token: tokens.studentD.token,
        formData: buildReportFormData(
          { internship_id: internshipId, report_type: 'weekly' },
          { filename: 'bao-cao-test-timezone.pdf' },
        ),
      })
      assert.equal(report.status, 201, `Nộp báo cáo thất bại: ${JSON.stringify(report.body)}`)
      reportId = report.body.data.id
      assert.equal(
        report.body.data.submitted_at,
        VN_TODAY,
        `submitted_at phải là ${VN_TODAY} (ngày VN), không phải ${BUGGY_UTC_TODAY} (ngày UTC — cách tính cũ bị lỗi)`,
      )
    } finally {
      t.mock.timers.reset()
    }

    // Verify lại trực tiếp qua DB (không tin riêng response — đúng convention COUNT(*)/SELECT thật).
    const [[row]] = await pool.query('SELECT submitted_at FROM reports WHERE id = ?', [reportId])
    assert.equal(row.submitted_at, VN_TODAY)
  } finally {
    if (reportId) {
      await pool.execute('DELETE FROM reports WHERE id = ?', [reportId])
    }
    await deleteInternshipFixture(internshipId)
  }
})

test('Timezone: công bố đánh giá lúc 01:00 sáng giờ Việt Nam -> published_at ghi đúng ngày Việt Nam', async (t) => {
  const internshipId = await createInProgressInternship(tokens.admin.token)
  let evaluationId = null
  try {
    const create = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
      token: tokens.admin.token,
      body: {
        internship_id: internshipId,
        evaluator_role: 'lecturer',
        attitude_score: 8,
        skill_score: 8,
        progress_score: 8,
        discipline_score: 8,
      },
    })
    assert.equal(create.status, 201)
    evaluationId = create.body.data.id

    t.mock.timers.enable({ apis: ['Date'], now: MOCKED_NOW })
    try {
      const publish = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
        token: tokens.admin.token,
        body: { is_published: true },
      })
      assert.equal(publish.status, 200)
      assert.equal(
        publish.body.data.published_at,
        VN_TODAY,
        `published_at phải là ${VN_TODAY} (ngày VN), không phải ${BUGGY_UTC_TODAY} (ngày UTC — cách tính cũ bị lỗi)`,
      )
    } finally {
      t.mock.timers.reset()
    }
  } finally {
    await deleteInternshipFixture(internshipId) // CASCADE xóa luôn evaluation
  }
})
