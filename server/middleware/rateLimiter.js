const rateLimit = require('express-rate-limit')

// Giới hạn POST /api/auth/login: 10 lần / 15 phút / IP — chống brute-force mật khẩu. Tắt hẳn khi
// NODE_ENV=test (test suite đăng nhập rất nhiều lần/file, không liên quan gì tới brute-force thật).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 15 phút.',
    })
  },
})

// Giới hạn forgot-password/reset-password: 10 lần / 15 phút / IP — cùng mức với loginLimiter (chống
// spam email + chống brute-force token reset). Dùng chung 1 limiter cho cả 2 endpoint (cùng nhóm
// hành động "tự phục vụ khôi phục mật khẩu", không cần tách riêng 2 bộ đếm). Tắt khi NODE_ENV=test,
// cùng lý do với loginLimiter.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.',
    })
  },
})

module.exports = { loginLimiter, passwordResetLimiter }
