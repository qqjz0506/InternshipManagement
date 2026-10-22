const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp (Phase 7B):
//   internship_logs.id=1 -> internship_id=1 (Student A / Lecturer A / Mentor B), status='submitted'...
//     thực ra id=1 status='reviewed' (xem Phase 6B), id=2 status='submitted' cùng internship_id=1.
//   internship_logs.id=3 -> internship_id=4 (Student B / Lecturer B), status='reviewed'.
//   internships.id=1 status='in_progress' (điều kiện bắt buộc để tạo log mới).
//   internships.id=3 status='pending' (KHÔNG in_progress — dùng để test business rule tạo log).
//   company_mentors.id=1 (user_id=9 = mentorB) -> company_mentor_id trên internships.id=1.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA', 'lecturerB', 'mentorB'])
})

test.after(async () => {
  await server.close()
})

test('Logs: Student tạo log với lecturer_comment kèm theo -> 400, không tạo row', async () => {
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.studentA.token,
    body: {
      internship_id: 1,
      log_date: '2026-01-01',
      title: 'Test log',
      content: 'Nội dung test',
      lecturer_comment: 'Không được phép set field này lúc tạo',
    },
  })
  assert.equal(res.status, 400)
})

test('Logs: tạo log khi internship KHÔNG ở trạng thái in_progress -> 409 (áp dụng cả Admin)', async () => {
  // internships.id=3 đang 'pending' — business rule áp dụng vô điều kiện, không phân biệt role.
  const res = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.admin.token,
    body: {
      internship_id: 3,
      log_date: '2026-01-01',
      title: 'Test log trên internship chưa in_progress',
      content: 'Nội dung test',
    },
  })
  assert.equal(res.status, 409)
})

test('Logs: Lecturer A không sửa được log thuộc internship do Lecturer B phụ trách (403)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/3', {
    token: tokens.lecturerA.token,
    body: { status: 'reviewed' },
  })
  assert.equal(res.status, 403)
})

test('Logs: Lecturer sửa field ngoài whitelist (lecturer_comment, status) -> 403', async () => {
  // internship_logs.id=2 thuộc internships.id=1 (đúng phạm vi Lecturer A), nhưng "content" không nằm
  // trong LECTURER_EDITABLE_FIELDS.
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
    token: tokens.lecturerA.token,
    body: { content: 'Giảng viên không được sửa nội dung' },
  })
  assert.equal(res.status, 403)
})

test('Logs: Company Mentor sửa field ngoài whitelist (chỉ company_comment) -> 403', async () => {
  // company_mentors.id=1 (mentorB) đúng phạm vi internships.id=1 -> internship_logs.id=2.
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
    token: tokens.mentorB.token,
    body: { lecturer_comment: 'Mentor không được sửa field này' },
  })
  assert.equal(res.status, 403)
})

test('Logs: Student không sửa được field nội dung ngoài whitelist của chính mình (vd. gửi internship_id) -> 400', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
    token: tokens.studentA.token,
    body: { internship_id: 4 },
  })
  assert.equal(res.status, 400)
})

test('Logs: Student A không đọc/sửa được log của Student B qua gọi API trực tiếp (403, không bypass bằng URL)', async () => {
  const getRes = await apiRequest(server.baseUrl, 'GET', '/internship-logs/3', { token: tokens.studentA.token })
  assert.equal(getRes.status, 403)

  const putRes = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/3', {
    token: tokens.studentA.token,
    body: { content: 'Cố sửa log của người khác' },
  })
  assert.equal(putRes.status, 403)
})

test('Logs: Lecturer A nhận xét hợp lệ log thuộc phạm vi mình (200), khôi phục lại giá trị cũ', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/internship-logs/2', { token: tokens.lecturerA.token })
  assert.equal(before.status, 200)
  const originalComment = before.body.data.lecturer_comment

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
      token: tokens.lecturerA.token,
      body: { lecturer_comment: 'Nhận xét test Phase 7B' },
    })
    assert.equal(update.status, 200)
    assert.equal(update.body.data.lecturer_comment, 'Nhận xét test Phase 7B')
  } finally {
    // Khôi phục qua SQL trực tiếp, KHÔNG qua API: internshipLogService.update() tự chuẩn hóa chuỗi
    // rỗng ('') thành NULL (resolveOptionalText) — nếu giá trị gốc là '' (đúng seed.sql thật), PUT lại
    // '' sẽ bị ghi thành NULL, không khôi phục đúng byte-for-byte. SQL trực tiếp mới đảm bảo chính xác.
    await pool.execute('UPDATE internship_logs SET lecturer_comment = ? WHERE id = 2', [originalComment])
    const [[row]] = await pool.query('SELECT lecturer_comment FROM internship_logs WHERE id = 2')
    assert.equal(row.lecturer_comment, originalComment, 'Phải khôi phục đúng lecturer_comment gốc')
  }
})

test('Logs: Student A ghi nhật ký mới hợp lệ cho internship đang in_progress của chính mình (201), xóa lại sau test', async () => {
  // internships.id=1 đang 'in_progress' và thuộc Student A — đúng điều kiện bắt buộc để tạo log mới.
  // log_date='2025-04-01' nằm trong [start_date='2025-02-01', end_date='2025-06-15'] của internships.id=1
  // (rule "Business Rules V2": log_date phải nằm trong khoảng thời gian thực tập) và không ở tương lai.
  const create = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.studentA.token,
    body: {
      internship_id: 1,
      log_date: '2025-04-01',
      title: 'Tuần test Phase 7C',
      content: 'Nội dung test tạo log hợp lệ',
    },
  })
  assert.equal(create.status, 201)
  assert.equal(create.body.data.internship_id, 1)
  assert.equal(create.body.data.status, 'submitted')

  const createdId = create.body.data.id
  const remove = await apiRequest(server.baseUrl, 'DELETE', `/internship-logs/${createdId}`, {
    token: tokens.studentA.token,
  })
  assert.equal(remove.status, 200, 'Phải xóa được log vừa tạo (status còn submitted, chưa reviewed)')
})
