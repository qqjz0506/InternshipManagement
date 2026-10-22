// Test bất biến của hồ sơ thực tập đã 'completed' — đợt kiểm tra trước bảo vệ:
//   (1) Không cho bỏ công bố HOẶC xóa đánh giá thuộc hồ sơ đã completed (kể cả Admin).
//   (2) Không cho đổi status HOẶC xóa báo cáo final 'approved' của hồ sơ đã completed.
//   (3) Không cho gỡ (set null) lecturer_id/company_id/company_mentor_id khi hồ sơ đang 'in_progress'
//       hoặc 'completed' — đổi sang người khác (active, đúng company) vẫn được khi 'in_progress'.
//   (4) internships.final_score/final_classification được CHỐT lúc chuyển sang completed — đổi trọng
//       số ở Settings SAU ĐÓ không làm đổi điểm đã chốt.
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { buildReportFormData } = require('./helpers/fileFixtures')
const { loginAll } = require('./helpers/auth')
const { pool } = require('../config/database')
const { deleteStoredFile } = require('../config/upload')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin'])
})

test.after(async () => {
  await server.close()
})

function toSettingsPayload(row, overrides = {}) {
  return {
    systemName: row.system_name,
    systemDescription: row.system_description,
    defaultInternshipPeriodId: row.default_internship_period_id,
    allowStudentRegistration: Boolean(row.allow_student_registration),
    lecturerWeight: row.lecturer_weight,
    companyWeight: row.company_weight,
    ...overrides,
  }
}

// Admin tạo trực tiếp (bypass ownership/department-filter chỉ là UI, service không chặn) — dùng
// student_id=12 (studentD, KHÔNG có internship nào trong seed), period_id=3 (upcoming, không closed).
async function createInternship() {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 3 },
  })
  assert.equal(create.status, 201, `Tạo internship fixture thất bại: ${JSON.stringify(create.body)}`)
  return create.body.data.id
}

async function assignAndStartInProgress(internshipId, { companyId = 4, lecturerId = 1, mentorId = 7 } = {}) {
  const assign = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: tokens.admin.token,
    body: { company_id: companyId, lecturer_id: lecturerId, company_mentor_id: mentorId },
  })
  assert.equal(assign.status, 200, `Phân công thất bại: ${JSON.stringify(assign.body)}`)

  const toApproved = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: tokens.admin.token,
    body: { status: 'approved' },
  })
  assert.equal(toApproved.status, 200)

  const toInProgress = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: tokens.admin.token,
    body: { status: 'in_progress' },
  })
  assert.equal(toInProgress.status, 200)
}

async function createPublishedEvaluation(internshipId, evaluatorRole, score) {
  const create = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.admin.token,
    body: {
      internship_id: internshipId,
      evaluator_role: evaluatorRole,
      attitude_score: score,
      skill_score: score,
      progress_score: score,
      discipline_score: score,
    },
  })
  assert.equal(create.status, 201, `Tạo evaluation thất bại: ${JSON.stringify(create.body)}`)
  const evaluationId = create.body.data.id
  const publish = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
    token: tokens.admin.token,
    body: { is_published: true },
  })
  assert.equal(publish.status, 200)
  return evaluationId
}

