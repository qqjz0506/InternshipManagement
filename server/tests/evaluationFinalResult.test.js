// Test "Điểm tổng kết thực tập" (final internship score): công thức tính điểm, xếp loại, ràng buộc
// tổng trọng số lecturer_weight + company_weight = 100, và quyền xem (sinh viên chỉ thấy khi CẢ HAI
// đánh giá đã công bố). Dùng server Express THẬT (startTestServer) + JWT thật — không mock.
//
// Ground truth từ seed có sẵn (không đoán, verify bằng SQL trực tiếp trước khi viết test này):
//   internships.id=1  (student A, internships của studentA) -> chỉ có evaluation lecturer đã công bố,
//                      KHÔNG có evaluation company -> final-result phải là null.
//   internships.id=9  -> evaluation lecturer=8.3 (published) + company=8.3 (published) — ĐIỂM BẰNG
//                      NHAU -> final score luôn = 8.3 bất kể tỉ lệ trọng số hiện tại ("equal-score trick").
//   internships.id=10 -> evaluation lecturer=7.8 (published) + company=7.6 (published) — điểm KHÁC
//                      nhau -> dùng để verify công thức có áp dụng ĐÚNG trọng số hiện tại (không phải
//                      chỉ trung bình thường).
//
// students.id=12 (user_id=8, login student4@example.com="studentD") KHÔNG có internship nào trong
// seed -> dùng làm fixture tạo/xóa tạm (đúng convention đã dùng ở businessRulesV2.test.js).
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('../config/database')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentD'])
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

// Tạo 1 internship 'in_progress' cho student_id=12 (studentD), period_id=3 (upcoming, không bị
// closed) — mirror đúng flow assign+approved+in_progress đã dùng ở businessRulesV2.test.js
// ("Rule 4b"), company_id=1/lecturer_id=2/company_mentor_id=1 là combo hợp lệ đã verify ở đó.
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

// Tạo + công bố 1 evaluation (evaluator_role) với 4 điểm thành phần BẰNG NHAU = score -> overall_score
// = score chính xác (trung bình 4 số bằng nhau = số đó) — dùng để test xếp loại tại các mốc chính xác.
async function createPublishedEvaluation(adminToken, internshipId, evaluatorRole, score) {
  const create = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: adminToken,
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
    token: adminToken,
    body: { is_published: true },
  })
  assert.equal(publish.status, 200)
  assert.equal(Number(publish.body.data.overall_score), score)

  return evaluationId
}

// Xóa trực tiếp qua SQL (KHÔNG qua DELETE /internships/:id — route đó chỉ cho xóa khi status=pending,
// nhưng fixture của ta luôn ở 'in_progress' để tạo evaluation được). evaluations có ON DELETE CASCADE
// theo internship_id (schema.sql mục 12) -> xóa internship tự xóa luôn evaluation liên quan.
async function deleteInternshipFixture(internshipId) {
  await pool.execute('DELETE FROM internships WHERE id = ?', [internshipId])
}

// ---- Công thức điểm tổng kết (dùng đúng ground-truth seed internships 9/10) ----

test('Final result: cả 2 đánh giá công bố với điểm BẰNG NHAU -> final score = điểm đó (bất kể trọng số hiện tại)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/internships/9/final-result', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.finalScore, 8.3)
  assert.equal(res.body.data.classification, 'Giỏi')
})

test('Final result: công thức áp dụng ĐÚNG trọng số hiện tại (không phải trung bình thường) khi 2 điểm khác nhau', async () => {
  const settingsRes = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.equal(settingsRes.status, 200)
  const lecturerWeight = Number(settingsRes.body.data.lecturer_weight)
  const companyWeight = Number(settingsRes.body.data.company_weight)
  assert.equal(lecturerWeight + companyWeight, 100)

  // internships.id=10: lecturer=7.8 (published), company=7.6 (published) — verify bằng SQL trực tiếp
  // trước khi so sánh, không tin lại comment cũ.
  const [[lecturerEval]] = await pool.query(
    "SELECT overall_score FROM evaluations WHERE internship_id = 10 AND evaluator_role = 'lecturer'",
  )
  const [[companyEval]] = await pool.query(
    "SELECT overall_score FROM evaluations WHERE internship_id = 10 AND evaluator_role = 'company'",
  )
  const expected = Math.round((Number(lecturerEval.overall_score) * lecturerWeight + Number(companyEval.overall_score) * companyWeight) / 10) / 10

  const res = await apiRequest(server.baseUrl, 'GET', '/internships/10/final-result', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.finalScore, expected)
})

// ---- Chưa đủ 2 đánh giá công bố -> null (data-availability gate, áp dụng mọi role) ----

test('Final result: chỉ 1 đánh giá công bố -> data = null, kể cả khi Admin xem (internships.id=1)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/internships/1/final-result', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data, null)
})

test('Final result: sinh viên xem hồ sơ CHÍNH MÌNH nhưng chưa đủ 2 đánh giá công bố -> data = null (không lỗi)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/internships/1/final-result', { token: tokens.studentA.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data, null)
})

// ---- Scope: sinh viên không được xem final-result của hồ sơ KHÔNG phải của mình ----

test('Final result: sinh viên xem hồ sơ của người khác -> 403 (IDOR-style, mirror GET /internships/:id)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/internships/9/final-result', { token: tokens.studentA.token })
  assert.equal(res.status, 403)
})

