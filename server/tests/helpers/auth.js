const { apiRequest } = require('./http')

// Tài khoản seed THẬT (server/db/seed.sql, plaintext test password theo docs/API_PHASE_3A.md mục 9)
// — không tạo account mới chỉ để test, không hardcode password mới.
const SEED_ACCOUNTS = {
  admin: { email: 'admin@example.com', password: 'admin123' },
  studentA: { email: 'student@example.com', password: 'student123' }, // students.id=1, internships.id=1
  studentB: { email: 'student2@example.com', password: 'student123' }, // students.id=5, internships.id=4
  lecturerA: { email: 'lecturer@example.com', password: 'lecturer123' }, // lecturers.id=1, supervises internships.id=1
  lecturerB: { email: 'lecturer2@example.com', password: 'lecturer123' }, // lecturers.id=3, supervises internships.id=4
  mentorA: { email: 'company@example.com', password: 'company123' },
  mentorB: { email: 'company2@example.com', password: 'company123' },
  // students.id=12, KHÔNG có internship nào trong seed — dùng để test tạo/xóa fixture tạm thời
  // (Phase "Business Rules V2") mà không đụng dữ liệu seed cố định của các test khác.
  studentD: { email: 'student4@example.com', password: 'student123' },
}

async function loginAs(baseUrl, key) {
  const creds = SEED_ACCOUNTS[key]
  if (!creds) {
    throw new Error(`Unknown seed account key: ${key}`)
  }
  const { status, body } = await apiRequest(baseUrl, 'POST', '/auth/login', {
    body: { email: creds.email, password: creds.password },
  })
  if (status !== 200) {
    throw new Error(`Login failed for ${key} (${creds.email}): HTTP ${status} ${JSON.stringify(body)}`)
  }
  return { token: body.data.accessToken, user: body.data.user }
}

// Login tất cả account seed cần cho 1 test file, trả object { key: {token, user} }.
async function loginAll(baseUrl, keys) {
  const result = {}
  for (const key of keys) {
    result[key] = await loginAs(baseUrl, key)
  }
  return result
}

module.exports = { SEED_ACCOUNTS, loginAs, loginAll }
