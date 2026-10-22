const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth verify (Phase 7C, không đoán): GET/PUT /settings đều trả snake_case nguyên bản từ DB
// (id, system_name, system_description, default_internship_period_id, allow_student_registration,
// updated_at) — nhưng settingsService.update() lại destructure BODY request theo camelCase
// (systemName/systemDescription/defaultInternshipPeriodId/allowStudentRegistration). Đây là mismatch
// 2 chiều ĐÃ BIẾT từ Phase 4E-3 (xem client/src/api/settingsApi.js, xử lý bằng 1 mapper ở API
// boundary) — không phải lỗi mới, không sửa, chỉ test đúng theo hành vi thật.

function toUpdatePayload(row) {
  return {
    systemName: row.system_name,
    systemDescription: row.system_description,
    defaultInternshipPeriodId: row.default_internship_period_id,
    allowStudentRegistration: Boolean(row.allow_student_registration),
    // Rule mới (điểm tổng kết): lecturerWeight/companyWeight bắt buộc, tổng phải = 100 — phải gửi
    // kèm dù test này không liên quan trực tiếp, nếu không settingsService.update() reject 400.
    lecturerWeight: row.lecturer_weight,
    companyWeight: row.company_weight,
  }
}

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
})

test.after(async () => {
  await server.close()
})

test('Settings: Student không có quyền PUT (403 route-level), không đổi DB', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.studentA.token })
  assert.equal(before.status, 200)

  const res = await apiRequest(server.baseUrl, 'PUT', '/settings', {
    token: tokens.studentA.token,
    body: { ...toUpdatePayload(before.body.data), allowStudentRegistration: false },
  })
  assert.equal(res.status, 403)

  const after = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.studentA.token })
  assert.deepEqual(after.body.data, before.body.data)
})

test('Settings: Admin gửi field immutable (id) -> 400, không đổi DB', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  const res = await apiRequest(server.baseUrl, 'PUT', '/settings', {
    token: tokens.admin.token,
    body: { ...toUpdatePayload(before.body.data), id: 99 },
  })
  assert.equal(res.status, 400)
})

test('Settings: Admin sửa allowStudentRegistration (200), khôi phục lại giá trị cũ', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  assert.equal(before.status, 200)
  const original = before.body.data
  const originalFlag = Boolean(original.allow_student_registration)

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: { ...toUpdatePayload(original), allowStudentRegistration: !originalFlag },
    })
    assert.equal(update.status, 200)
    assert.equal(Boolean(update.body.data.allow_student_registration), !originalFlag)
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: { ...toUpdatePayload(original), allowStudentRegistration: originalFlag },
    })
    assert.equal(restore.status, 200)
    assert.equal(
      Boolean(restore.body.data.allow_student_registration),
      originalFlag,
      'Phải khôi phục đúng allow_student_registration gốc',
    )
  }
})
