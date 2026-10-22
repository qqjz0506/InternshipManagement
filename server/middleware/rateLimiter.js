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

module.exports = { loginLimiter }
