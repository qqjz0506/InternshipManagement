const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens
let fixtureInternshipId

// Ground truth (seed.sql): internships.id=1 -> student_id=1 ("studentA"), status='in_progress',
// company_id=1 -> đủ điều kiện xuất giấy giới thiệu. internships.id=3 -> student_id=3, status=
// 'pending', company_id=NULL -> KHÔNG đủ điều kiện (test 409). Không có internship 'completed' nào
// trong seed gắn với sinh viên CÓ tài khoản đăng nhập (students.id=4/8 — cả 2 user_id=NULL) nên tự
// tạo 1 fixture 'completed' tạm cho studentD (students.id=12, user_id=8) để test phiếu kết quả qua
// HTTP thật — dọn sạch ở test.after.

async function fetchPdf(path, token) {
  const res = await fetch(`${server.baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const buffer = Buffer.from(await res.arrayBuffer())
  return { status: res.status, contentType: res.headers.get('content-type'), buffer }
}

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentB', 'studentD', 'lecturerA'])

  const [result] = await pool.execute(
    `INSERT INTO internships
      (student_id, period_id, company_id, company_mentor_id, lecturer_id, start_date, end_date, status, progress, final_score, final_classification)
     VALUES (12, 3, 1, 1, 1, '2025-09-01', '2026-01-15', 'completed', 100, 8.5, 'Giỏi')`,
  )
  fixtureInternshipId = result.insertId
  await pool.query(
    `INSERT INTO evaluations
      (internship_id, evaluator_role, attitude_score, skill_score, progress_score, discipline_score, overall_score, comment, is_published, published_at)
     VALUES
      (?, 'lecturer', 8, 8.5, 9, 8, 8.4, 'Sinh viên làm việc tốt.', 1, '2026-01-10'),
      (?, 'company', 9, 8, 8.5, 9, 8.6, 'Chăm chỉ, chủ động.', 1, '2026-01-10')`,
    [fixtureInternshipId, fixtureInternshipId],
  )
})

test.after(async () => {
  await pool.execute('DELETE FROM evaluations WHERE internship_id = ?', [fixtureInternshipId])
  await pool.execute('DELETE FROM internships WHERE id = ?', [fixtureInternshipId])
  await server.close()
})

test('GET introduction-letter.pdf: hồ sơ in_progress + có company -> 200, đúng content-type + %PDF', async () => {
  const res = await fetchPdf('/internships/1/documents/introduction-letter.pdf', tokens.studentA.token)
  assert.equal(res.status, 200)
  assert.equal(res.contentType, 'application/pdf')
  assert.equal(res.buffer.slice(0, 5).toString(), '%PDF-')
})

test('GET introduction-letter.pdf: hồ sơ pending/chưa có company -> 409', async () => {
  const res = await fetchPdf('/internships/3/documents/introduction-letter.pdf', tokens.admin.token)
  assert.equal(res.status, 409)
})

test('GET introduction-letter.pdf: Student khác KHÔNG tải được giấy giới thiệu của hồ sơ không phải của mình -> 403', async () => {
  const res = await fetchPdf('/internships/1/documents/introduction-letter.pdf', tokens.studentB.token)
  assert.equal(res.status, 403)
})

test('GET result-sheet.pdf: hồ sơ completed -> 200, đúng content-type + %PDF (Admin)', async () => {
  const res = await fetchPdf(`/internships/${fixtureInternshipId}/documents/result-sheet.pdf`, tokens.admin.token)
  assert.equal(res.status, 200)
  assert.equal(res.contentType, 'application/pdf')
  assert.equal(res.buffer.slice(0, 5).toString(), '%PDF-')
})

test('GET result-sheet.pdf: chính Student sở hữu hồ sơ completed -> 200', async () => {
  const res = await fetchPdf(`/internships/${fixtureInternshipId}/documents/result-sheet.pdf`, tokens.studentD.token)
  assert.equal(res.status, 200)
  assert.equal(res.buffer.slice(0, 5).toString(), '%PDF-')
})

test('GET result-sheet.pdf: Student khác KHÔNG tải được phiếu kết quả của người khác -> 403', async () => {
  const res = await fetchPdf(`/internships/${fixtureInternshipId}/documents/result-sheet.pdf`, tokens.studentA.token)
  assert.equal(res.status, 403)
})

test('GET result-sheet.pdf: hồ sơ CHƯA completed (in_progress) -> 409', async () => {
  const res = await fetchPdf('/internships/1/documents/result-sheet.pdf', tokens.lecturerA.token)
  assert.equal(res.status, 409)
})

test('GET documents: thiếu token -> 401', async () => {
  const res = await fetchPdf('/internships/1/documents/introduction-letter.pdf', null)
  assert.equal(res.status, 401)
})
