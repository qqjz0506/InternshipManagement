const { pool } = require('../config/database')
const scopeService = require('./scopeService')
const { todayDateString } = require('../utils/dateTime')

// Ngưỡng "sắp đến hạn" dùng chung cho final_report_deadline VÀ evaluation_deadline (đúng yêu cầu
// "còn ≤ 7 ngày hoặc đã quá hạn" cho báo cáo final — áp dụng NHẤT QUÁN cho đánh giá, không có ngưỡng
// riêng khác vì yêu cầu không nêu rõ số khác).
const DEADLINE_WARNING_DAYS = 7

// So 2 chuỗi ngày "YYYY-MM-DD" — parse theo UTC 00:00 (giống isValidDate ở utils/validators.js) để
// không phụ thuộc múi giờ máy chủ. Dương = toDate ở SAU fromDate.
function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(`${fromDateStr}T00:00:00Z`)
  const to = new Date(`${toDateStr}T00:00:00Z`)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

// Toàn bộ hồ sơ thực tập đang 'in_progress' kèm thông tin đợt (log_frequency_days/deadline) + sinh
// viên — nguồn DUY NHẤT cho mọi tính toán nhắc việc (API lẫn job), tránh lệch logic giữa 2 nơi dùng.
async function getInProgressInternships() {
  const [rows] = await pool.query(`
    SELECT
      i.id, i.student_id, i.lecturer_id, i.company_mentor_id, i.start_date, i.end_date,
      p.id AS period_id, p.period_code, p.period_name,
      p.log_frequency_days, p.final_report_deadline, p.evaluation_deadline,
      s.student_code, s.full_name AS student_name, s.user_id AS student_user_id,
      l.user_id AS lecturer_user_id, cm.user_id AS company_mentor_user_id
    FROM internships i
    JOIN internship_periods p ON p.id = i.period_id
    JOIN students s ON s.id = i.student_id
    LEFT JOIN lecturers l ON l.id = i.lecturer_id
    LEFT JOIN company_mentors cm ON cm.id = i.company_mentor_id
    WHERE i.status = 'in_progress'
  `)
  return rows
}

// Bulk fetch (tránh N+1 — đúng convention đã áp dụng ở exportService.js mục 29) — ngày nhật ký mới
// nhất, có báo cáo final đang active (status != 'rejected') hay không, trạng thái công bố đánh giá
// theo từng evaluator_role, cho TOÀN BỘ internship 1 lần.
async function getBulkContext(internshipIds) {
  if (internshipIds.length === 0) {
    return { lastLogDates: new Map(), activeFinalReports: new Set(), evaluations: new Map() }
  }
  const placeholders = internshipIds.map(() => '?').join(', ')

  const [logRows] = await pool.query(
    `SELECT internship_id, MAX(log_date) AS last_log_date FROM internship_logs
     WHERE internship_id IN (${placeholders}) GROUP BY internship_id`,
    internshipIds,
  )
  const lastLogDates = new Map(logRows.map((row) => [row.internship_id, row.last_log_date]))

  const [reportRows] = await pool.query(
    `SELECT DISTINCT internship_id FROM reports
     WHERE report_type = 'final' AND status != 'rejected' AND internship_id IN (${placeholders})`,
    internshipIds,
  )
  const activeFinalReports = new Set(reportRows.map((row) => row.internship_id))

  const [evalRows] = await pool.query(
    `SELECT internship_id, evaluator_role, is_published FROM evaluations
     WHERE evaluator_role IN ('lecturer', 'company') AND internship_id IN (${placeholders})`,
    internshipIds,
  )
  const evaluations = new Map()
  evalRows.forEach((row) => {
    if (!evaluations.has(row.internship_id)) {
      evaluations.set(row.internship_id, {})
    }
    evaluations.get(row.internship_id)[row.evaluator_role] = Boolean(row.is_published)
  })

  return { lastLogDates, activeFinalReports, evaluations }
}

