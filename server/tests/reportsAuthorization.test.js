const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp (Phase 7B):
//   reports.id=1 -> internship_id=1 (Student A / Lecturer A / Mentor B), report_type='weekly'
//   reports.id=2 -> internship_id=4 (Student B / Lecturer B), report_type='weekly'

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA', 'lecturerB', 'mentorB'])
})

test.after(async () => {
  await server.close()
})

test('Reports: internship_id/report_type/file_name/submitted_at đều immutable khi PUT -> 400 mỗi field', async () => {
  for (const field of [
    { internship_id: 999 },
    { report_type: 'final' },
    { file_name: 'khac.pdf' },
    { submitted_at: '2026-01-01' },
  ]) {
    const res = await apiRequest(server.baseUrl, 'PUT', '/reports/1', { token: tokens.admin.token, body: field })
    assert.equal(res.status, 400, `Field ${JSON.stringify(field)} phải bị reject`)
  }
})

test('Reports: Student không PUT được field ngoài file_name, dù là báo cáo của chính mình (403)', async () => {
  // Trước "Business Rules V2": route PUT /reports/:id chặn hẳn role student (403 route-level).
  // Từ rule mới (Student nộp lại báo cáo 'rejected'), route đã mở cho student — nhưng reports.id=1
  // đang 'approved' (không phải 'rejected') nên vẫn bị chặn, giờ ở TẦNG SERVICE (business rule:
  // "chỉ nộp lại khi đang rejected"), không còn là route-level nữa — vẫn cùng status code 403.
  const res = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
    token: tokens.studentA.token,
    body: { reviewer_comment: 'Sinh viên tự sửa' },
  })
  assert.equal(res.status, 403)
})

test('Reports: Lecturer sửa field ngoài whitelist (status, reviewer_comment) -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
    token: tokens.lecturerA.token,
    body: { company_comment: 'Giảng viên không được sửa field này' },
  })
  assert.equal(res.status, 403)
})

test('Reports: Company Mentor sửa field ngoài whitelist (chỉ company_comment) -> 403', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
    token: tokens.mentorB.token,
    body: { reviewer_comment: 'Mentor không được sửa field này' },
  })
  assert.equal(res.status, 403)
})

test('Reports: Lecturer B không sửa được báo cáo thuộc phạm vi Lecturer A (403, cross-scope)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
    token: tokens.lecturerB.token,
    body: { reviewer_comment: 'Ngoài phạm vi' },
  })
  assert.equal(res.status, 403)
})

test('Reports: Lecturer A duyệt hợp lệ báo cáo thuộc phạm vi mình (200), khôi phục lại giá trị cũ', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/reports/1', { token: tokens.lecturerA.token })
  assert.equal(before.status, 200)
  const originalStatus = before.body.data.status
  const originalComment = before.body.data.reviewer_comment

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
      token: tokens.lecturerA.token,
      body: { status: 'approved', reviewer_comment: 'Nhận xét test Phase 7B' },
    })
    assert.equal(update.status, 200)
    assert.equal(update.body.data.status, 'approved')
    assert.equal(update.body.data.reviewer_comment, 'Nhận xét test Phase 7B')
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/reports/1', {
      token: tokens.admin.token,
      body: { status: originalStatus, reviewer_comment: originalComment },
    })
    assert.equal(restore.status, 200)
    assert.equal(restore.body.data.status, originalStatus, 'Phải khôi phục đúng status gốc')
    assert.equal(restore.body.data.reviewer_comment, originalComment, 'Phải khôi phục đúng reviewer_comment gốc')
  }
})
