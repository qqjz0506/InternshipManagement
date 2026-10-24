require('dotenv').config()

// Kiểm tra cấu hình production TRƯỚC khi require bất kỳ module nào khác (fail fast) — JWT_SECRET
// thiếu/quá ngắn, CLIENT_URL thiếu, hoặc DEBUG_ERRORS=true trong production là lỗi cấu hình nghiêm
// trọng, không nên để server chạy "có vẻ ổn" rồi mới lộ ra khi có request thật. Không ảnh hưởng
// NODE_ENV khác 'production' (xem server/config/productionChecks.js — trả về [] ngay nếu không phải
// production).
const { assertProductionConfig } = require('./config/productionChecks')
try {
  assertProductionConfig()
} catch (error) {
  console.error('[server] Không thể khởi động:', error.message)
  process.exit(1)
}

const app = require('./app')
const { testConnection } = require('./config/database')
const { startReminderScheduler } = require('./jobs/reminderJob')

const PORT = process.env.PORT || 5000

async function start() {
  try {
    await testConnection()
    console.log('Database connected successfully.')
  } catch (error) {
    console.error('Database connection failed:', error.message)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`)
  })

  // REMINDER_JOB_ENABLED phải = 'true' tường minh mới chạy (an toàn theo mặc định, giống MAIL_ENABLED)
  // — và luôn tắt khi NODE_ENV=test (test suite tự gọi runReminderJob() trực tiếp khi cần, không cần
  // scheduler nền chạy song song gây nhiễu thời điểm test).
  if (process.env.REMINDER_JOB_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
    startReminderScheduler()
    console.log('Reminder job scheduler started (chạy mỗi ngày 8:00 theo APP_TIMEZONE).')
  }
}

start()
