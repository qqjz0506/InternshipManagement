// Chạy job nhắc việc 1 LẦN thủ công (demo/vận hành) — không cần chờ tới 8:00 sáng hoặc bật
// REMINDER_JOB_ENABLED. Dùng: npm run reminders:run (server/package.json).
require('dotenv').config()
const { runReminderJob } = require('../jobs/reminderJob')
const { pool } = require('../config/database')

async function main() {
  try {
    const result = await runReminderJob()
    console.log(
      `[reminders:run] Đã kiểm tra ${result.totalIssues} hồ sơ in_progress — gửi ${result.sent} nhắc việc mới, bỏ qua ${result.skipped} (đã gửi hôm nay).`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[reminders:run] Lỗi:', error)
  process.exitCode = 1
})
