const AppError = require('../utils/AppError')

// RBAC thuần role-check — KHÔNG biết gì về ownership/data-level (đó là việc của service layer,
// xem server/services/scopeService.js). 401 (chưa xác thực) đã được authMiddleware xử lý trước đó;
// ở đây req.user chắc chắn đã tồn tại, nên sai role luôn là 403, không phải 401.
function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      throw new AppError(401, 'Thiếu access token.')
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'Bạn không có quyền thực hiện hành động này.')
    }
    next()
  }
}

module.exports = { requireRole }