// ---- Fixture thật: sinh viên chỉ thấy final-result khi CẢ HAI đánh giá của HỒ SƠ CHÍNH MÌNH đã công bố ----

test('Final result: sinh viên thấy đúng điểm tổng kết của chính mình NGAY SAU KHI cả 2 đánh giá được công bố', async () => {
  const internshipId = await createInProgressInternship(tokens.admin.token)
  const evaluationIds = []

  try {
    // Trước khi có evaluation nào: phải là null với cả Admin và chính studentD.
    const before = await apiRequest(server.baseUrl, 'GET', `/internships/${internshipId}/final-result`, {
      token: tokens.studentD.token,
    })
    assert.equal(before.status, 200)
    assert.equal(before.body.data, null)

    evaluationIds.push(await createPublishedEvaluation(tokens.admin.token, internshipId, 'lecturer', 9))
    // Mới công bố 1/2 -> vẫn phải null.
    const onlyOnePublished = await apiRequest(server.baseUrl, 'GET', `/internships/${internshipId}/final-result`, {
      token: tokens.studentD.token,
    })
    assert.equal(onlyOnePublished.status, 200)
    assert.equal(onlyOnePublished.body.data, null)

    evaluationIds.push(await createPublishedEvaluation(tokens.admin.token, internshipId, 'company', 9))

    const after = await apiRequest(server.baseUrl, 'GET', `/internships/${internshipId}/final-result`, {
      token: tokens.studentD.token,
    })
    assert.equal(after.status, 200)
    assert.equal(after.body.data.finalScore, 9)
    assert.equal(after.body.data.classification, 'Xuất sắc')
  } finally {
    await deleteInternshipFixture(internshipId)
  }
})

// ---- Xếp loại theo mốc (equal-score trick: 4 điểm thành phần bằng nhau = overall_score chính xác) ----

const CLASSIFICATION_CASES = [
  { score: 9, label: 'Xuất sắc' },
  { score: 8, label: 'Giỏi' },
  { score: 6.5, label: 'Khá' },
  { score: 5, label: 'Trung bình' },
  { score: 4.9, label: 'Không đạt' },
]

for (const { score, label } of CLASSIFICATION_CASES) {
  test(`Xếp loại: điểm tổng kết = ${score} -> "${label}"`, async () => {
    const internshipId = await createInProgressInternship(tokens.admin.token)
    try {
      await createPublishedEvaluation(tokens.admin.token, internshipId, 'lecturer', score)
      await createPublishedEvaluation(tokens.admin.token, internshipId, 'company', score)

      const res = await apiRequest(server.baseUrl, 'GET', `/internships/${internshipId}/final-result`, {
        token: tokens.admin.token,
      })
      assert.equal(res.status, 200)
      assert.equal(res.body.data.finalScore, score)
      assert.equal(res.body.data.classification, label)
    } finally {
      await deleteInternshipFixture(internshipId)
    }
  })
}

// ---- Ràng buộc tổng trọng số = 100 (settingsService.update, 2 lớp: validate app + CHECK constraint DB) ----

test('Settings: lecturerWeight + companyWeight != 100 -> 400, không đổi DB', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.equal(before.status, 200)
  const original = before.body.data

  const res = await apiRequest(server.baseUrl, 'PUT', '/settings', {
    token: tokens.admin.token,
    body: toSettingsPayload(original, { lecturerWeight: 70, companyWeight: 40 }),
  })
  assert.equal(res.status, 400)

  const after = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.deepEqual(after.body.data, original, 'Request 400 không được làm đổi DB')
})

test('Settings: trọng số âm hoặc thiếu field -> 400', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  const original = before.body.data

  const negative = await apiRequest(server.baseUrl, 'PUT', '/settings', {
    token: tokens.admin.token,
    body: toSettingsPayload(original, { lecturerWeight: -10, companyWeight: 110 }),
  })
  assert.equal(negative.status, 400)

  const payloadMissingWeight = toSettingsPayload(original)
  delete payloadMissingWeight.companyWeight
  const missing = await apiRequest(server.baseUrl, 'PUT', '/settings', {
    token: tokens.admin.token,
    body: payloadMissingWeight,
  })
  assert.equal(missing.status, 400)
})

test('Settings: lecturerWeight + companyWeight = 100 (hợp lệ, khác giá trị gốc) -> 200, khôi phục lại giá trị cũ', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.equal(before.status, 200)
  const original = before.body.data
  const originalLecturerWeight = Number(original.lecturer_weight)
  const originalCompanyWeight = Number(original.company_weight)
  // Chọn giá trị mới chắc chắn khác giá trị gốc (hoán đổi) để test thực sự verify đổi được, không
  // phải coincidentally giữ nguyên.
  const newLecturerWeight = originalCompanyWeight
  const newCompanyWeight = originalLecturerWeight

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: toSettingsPayload(original, { lecturerWeight: newLecturerWeight, companyWeight: newCompanyWeight }),
    })
    assert.equal(update.status, 200)
    assert.equal(Number(update.body.data.lecturer_weight), newLecturerWeight)
    assert.equal(Number(update.body.data.company_weight), newCompanyWeight)
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: toSettingsPayload(original, { lecturerWeight: originalLecturerWeight, companyWeight: originalCompanyWeight }),
    })
    assert.equal(restore.status, 200)
    assert.equal(Number(restore.body.data.lecturer_weight), originalLecturerWeight)
    assert.equal(Number(restore.body.data.company_weight), originalCompanyWeight)
  }
})
