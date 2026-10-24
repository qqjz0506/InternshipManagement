const test = require('node:test')
const assert = require('node:assert/strict')
const { pool, tableCount, foreignKeyCount, rowCount } = require('./helpers/db')

// Smoke test tự động hoá lại đúng các kiểm tra COUNT(*) thủ công đã chạy lặp đi lặp lại qua mọi
// phase trước (Phase 4E-3 → Phase 6A) — KHÔNG dùng information_schema.TABLE_ROWS (đã biết là estimate
// sai sau crash-recovery, xem các doc trước) — chỉ dùng COUNT(*) thật.

const EXPECTED_BASELINE = {
  users: 10,
  departments: 4,
  internship_periods: 3,
  students: 14,
  lecturers: 10,
  companies: 10,
  company_mentors: 7,
  topics: 10,
  internships: 12,
  internship_logs: 3,
  reports: 4,
  evaluations: 6,
  notifications: 13,
  settings: 1,
  password_reset_tokens: 0,
  reminder_logs: 0,
  internship_positions: 0,
  position_applications: 0,
}

test.after(async () => {
  await pool.end()
})

test('DB integrity: đúng 18 bảng', async () => {
  assert.equal(await tableCount(), 18)
})

test('DB integrity: đúng 25 foreign keys', async () => {
  assert.equal(await foreignKeyCount(), 25)
})

for (const [table, expected] of Object.entries(EXPECTED_BASELINE)) {
  test(`DB integrity: ${table} = ${expected} (baseline)`, async () => {
    assert.equal(await rowCount(table), expected)
  })
}

test('DB integrity: không có orphan FK (students/lecturers/internships -> bảng tham chiếu)', async () => {
  const [[row]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM students s LEFT JOIN departments d ON s.department_id = d.id WHERE d.id IS NULL) AS orphan_students_dept,
      (SELECT COUNT(*) FROM internships i LEFT JOIN students s ON i.student_id = s.id WHERE s.id IS NULL) AS orphan_internships_student,
      (SELECT COUNT(*) FROM internships i LEFT JOIN internship_periods p ON i.period_id = p.id WHERE p.id IS NULL) AS orphan_internships_period,
      (SELECT COUNT(*) FROM internship_logs l LEFT JOIN internships i ON l.internship_id = i.id WHERE i.id IS NULL) AS orphan_logs,
      (SELECT COUNT(*) FROM evaluations e LEFT JOIN internships i ON e.internship_id = i.id WHERE i.id IS NULL) AS orphan_evaluations,
      (SELECT COUNT(*) FROM notifications n LEFT JOIN users u ON n.user_id = u.id WHERE u.id IS NULL) AS orphan_notifications
  `)
  for (const [key, value] of Object.entries(row)) {
    assert.equal(value, 0, `${key} phải bằng 0`)
  }
})

test('DB integrity: không có user bị link chéo nhiều loại profile', async () => {
  const [rows] = await pool.query(`
    SELECT user_id, COUNT(*) AS cnt FROM (
      SELECT user_id FROM students WHERE user_id IS NOT NULL
      UNION ALL SELECT user_id FROM lecturers WHERE user_id IS NOT NULL
      UNION ALL SELECT user_id FROM company_mentors WHERE user_id IS NOT NULL
    ) t GROUP BY user_id HAVING COUNT(*) > 1
  `)
  assert.equal(rows.length, 0, 'Không có user_id nào xuất hiện ở nhiều hơn 1 loại profile')
})

test('DB integrity: không có duplicate evaluation per (internship_id, evaluator_role)', async () => {
  const [rows] = await pool.query(`
    SELECT internship_id, evaluator_role, COUNT(*) AS cnt FROM evaluations
    GROUP BY internship_id, evaluator_role HAVING COUNT(*) > 1
  `)
  assert.equal(rows.length, 0)
})
