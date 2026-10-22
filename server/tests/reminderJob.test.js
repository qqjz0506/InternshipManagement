require('dotenv').config()
const test = require('node:test')
const assert = require('node:assert/strict')
const { pool } = require('../config/database')
const reminderService = require('../services/reminderService')
const { runReminderJob } = require('../jobs/reminderJob')

// Ground truth (không đoán, verify trực tiếp từ server/db/seed.sql):
//   internships.id=1: student_id=1 (user_id=2, "student@example.com"), lecturer_id=1 (user_id=3,
//     "lecturer@example.com"), company_mentor_id=1 (user_id=9, "company2@example.com"),
//     period_id=2, status='in_progress'.
//   internship_logs: internship_id=1 có 2 log, MAX(log_date) = '2025-03-10'.
//   reports: internship_id=1 chỉ có 1 báo cáo 'weekly' (KHÔNG có 'final') -> hasActiveFinalReport=false.
//   evaluations: internship_id=1 có evaluator_role='lecturer' is_published=1 (ĐÃ công bố), KHÔNG có
//     evaluator_role='company' -> evaluationDueLecturer luôn false, evaluationDueCompany tùy deadline.
//   internship_periods.id=2: log_frequency_days=7 (DEFAULT, seed không set) — dùng thẳng, không cần sửa.

let originalPeriod

test.before(async () => {
  const [[row]] = await pool.execute(
    'SELECT final_report_deadline, evaluation_deadline FROM internship_periods WHERE id = 2',
  )
  originalPeriod = row
  // Đặt tạm deadline cho period 2 để test có giá trị cố định, không phụ thuộc ngày thật lúc chạy test.
  await pool.execute(
    'UPDATE internship_periods SET final_report_deadline = ?, evaluation_deadline = ? WHERE id = 2',
    ['2025-03-25', '2025-03-25'],
  )
})

test.after(async () => {
  await pool.execute(
    'UPDATE internship_periods SET final_report_deadline = ?, evaluation_deadline = ? WHERE id = 2',
    [originalPeriod.final_report_deadline, originalPeriod.evaluation_deadline],
  )
  await pool.end()
})

function findIssue(issues, internshipId) {
  return issues.find((issue) => issue.internshipId === internshipId)
}

test('computeAllIssues: chưa quá hạn (now=2025-03-15, 5 ngày từ log cuối, còn 10 ngày tới deadline)', async () => {
  const issues = await reminderService.computeAllIssues(new Date('2025-03-15T00:00:00Z'))
  const issue1 = findIssue(issues, 1)
  assert.ok(issue1, 'Phải tìm thấy issue của internship id=1')
  assert.equal(issue1.logOverdue.isOverdue, false)
  assert.equal(issue1.logOverdue.daysSinceLastLog, 5)
  assert.equal(issue1.finalReportDue.isDue, false)
  assert.equal(issue1.evaluationDueCompany.isDue, false)
  assert.equal(issue1.evaluationDueLecturer.isDue, false, 'Lecturer đã công bố đánh giá -> không bao giờ due')
})

test('computeAllIssues: quá hạn nhật ký + sắp hết hạn báo cáo final/đánh giá (now=2025-03-21)', async () => {
  const issues = await reminderService.computeAllIssues(new Date('2025-03-21T00:00:00Z'))
  const issue1 = findIssue(issues, 1)
  assert.equal(issue1.logOverdue.isOverdue, true)
  assert.equal(issue1.logOverdue.daysSinceLastLog, 11)
  assert.equal(issue1.finalReportDue.isDue, true, 'Chưa có báo cáo final + còn 4 ngày tới hạn -> due')
  assert.equal(issue1.finalReportDue.daysUntilDeadline, 4)
  assert.equal(issue1.evaluationDueCompany.isDue, true, 'Mentor chưa đánh giá + còn 4 ngày tới hạn -> due')
  assert.equal(issue1.evaluationDueLecturer.isDue, false, 'Lecturer đã công bố đánh giá -> vẫn không due')
})

test('runReminderJob: gửi đúng notify cho Student/Lecturer/Company Mentor, KHÔNG gửi trùng khi chạy 2 lần', async () => {
  const now = new Date('2025-03-21T00:00:00Z')
  const sentDate = '2025-03-21'
  const keysToCheck = [
    ['log_overdue:internship:1', 2],
    ['log_overdue:internship:1:lecturer', 3],
    ['log_overdue:internship:1:company', 9],
    ['final_report_due:internship:1', 2],
    ['final_report_due:internship:1:lecturer', 3],
    ['final_report_due:internship:1:company', 9],
    ['evaluation_due:internship:1:company', 9],
  ]

  async function countRows() {
    const [[{ count }]] = await pool.query(
      `SELECT COUNT(*) AS count FROM reminder_logs WHERE sent_date = ? AND (${keysToCheck
        .map(() => '(user_id = ? AND reminder_key = ?)')
        .join(' OR ')})`,
      [sentDate, ...keysToCheck.flatMap(([key, userId]) => [userId, key])],
    )
    return count
  }

  const [[{ maxNotificationId }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxNotificationId FROM notifications')

  try {
    const before = await countRows()
    assert.equal(before, 0, 'Chưa chạy job thì chưa có reminder_logs cho các key này')

    const firstRun = await runReminderJob(now)
    assert.equal(await countRows(), keysToCheck.length, 'Phải tạo đủ reminder_logs cho cả 7 trường hợp')
    assert.ok(firstRun.sent >= keysToCheck.length, 'sent phải tính cả 7 trường hợp này (có thể còn nội dung khác từ internship khác)')

    const secondRun = await runReminderJob(now)
    assert.equal(await countRows(), keysToCheck.length, 'Chạy lần 2 KHÔNG được tạo thêm reminder_logs trùng')
    assert.ok(secondRun.skipped >= keysToCheck.length, 'Lần 2 toàn bộ 7 trường hợp này phải bị skip (đã gửi)')

    const [[{ notifCount }]] = await pool.query(
      "SELECT COUNT(*) AS notifCount FROM notifications WHERE id > ? AND type = 'reminder' AND user_id IN (2, 3, 9)",
      [maxNotificationId],
    )
    assert.equal(notifCount, keysToCheck.length, 'Phải có đúng 7 notification mới (không trùng) cho 3 user này')
  } finally {
    await pool.execute(
      `DELETE FROM reminder_logs WHERE sent_date = ? AND (${keysToCheck.map(() => '(user_id = ? AND reminder_key = ?)').join(' OR ')})`,
      [sentDate, ...keysToCheck.flatMap(([key, userId]) => [userId, key])],
    )
    await pool.execute('DELETE FROM notifications WHERE id > ?', [maxNotificationId])
  }
})
