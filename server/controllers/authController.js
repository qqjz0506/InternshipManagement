const authService = require('../services/authService')
const passwordResetService = require('../services/passwordResetService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isStrongPassword } = require('../utils/validators')

// Message chung — KHÔNG được đổi tùy theo email tồn tại/không tồn tại (chống dò tài khoản).
const FORGOT_PASSWORD_MESSAGE = 'Nếu email tồn tại trong hệ thống, một đường link đặt lại mật khẩu đã được gửi tới email đó.'

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

async function forgotPassword(req, res) {
  if (!isRequired(req.body.email) || !isValidEmail(req.body.email)) {
    throw new AppError(400, 'Vui lòng nhập email hợp lệ.')
  }
  await passwordResetService.requestReset(req.body.email.trim().toLowerCase())
  sendSuccess(res, { message: FORGOT_PASSWORD_MESSAGE, data: null })
}

async function resetPassword(req, res) {
  if (!isRequired(req.body.token)) {
    throw new AppError(400, 'Thiếu token đặt lại mật khẩu.')
  }
  if (!isRequired(req.body.newPassword) || !isStrongPassword(req.body.newPassword)) {
    throw new AppError(400, 'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ và số.')
  }
  await passwordResetService.resetPassword(req.body.token, req.body.newPassword)
  sendSuccess(res, { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại.', data: null })
}

async function setEmailNotifications(req, res) {
  if (typeof req.body.emailNotifications !== 'boolean') {
    throw new AppError(400, 'emailNotifications phải là boolean.')
  }
  const user = await authService.setEmailNotifications(req.user.id, req.body.emailNotifications)
  sendSuccess(res, { message: 'Cập nhật tùy chọn email thành công', data: user })
}

module.exports = { login, me, changePassword, forgotPassword, resetPassword, setEmailNotifications }
