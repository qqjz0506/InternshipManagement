// File test TẠM (review độc lập sau prompt 15) — không thuộc suite chính, xóa sau khi review.
// Mỗi test khẳng định HÀNH VI ĐÚNG; test FAIL = lỗi còn tồn tại.
// Chạy: cd server && npx cross-env NODE_ENV=test node --test tests/reviewFindings2.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('./helpers/db')
const { OUTBOX_PATH } = require('../services/mailService')

let server
let t
const periodIds = []

const api = (method, p, token, body) => apiRequest(server.baseUrl, method, p, { token, body })

async function createPeriod(label) {
  const [r] = await pool.execute(
    `INSERT INTO internship_periods (period_code, period_name, start_date, end_date, status)
     VALUES (?, ?, '2031-01-01', '2031-06-30', 'upcoming')`,
    [`RV-${label}-${Date.now()}`.slice(0, 20), `Review ${label}`],
  )
  periodIds.push(r.insertId)
  return r.insertId
}

async function createPosition(periodId, title, slots = 1) {
  const res = await api('POST', '/internship-positions', t.mentorB.token, { period_id: periodId, title, slots })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.data
}

async function apply(positionId) {
  const res = await api('POST', '/position-applications', t.studentD.token, { position_id: positionId })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.data
}

async function internshipOf(periodId) {
  const [rows] = await pool.execute('SELECT * FROM internships WHERE student_id = 12 AND period_id = ?', [periodId])
  return rows[0] ?? null
}

test.before(async () => {
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db')
  if (db !== process.env.DB_NAME_TEST) throw new Error(`Từ chối chạy: đang trỏ vào "${db}"`)
  server = await startTestServer()
  t = await loginAll(server.baseUrl, ['admin', 'mentorA', 'mentorB', 'lecturerA', 'studentD'])
})

test.after(async () => {
  if (periodIds.length) {
    const ph = periodIds.map(() => '?').join(',')
    await pool.execute(`DELETE FROM internships WHERE period_id IN (${ph})`, periodIds)
    await pool.execute(`DELETE FROM internship_periods WHERE id IN (${ph})`, periodIds)
  }
  await server.close()
})

test('[A] Nộp đơn khi hồ sơ pending -> Admin duyệt + in_progress -> mentor khác accept phải 409, hồ sơ giữ nguyên', async () => {
  const periodId = await createPeriod('A')
  const created = await api('POST', '/internships', t.admin.token, { student_id: 12, period_id: periodId })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const internshipId = created.body.data.id

  const position = await createPosition(periodId, 'Vi tri review A')
  const application = await apply(position.id)

  const mentors = (await api('GET', '/company-mentors', t.admin.token)).body.data
  const mentorA = mentors.find((m) => m.email === 'company@example.com' || m.user_id === t.mentorA.user.id)
  const lecturers = (await api('GET', '/lecturers', t.admin.token)).body.data
  const lecturerA = lecturers.find((l) => l.user_id === t.lecturerA.user.id)
  assert.ok(mentorA && lecturerA, 'Không tìm thấy mentorA/lecturerA trong seed')

  for (const body of [
    { company_id: mentorA.company_id, company_mentor_id: mentorA.id, lecturer_id: lecturerA.id },
    { status: 'approved' },
    { status: 'in_progress' },
  ]) {
    const r = await api('PUT', `/internships/${internshipId}`, t.admin.token, body)
    assert.equal(r.status, 200, `Chuẩn bị dữ liệu thất bại ${JSON.stringify(body)}: ${JSON.stringify(r.body)}`)
  }
  const before = await internshipOf(periodId)

  const accept = await api('PUT', `/position-applications/${application.id}/accept`, t.mentorB.token)
  const after = await internshipOf(periodId)
  assert.equal(accept.status, 409, `accept trả ${accept.status} — đáng lẽ phải 409`)
  assert.equal(after.company_id, before.company_id, 'company_id bị ghi đè')
  assert.equal(after.company_mentor_id, before.company_mentor_id, 'company_mentor_id bị ghi đè')
  assert.equal(after.status, 'in_progress')
})

test('[B] Hủy hồ sơ tạo từ đơn accepted -> trả slot, vị trí mở lại', async () => {
  const periodId = await createPeriod('B')
  const position = await createPosition(periodId, 'Vi tri review B', 1)
  const application = await apply(position.id)
  const accept = await api('PUT', `/position-applications/${application.id}/accept`, t.mentorB.token)
  assert.equal(accept.status, 200, JSON.stringify(accept.body))

  const closed = (await api('GET', `/internship-positions/${position.id}`, t.admin.token)).body.data
  assert.equal(closed.status, 'closed', 'Hết slot nhưng vị trí chưa đóng')

  const internship = await internshipOf(periodId)
  const cancel = await api('PUT', `/internships/${internship.id}`, t.admin.token, { status: 'cancelled' })
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body))

  const reopened = (await api('GET', `/internship-positions/${position.id}`, t.admin.token)).body.data
  assert.equal(reopened.status, 'open', 'Hủy hồ sơ nhưng vị trí không mở lại')
  const [[app]] = await pool.execute('SELECT status FROM position_applications WHERE id = ?', [application.id])
  assert.notEqual(app.status, 'accepted', 'Đơn vẫn ở accepted sau khi hồ sơ bị hủy')
})

test('[C] Tên vị trí chứa HTML không lọt nguyên vào email', async () => {
  const periodId = await createPeriod('C')
  const evil = '<a href="https://evil.example/x">Bam vao day</a>'
  const position = await createPosition(periodId, evil)
  const size = fs.existsSync(OUTBOX_PATH) ? fs.statSync(OUTBOX_PATH).size : 0
  await apply(position.id)
  const fresh = fs.readFileSync(OUTBOX_PATH, 'utf8').slice(size)
  const entries = fresh.split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const related = entries.filter((e) => (e.html || '').includes('evil.example'))
  assert.ok(related.length > 0, 'Không thấy email nào nhắc tới vị trí vừa ứng tuyển (kiểm tra lại outbox)')
  for (const e of related) {
    assert.ok(!e.html.includes('<a href="https://evil.example'), `Email gửi ${e.to} chứa thẻ <a> chưa escape`)
  }
})

test('[D] Cấu hình triển khai: không seed tài khoản demo, client mặc định /api', () => {
  const root = path.join(__dirname, '..', '..')
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
  const mountLines = compose.split('\n').filter((l) => l.includes('docker-entrypoint-initdb.d'))
  assert.ok(mountLines.length > 0, 'Không thấy mount initdb trong docker-compose.yml')
  for (const line of mountLines) {
    assert.ok(!/seed\.sql|server\/db:/.test(line), `Mount initdb vẫn có thể chạy seed.sql: ${line.trim()}`)
  }
  const apiClient = fs.readFileSync(path.join(root, 'client', 'src', 'api', 'apiClient.js'), 'utf8')
  assert.ok(!/\|\|\s*['"]http:\/\/localhost:5000/.test(apiClient), 'apiClient vẫn fallback về http://localhost:5000')
})
