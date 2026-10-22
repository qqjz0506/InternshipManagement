const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')
const { buildReportFormData } = require('./helpers/fileFixtures')

let server
let tokens
let originalDeadline

// Ground truth: internships.id=1 (student A, period_id=2) KHÔNG có báo cáo 'final' nào trong seed
// (chỉ có 1 báo cáo 'weekly') -> được phép nộp mới report_type='final'. Dùng mốc ngày 2020/2099 —
// chắc chắn nằm NGOÀI mọi khoảng thời gian chạy test thực tế (is_late tính theo todayDateString()
// thật, không mock được ở tầng này — khác với reminderJob.test.js dùng `now` mock trực tiếp qua
// reminderService).

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA'])
  const [[row]] = await pool.execute('SELECT final_report_deadline FROM internship_periods WHERE id = 2')
  originalDeadline = row.final_report_deadline
})

test.after(async () => {
  await pool.execute('UPDATE internship_periods SET final_report_deadline = ? WHERE id = 2', [originalDeadline])
  await server.close()
})

async function submitFinalReport() {
  return apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'final' },
      { filename: 'bao-cao-tong-ket-late-flag-test.pdf', content: '%PDF-1.4 test is_late', mimeType: 'application/pdf' },
    ),
  })
}

async function cleanupReport(reportId) {
  const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
  assert.equal(cleanup.status, 200)
}

test('Nộp báo cáo final SAU final_report_deadline của đợt -> is_late=true', async () => {
  await pool.execute("UPDATE internship_periods SET final_report_deadline = '2020-01-01' WHERE id = 2")
  const res = await submitFinalReport()
  try {
    assert.equal(res.status, 201)
    assert.equal(res.body.data.is_late, 1, 'Nộp sau hạn (2020-01-01 đã qua từ lâu) phải đánh dấu is_late')
  } finally {
    await cleanupReport(res.body.data.id)
  }
})

test('Nộp báo cáo final TRƯỚC final_report_deadline của đợt -> is_late=false', async () => {
  await pool.execute("UPDATE internship_periods SET final_report_deadline = '2099-01-01' WHERE id = 2")
  const res = await submitFinalReport()
  try {
    assert.equal(res.status, 201)
    assert.equal(res.body.data.is_late, 0, 'Nộp trước hạn (2099-01-01 còn rất xa) phải is_late=0')
  } finally {
    await cleanupReport(res.body.data.id)
  }
})

test('Nộp báo cáo weekly KHÔNG tính is_late dù đã qua final_report_deadline', async () => {
  await pool.execute("UPDATE internship_periods SET final_report_deadline = '2020-01-01' WHERE id = 2")
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'bao-cao-tuan-late-flag-test.pdf', content: '%PDF-1.4 test weekly', mimeType: 'application/pdf' },
    ),
  })
  try {
    assert.equal(res.status, 201)
    assert.equal(res.body.data.is_late, 0, 'Báo cáo tuần không có khái niệm hạn, luôn is_late=0')
  } finally {
    await cleanupReport(res.body.data.id)
  }
})

test('Client gửi kèm is_late khi tạo báo cáo -> 400 (do hệ thống tự tính)', async () => {
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly', is_late: 'true' },
      { filename: 'bao-cao-tuan-reject-is-late.pdf', content: '%PDF-1.4 test reject is_late', mimeType: 'application/pdf' },
    ),
  })
  assert.equal(res.status, 400)
})