// Tính đầy đủ "vấn đề" (issues) của TỪNG hồ sơ thực tập 'in_progress' tại thời điểm `now` — dùng
// chung cho overview API (lọc theo scope role) và job nhắc việc (gửi notify). `now`: Date, cho test
// mock được 1 thời điểm cụ thể (giống server/utils/dateTime.js todayDateString).
async function computeAllIssues(now = new Date()) {
  const today = todayDateString(now)
  const internships = await getInProgressInternships()
  const internshipIds = internships.map((row) => row.id)
  const { lastLogDates, activeFinalReports, evaluations } = await getBulkContext(internshipIds)

  return internships.map((row) => {
    const lastLogDate = lastLogDates.get(row.id) ?? null
    const referenceDate = lastLogDate ?? row.start_date
    const daysSinceLastLog = daysBetween(referenceDate, today)
    const logOverdue = daysSinceLastLog > row.log_frequency_days

    const hasActiveFinalReport = activeFinalReports.has(row.id)
    const daysUntilFinalReportDeadline = row.final_report_deadline
      ? daysBetween(today, row.final_report_deadline)
      : null
    const finalReportDue =
      !hasActiveFinalReport &&
      daysUntilFinalReportDeadline !== null &&
      daysUntilFinalReportDeadline <= DEADLINE_WARNING_DAYS

    const daysUntilEvaluationDeadline = row.evaluation_deadline ? daysBetween(today, row.evaluation_deadline) : null
    const evalPublished = evaluations.get(row.id) ?? {}
    const evaluationDueLecturer =
      !evalPublished.lecturer && daysUntilEvaluationDeadline !== null && daysUntilEvaluationDeadline <= DEADLINE_WARNING_DAYS
    const evaluationDueCompany =
      !evalPublished.company && daysUntilEvaluationDeadline !== null && daysUntilEvaluationDeadline <= DEADLINE_WARNING_DAYS

    return {
      internshipId: row.id,
      studentId: row.student_id,
      studentCode: row.student_code,
      studentName: row.student_name,
      studentUserId: row.student_user_id,
      lecturerId: row.lecturer_id,
      lecturerUserId: row.lecturer_user_id,
      companyMentorId: row.company_mentor_id,
      companyMentorUserId: row.company_mentor_user_id,
      periodId: row.period_id,
      periodCode: row.period_code,
      periodName: row.period_name,
      logOverdue: { isOverdue: logOverdue, daysSinceLastLog, frequencyDays: row.log_frequency_days, lastLogDate },
      finalReportDue: {
        isDue: finalReportDue,
        hasActiveFinalReport,
        deadline: row.final_report_deadline,
        daysUntilDeadline: daysUntilFinalReportDeadline,
      },
      evaluationDueLecturer: { isDue: evaluationDueLecturer, deadline: row.evaluation_deadline, daysUntilDeadline: daysUntilEvaluationDeadline },
      evaluationDueCompany: { isDue: evaluationDueCompany, deadline: row.evaluation_deadline, daysUntilDeadline: daysUntilEvaluationDeadline },
    }
  })
}

function buildLogOverdueMessage(issue) {
  return issue.logOverdue.lastLogDate
    ? `Đã ${issue.logOverdue.daysSinceLastLog} ngày chưa có nhật ký mới (quy định tối đa ${issue.logOverdue.frequencyDays} ngày/lần).`
    : `Chưa ghi nhật ký nào từ khi bắt đầu thực tập (đã ${issue.logOverdue.daysSinceLastLog} ngày, quy định tối đa ${issue.logOverdue.frequencyDays} ngày/lần).`
}

function buildFinalReportMessage(issue) {
  return issue.finalReportDue.daysUntilDeadline < 0
    ? `Báo cáo tổng kết đã QUÁ HẠN ${-issue.finalReportDue.daysUntilDeadline} ngày (hạn ${issue.finalReportDue.deadline}).`
    : `Báo cáo tổng kết còn ${issue.finalReportDue.daysUntilDeadline} ngày tới hạn (${issue.finalReportDue.deadline}), chưa nộp.`
}

function buildEvaluationMessage(detail) {
  return detail.daysUntilDeadline < 0
    ? `Đánh giá đã QUÁ HẠN ${-detail.daysUntilDeadline} ngày (hạn ${detail.deadline}).`
    : `Đánh giá còn ${detail.daysUntilDeadline} ngày tới hạn (${detail.deadline}), chưa làm/chưa công bố.`
}