async function submitApprovedFinalReport(internshipId) {
  const submit = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.admin.token,
    formData: buildReportFormData(
      { internship_id: internshipId, report_type: 'final' },
      { filename: 'bao-cao-tong-ket-invariant-test.pdf' },
    ),
  })
  assert.equal(submit.status, 201, `Nộp báo cáo thất bại: ${JSON.stringify(submit.body)}`)
  const reportId = submit.body.data.id
  const storedFileName = submit.body.data.stored_file_name

  const approve = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportId}`, {
    token: tokens.admin.token,
    body: { status: 'approved' },
  })
  assert.equal(approve.status, 200)
  return { reportId, storedFileName }
}

// Dọn fixture bằng SQL trực tiếp — internship đã 'completed' thì KHÔNG xóa được qua API (đúng thiết
// kế, và đúng cả bất biến mới của đợt test này) — CASCADE tự xóa evaluations/reports/logs liên quan
// (schema.sql mục 10-12). File vật lý trên đĩa phải tự xóa riêng (CASCADE không đụng filesystem).
async function cleanupInternship(internshipId, storedFileName) {
  if (storedFileName) {
    await deleteStoredFile(storedFileName)
  }
  await pool.execute('DELETE FROM internships WHERE id = ?', [internshipId])
}

// ---- Fixture dùng chung cho cả nhóm test: 1 hồ sơ 'completed' đầy đủ điều kiện ----

async function buildCompletedFixture() {
  const internshipId = await createInternship()
  await assignAndStartInProgress(internshipId)
  const lecturerEvalId = await createPublishedEvaluation(internshipId, 'lecturer', 8)
  const companyEvalId = await createPublishedEvaluation(internshipId, 'company', 6)
  const { reportId, storedFileName } = await submitApprovedFinalReport(internshipId)

  const completed = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
    token: tokens.admin.token,
    body: { status: 'completed' },
  })
  assert.equal(completed.status, 200, `Chuyển completed thất bại: ${JSON.stringify(completed.body)}`)

  return { internshipId, lecturerEvalId, companyEvalId, reportId, storedFileName, completedData: completed.body.data }
}

test('Completed: chuyển sang completed phải CHỐT NGAY final_score/final_classification trong response', async () => {
  const fixture = await buildCompletedFixture()
  try {
    // lecturer=8, company=6, trọng số mặc định 60/40 -> (8*60+6*40)/100 = (480+240)/100 = 7.2
    assert.equal(fixture.completedData.final_score, '7.2')
    assert.equal(fixture.completedData.final_classification, 'Khá')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: KHÔNG cho bỏ công bố đánh giá (409), kể cả Admin', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const unpublish = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${fixture.lecturerEvalId}`, {
      token: tokens.admin.token,
      body: { is_published: false },
    })
    assert.equal(unpublish.status, 409)

    const [[row]] = await pool.query('SELECT is_published FROM evaluations WHERE id = ?', [fixture.lecturerEvalId])
    assert.equal(row.is_published, 1, 'is_published không được đổi trong DB')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: KHÔNG cho xóa đánh giá (409), kể cả Admin', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const remove = await apiRequest(server.baseUrl, 'DELETE', `/evaluations/${fixture.companyEvalId}`, {
      token: tokens.admin.token,
    })
    assert.equal(remove.status, 409)

    const [[row]] = await pool.query('SELECT id FROM evaluations WHERE id = ?', [fixture.companyEvalId])
    assert.ok(row, 'Đánh giá không được bị xóa khỏi DB')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: KHÔNG cho đổi status báo cáo tổng kết đã duyệt (409), kể cả Admin', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const changeStatus = await apiRequest(server.baseUrl, 'PUT', `/reports/${fixture.reportId}`, {
      token: tokens.admin.token,
      body: { status: 'rejected' },
    })
    assert.equal(changeStatus.status, 409)

    const [[row]] = await pool.query('SELECT status FROM reports WHERE id = ?', [fixture.reportId])
    assert.equal(row.status, 'approved', 'status báo cáo không được đổi trong DB')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: KHÔNG cho xóa báo cáo tổng kết đã duyệt (409), kể cả Admin', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const remove = await apiRequest(server.baseUrl, 'DELETE', `/reports/${fixture.reportId}`, {
      token: tokens.admin.token,
    })
    assert.equal(remove.status, 409)

    const [[row]] = await pool.query('SELECT id FROM reports WHERE id = ?', [fixture.reportId])
    assert.ok(row, 'Báo cáo không được bị xóa khỏi DB')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: KHÔNG cho gỡ (null) company_id/lecturer_id/company_mentor_id (409 mỗi field)', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const nullCompany = await apiRequest(server.baseUrl, 'PUT', `/internships/${fixture.internshipId}`, {
      token: tokens.admin.token,
      body: { company_id: null },
    })
    assert.equal(nullCompany.status, 409)

    const nullLecturer = await apiRequest(server.baseUrl, 'PUT', `/internships/${fixture.internshipId}`, {
      token: tokens.admin.token,
      body: { lecturer_id: null },
    })
    assert.equal(nullLecturer.status, 409)

    const nullMentor = await apiRequest(server.baseUrl, 'PUT', `/internships/${fixture.internshipId}`, {
      token: tokens.admin.token,
      body: { company_mentor_id: null },
    })
    assert.equal(nullMentor.status, 409)

    const [[row]] = await pool.query(
      'SELECT company_id, lecturer_id, company_mentor_id FROM internships WHERE id = ?',
      [fixture.internshipId],
    )
    assert.ok(row.company_id && row.lecturer_id && row.company_mentor_id, 'Không field nào được gỡ về null trong DB')
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('Completed: đổi trọng số Settings SAU KHI hoàn thành KHÔNG làm đổi điểm đã chốt', async () => {
  const fixture = await buildCompletedFixture()
  try {
    const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
    const original = before.body.data

    try {
      // Đổi hẳn sang trọng số RẤT khác (90/10) — nếu bị tính lại "sống" thì final_score chắc chắn đổi
      // (lecturer=8 chiếm 90% thay vì 60%).
      const changeWeights = await apiRequest(server.baseUrl, 'PUT', '/settings', {
        token: tokens.admin.token,
        body: toSettingsPayload(original, { lecturerWeight: 90, companyWeight: 10 }),
      })
      assert.equal(changeWeights.status, 200)

      const finalResult = await apiRequest(server.baseUrl, 'GET', `/internships/${fixture.internshipId}/final-result`, {
        token: tokens.admin.token,
      })
      assert.equal(finalResult.status, 200)
      assert.equal(finalResult.body.data.finalScore, 7.2, 'Điểm đã chốt KHÔNG được đổi dù trọng số Settings vừa đổi')
      assert.equal(finalResult.body.data.classification, 'Khá')
    } finally {
      const restore = await apiRequest(server.baseUrl, 'PUT', '/settings', {
        token: tokens.admin.token,
        body: toSettingsPayload(original),
      })
      assert.equal(restore.status, 200)
    }
  } finally {
    await cleanupInternship(fixture.internshipId, fixture.storedFileName)
  }
})

test('In_progress (CHƯA completed): KHÔNG cho gỡ null, nhưng ĐƯỢC đổi sang người khác', async () => {
  const internshipId = await createInternship()
  try {
    await assignAndStartInProgress(internshipId, { companyId: 4, lecturerId: 1, mentorId: 7 })

    const nullLecturer = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { lecturer_id: null },
    })
    assert.equal(nullLecturer.status, 409, 'in_progress cũng phải chặn gỡ null, không chỉ completed')

    const swapLecturer = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { lecturer_id: 3 },
    })
    assert.equal(swapLecturer.status, 200, 'Đổi SANG giảng viên khác (active) vẫn phải được phép khi in_progress')
    assert.equal(swapLecturer.body.data.lecturer_id, 3)
  } finally {
    await pool.execute('DELETE FROM internships WHERE id = ?', [internshipId])
  }
})
