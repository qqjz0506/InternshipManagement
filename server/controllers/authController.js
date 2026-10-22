const authService = require('../services/authService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isStrongPassword } = require('../utils/validators')

function validateLoginPayload(body) {
  if (!isRequired(body.email)) {
    throw new AppError(400, 'Vui lòng nhập email.')
  }
  if (!isValidEmail(body.email)) {
    throw new AppError(400, 'Email không hợp lệ.')
  }
  if (!isRequired(body.password)) {
    throw new AppError(400, 'Vui lòng nhập mật khẩu.')
  }
}

// Format: required + độ mạnh của newPassword (thuần regex, không cần DB) — currentPassword đúng/sai
// và newPassword khác currentPassword là business rule, nằm ở authService.changePassword.
function validateChangePasswordPayload(body) {
  if (!isRequired(body.currentPassword)) {
    throw new AppError(400, 'Vui lòng nhập mật khẩu hiện tại.')
  }
  if (!isRequired(body.newPassword)) {
    throw new AppError(400, 'Vui lòng nhập mật khẩu mới.')
  }
  if (!isStrongPassword(body.newPassword)) {
    throw new AppError(400, 'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ và số.')
  }
}

async function login(req, res) {
  validateLoginPayload(req.body)
  const email = req.body.email.trim().toLowerCase()
  const { accessToken, user } = await authService.login(email, req.body.password)
  sendSuccess(res, { message: 'Đăng nhập thành công', data: { accessToken, user } })
}

async function me(req, res) {
  sendSuccess(res, { message: 'Lấy thông tin tài khoản thành công', data: req.user })
}

async function changePassword(req, res) {
  validateChangePasswordPayload(req.body)
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)
  sendSuccess(res, { message: 'Đổi mật khẩu thành công', data: null })
}

module.exports = { login, me, changePassword }
