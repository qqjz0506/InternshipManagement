const { pool } = require('../config/database')
const notificationService = require('../services/notificationService')
const reminderService = require('../services/reminderService')
const { todayDateString, getAppTimezone } = require('../utils/dateTime')

const RUN_HOUR = 8 // 8:00 sáng theo APP_TIMEZONE
const CHECK_INTERVAL_MS = 15 * 60 * 1000 // kiểm tra mỗi 15 phút có tới giờ chạy chưa

// Claim-ticket: INSERT trước vào reminder_logs, CHỈ gửi notify()/email nếu INSERT thành công (nghĩa
// là CHƯA gửi reminder_key này cho user_id này trong ngày hôm nay) — chống gửi trùng dựa vào chính
// UNIQUE constraint của DB (an toàn kể cả job chạy lại nhiều lần/server restart giữa ngày), KHÔNG chỉ
// dựa vào cờ in-memory (xem server/db/migrations/010_reminder_logs.sql).
async function claimAndNotify({ userId, reminderKey, title, content }, sentDate) {
  try {
    await pool.execute(
      'INSERT INTO reminder_logs (user_id, reminder_key, sent_date) VALUES (?, ?, ?)',
      [userId, reminderKey, sentDate],
    )
  } catch (error) {
    if (error.errno === 1062) {
      return false // đã gửi reminder_key này cho user_id này hôm nay rồi — bỏ qua êm
    }
    throw error
  }
  await notificationService.notify({ userId, type: 'reminder', title, content })
  return true
}

// Sinh danh sách notify cần gửi từ `issues` (kết quả reminderService.computeAllIssues()) — gửi cho
// Student (vấn đề của chính mình: log/báo cáo final) VÀ Lecturer/Company Mentor (vấn đề của SV mình
// phụ trách: log/báo cáo final/đánh giá đúng evaluator_role của mình). KHÔNG gửi riêng cho Admin —
// Admin đã có overview tổng hợp trên Dashboard (Mục 16J README), gửi thêm notify cá nhân cho Admin
// không có hành động cụ thể nào để làm, dễ gây spam không cần thiết.
function buildNotificationTasks(issues) {
  const tasks = []

  issues.forEach((issue) => {
    if (issue.logOverdue.isOverdue) {
      const message = reminderService.buildLogOverdueMessage(issue)
      const title = `Nhắc nhở: SV ${issue.studentName} chưa ghi nhật ký thực tập`
      if (issue.studentUserId) {
        tasks.push({
          userId: issue.studentUserId,
          reminderKey: `log_overdue:internship:${issue.internshipId}`,
          title: 'Nhắc nhở: chưa ghi nhật ký thực tập',
          content: message,
        })
      }
      if (issue.lecturerUserId) {
        tasks.push({ userId: issue.lecturerUserId, reminderKey: `log_overdue:internship:${issue.internshipId}:lecturer`, title, content: message })
      }
      if (issue.companyMentorUserId) {
        tasks.push({ userId: issue.companyMentorUserId, reminderKey: `log_overdue:internship:${issue.internshipId}:company`, title, content: message })
      }
    }

    if (issue.finalReportDue.isDue) {
      const message = reminderService.buildFinalReportMessage(issue)
      const title = `Nhắc nhở: hạn nộp báo cáo tổng kết của SV ${issue.studentName}`
      if (issue.studentUserId) {
        tasks.push({
          userId: issue.studentUserId,
          reminderKey: `final_report_due:internship:${issue.internshipId}`,
          title: 'Nhắc nhở: hạn nộp báo cáo tổng kết',
          content: message,
        })
      }
      if (issue.lecturerUserId) {
        tasks.push({ userId: issue.lecturerUserId, reminderKey: `final_report_due:internship:${issue.internshipId}:lecturer`, title, content: message })
      }
      if (issue.companyMentorUserId) {
        tasks.push({ userId: issue.companyMentorUserId, reminderKey: `final_report_due:internship:${issue.internshipId}:company`, title, content: message })
      }
    }

    if (issue.evaluationDueLecturer.isDue && issue.lecturerUserId) {
      tasks.push({
        userId: issue.lecturerUserId,
        reminderKey: `evaluation_due:internship:${issue.internshipId}:lecturer`,
        title: `Nhắc nhở: hạn đánh giá SV ${issue.studentName}`,
        content: reminderService.buildEvaluationMessage(issue.evaluationDueLecturer),
      })
    }
    if (issue.evaluationDueCompany.isDue && issue.companyMentorUserId) {
      tasks.push({
        userId: issue.companyMentorUserId,
        reminderKey: `evaluation_due:internship:${issue.internshipId}:company`,
        title: `Nhắc nhở: hạn đánh giá SV ${issue.studentName}`,
        content: reminderService.buildEvaluationMessage(issue.evaluationDueCompany),
      })
    }
  })

  return tasks
}

// Job chạy xong trả về { sent, skipped } — dùng cho test + log khi chạy tay (npm run reminders:run).
async function runReminderJob(now = new Date()) {
  const issues = await reminderService.computeAllIssues(now)
  const tasks = buildNotificationTasks(issues)
  const sentDate = todayDateString(now)

  let sent = 0
  let skipped = 0
  for (const task of tasks) {
    const didSend = await claimAndNotify(task, sentDate)
    if (didSend) sent += 1
    else skipped += 1
  }
  return { sent, skipped, totalIssues: issues.length }
}

function getCurrentHour(now) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: getAppTimezone(), hour: 'numeric', hour12: false })
  return Number(formatter.format(now))
}

let lastRunDate = null
let intervalHandle = null

// Scheduler tối giản (KHÔNG dùng node-cron — tránh thêm dependency chỉ để chạy 1 việc/ngày): kiểm
// tra mỗi 15 phút, chỉ chạy job khi giờ hiện tại (theo APP_TIMEZONE) = 8 VÀ chưa chạy cho ngày hôm
// nay (tối ưu, không bắt buộc đúng — UNIQUE constraint ở reminder_logs mới là chốt chặn trùng thật).
function startReminderScheduler() {
  if (intervalHandle) {
    return // đã start rồi, không start 2 lần
  }
  intervalHandle = setInterval(() => {
    const now = new Date()
    const today = todayDateString(now)
    if (getCurrentHour(now) === RUN_HOUR && lastRunDate !== today) {
      lastRunDate = today
      runReminderJob(now).catch((error) => {
        console.error('reminderJob: chạy job thất bại (sẽ thử lại ở lần kiểm tra kế tiếp):', error)
      })
    }
  }, CHECK_INTERVAL_MS)
}

function stopReminderScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

module.exports = { runReminderJob, startReminderScheduler, stopReminderScheduler }
