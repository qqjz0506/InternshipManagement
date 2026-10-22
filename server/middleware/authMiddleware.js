const jwt = require('jsonwebtoken')
const AppError = require('../utils/AppError')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')

// Route được MIỄN chặn must_change_password — bắt buộc phải tự gọi được GET /auth/me (khôi phục
// session lúc F5) và PUT /auth/change-password (đường DUY NHẤT để thoát khỏi trạng thái này), nếu
// không user sẽ bị kẹt không lối thoát (gọi gì cũng 403 MUST_CHANGE_PASSWORD, kể cả để tự đổi mật
// khẩu). req.baseUrl là tiền tố mount ('/api/auth'), req.path là path tương đối trong router đó
// (đúng path Express thật sự thấy — không dùng req.originalUrl để tránh lệch nếu sau này đổi tiền tố).
function isExemptFromMustChangePassword(req) {
  if (req.baseUrl !== '/api/auth') {
    return false
  }
  return (req.method === 'GET' && req.path === '/me') || (req.method === 'PUT' && req.path === '/change-password')
}

// Phase 3A: chỉ xác thực danh tính (ai đang gọi API), CHƯA authorize theo role (để Phase 3B —
// mục 19). requireAuth không nhận tham số role, không có requireRole()/requirePermission() ở đây.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Thiếu access token.')
  }

  const token = header.slice('Bearer '.length).trim()

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError(401, 'Access token đã hết hạn.')
    }
    throw new AppError(401, 'Access token không hợp lệ.')
  }

  const user = await authService.findUserById(payload.sub)
  if (!user) {
    throw new AppError(401, 'Tài khoản không còn tồn tại.')
  }
  // Luôn query lại DB mỗi request (đã có từ Phase 3A) nên khóa tài khoản có hiệu lực NGAY — token
  // cũ (còn hạn JWT) vẫn bị chặn ngay từ request kế tiếp sau khi Admin khóa, không cần revoke token.
  if (user.status === 'locked') {
    throw new AppError(403, 'Tài khoản đã bị khóa.')
  }

  // Trước đây chỉ chặn ở frontend (ProtectedRoute.jsx) — KHÔNG đủ, vì client tự ý/bị thao túng vẫn
  // gọi thẳng được mọi API khác. Chặn lại ở đây (nguồn sự thật duy nhất), chỉ miễn đúng 2 route cần
  // thiết để thoát khỏi trạng thái này (xem isExemptFromMustChangePassword).
  if (user.must_change_password && !isExemptFromMustChangePassword(req)) {
    throw new AppError(
      403,
      'Bạn đang dùng mật khẩu tạm — vui lòng đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.',
      'MUST_CHANGE_PASSWORD',
    )
  }

  req.user = authService.toSafeUser(user)
  next()
})

module.exports = { requireAuth }