// Student: CHỈ vấn đề của chính hồ sơ mình (log_overdue + final_report_due — Student không tạo đánh
// giá nên không có evaluation_due ở đây).
async function getOverviewForStudent(currentUser, now = new Date()) {
  const studentProfile = await scopeService.getStudentProfile(currentUser.id)
  const allIssues = await computeAllIssues(now)
  const mine = allIssues.find((issue) => issue.studentId === studentProfile?.id)

  const items = []
  if (mine?.logOverdue.isOverdue) {
    items.push({ key: 'log_overdue', message: buildLogOverdueMessage(mine) })
  }
  if (mine?.finalReportDue.isDue) {
    items.push({ key: 'final_report_due', message: buildFinalReportMessage(mine) })
  }
  return { role: 'student', items }
}

// Lecturer/Company Mentor: danh sách SINH VIÊN mình phụ trách đang có ít nhất 1 vấn đề — mỗi sinh
// viên kèm danh sách vấn đề (có thể nhiều vấn đề cùng lúc).
async function getOverviewForSupervisor(currentUser, role, now = new Date()) {
  const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
  const ownId = role === 'lecturer' ? ownIds.lecturerId : ownIds.companyMentorId
  const matchField = role === 'lecturer' ? 'lecturerId' : 'companyMentorId'
  const evaluationDueField = role === 'lecturer' ? 'evaluationDueLecturer' : 'evaluationDueCompany'

  const allIssues = await computeAllIssues(now)
  const mine = allIssues.filter((issue) => issue[matchField] === ownId)

  const items = mine
    .map((issue) => {
      const studentIssues = []
      if (issue.logOverdue.isOverdue) {
        studentIssues.push({ key: 'log_overdue', message: buildLogOverdueMessage(issue) })
      }
      if (issue.finalReportDue.isDue) {
        studentIssues.push({ key: 'final_report_due', message: buildFinalReportMessage(issue) })
      }
      if (issue[evaluationDueField].isDue) {
        studentIssues.push({ key: 'evaluation_due', message: buildEvaluationMessage(issue[evaluationDueField]) })
      }
      return {
        internshipId: issue.internshipId,
        studentCode: issue.studentCode,
        studentName: issue.studentName,
        issues: studentIssues,
      }
    })
    .filter((entry) => entry.issues.length > 0)

  return { role, items }
}

// Admin: tổng hợp SỐ LƯỢNG theo từng đợt (không liệt kê từng sinh viên — Admin xem chi tiết qua các
// trang quản lý hồ sơ/báo cáo/đánh giá sẵn có, overview này chỉ để biết đợt nào đang "nóng").
async function getOverviewForAdmin(now = new Date()) {
  const allIssues = await computeAllIssues(now)
  const byPeriod = new Map()

  allIssues.forEach((issue) => {
    if (!byPeriod.has(issue.periodId)) {
      byPeriod.set(issue.periodId, {
        periodId: issue.periodId,
        periodCode: issue.periodCode,
        periodName: issue.periodName,
        logOverdueCount: 0,
        finalReportDueCount: 0,
        evaluationDueCount: 0,
      })
    }
    const bucket = byPeriod.get(issue.periodId)
    if (issue.logOverdue.isOverdue) bucket.logOverdueCount += 1
    if (issue.finalReportDue.isDue) bucket.finalReportDueCount += 1
    if (issue.evaluationDueLecturer.isDue || issue.evaluationDueCompany.isDue) bucket.evaluationDueCount += 1
  })

  return { role: 'admin', items: [...byPeriod.values()] }
}

async function getOverview(currentUser, now = new Date()) {
  if (currentUser.role === 'student') return getOverviewForStudent(currentUser, now)
  if (currentUser.role === 'lecturer') return getOverviewForSupervisor(currentUser, 'lecturer', now)
  if (currentUser.role === 'company_mentor') return getOverviewForSupervisor(currentUser, 'company_mentor', now)
  return getOverviewForAdmin(now)
}

module.exports = {
  DEADLINE_WARNING_DAYS,
  daysBetween,
  computeAllIssues,
  getOverview,
  buildLogOverdueMessage,
  buildFinalReportMessage,
  buildEvaluationMessage,
}
