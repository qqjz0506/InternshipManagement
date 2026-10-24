const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const healthRoutes = require('./routes/healthRoutes')
const authRoutes = require('./routes/authRoutes')
const departmentRoutes = require('./routes/departmentRoutes')
const studentRoutes = require('./routes/studentRoutes')
const lecturerRoutes = require('./routes/lecturerRoutes')
const companyRoutes = require('./routes/companyRoutes')
const companyMentorRoutes = require('./routes/companyMentorRoutes')
const internshipPeriodRoutes = require('./routes/internshipPeriodRoutes')
const topicRoutes = require('./routes/topicRoutes')
const internshipRoutes = require('./routes/internshipRoutes')
const internshipLogRoutes = require('./routes/internshipLogRoutes')
const reportRoutes = require('./routes/reportRoutes')
const evaluationRoutes = require('./routes/evaluationRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const userRoutes = require('./routes/userRoutes')
const exportRoutes = require('./routes/exportRoutes')
const statisticsRoutes = require('./routes/statisticsRoutes')
const importRoutes = require('./routes/importRoutes')
const reminderRoutes = require('./routes/reminderRoutes')
const internshipPositionRoutes = require('./routes/internshipPositionRoutes')
const positionApplicationRoutes = require('./routes/positionApplicationRoutes')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')

const app = express()

// trust proxy: số hop reverse proxy phía TRƯỚC app (Nginx...) — CẦN để express-rate-limit
// (loginLimiter/passwordResetLimiter) đọc đúng IP client thật từ X-Forwarded-For, không bị tính
// chung IP của proxy cho MỌI người (vừa sai vừa dễ bị 1 người chặn hết người khác). Dùng SỐ HOP cụ
// thể (không dùng `true`/trust tất cả — express-rate-limit khuyến cáo không làm vậy vì
// X-Forwarded-For có thể bị giả mạo nếu không giới hạn đúng số hop tin cậy). Mặc định KHÔNG set —
// dev chạy trực tiếp không qua proxy nào, hành vi giữ nguyên như cũ.
if (process.env.TRUST_PROXY_HOPS) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS))
}

app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/lecturers', lecturerRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/company-mentors', companyMentorRoutes)
app.use('/api/internship-periods', internshipPeriodRoutes)
app.use('/api/topics', topicRoutes)
app.use('/api/internships', internshipRoutes)
app.use('/api/internship-logs', internshipLogRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/evaluations', evaluationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/users', userRoutes)
app.use('/api/exports', exportRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/imports', importRoutes)
app.use('/api/reminders', reminderRoutes)
app.use('/api/internship-positions', internshipPositionRoutes)
app.use('/api/position-applications', positionApplicationRoutes)

// Phục vụ luôn bản build của client (client/dist) khi NODE_ENV=production — để triển khai thật chỉ
// cần chạy 1 server (xem docs/TRIEN_KHAI.md), KHÔNG đổi cách chạy dev hiện tại (dev vẫn là 2 server
// riêng: Vite ở 5173 + Express ở 5000, client/dist không tồn tại/không được dùng tới lúc dev).
// Đặt SAU toàn bộ route /api/* nhưng TRƯỚC notFoundHandler: route "*" tự next() nếu path bắt đầu
// bằng /api (để request API không khớp route nào vẫn ra đúng 404 JSON qua notFoundHandler, không bị
// fallback này trả nhầm thành index.html).
if (process.env.NODE_ENV === 'production') {
  const CLIENT_DIST_DIR = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(CLIENT_DIST_DIR))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
