const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

const BCRYPT_COST = 10

// DTO dùng chung — loại bỏ password_hash khỏi mọi response/JWT payload (mục 17).
function toSafeUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    emailNotifications: Boolean(user.email_notifications),
  }
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
  return rows[0] ?? null
}

async function findUserById(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id])
  return rows[0] ?? null
}

// Message tổng quát cho mọi lỗi xác thực — tránh user enumeration (mục 7).
const INVALID_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không chính xác.'

async function login(email, password) {
  const user = await findUserByEmail(email)
  if (!user) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE)
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE)
  }

  // Check khóa tài khoản SAU KHI đã xác nhận mật khẩu đúng — tránh lộ "tài khoản này tồn tại và bị
  // khóa" cho ai đó chưa chứng minh biết mật khẩu (tránh user enumeration qua nhánh lỗi khác nhau).
  if (user.status === 'locked') {
    throw new AppError(403, 'Tài khoản đã bị khóa.')
  }

  // Payload JWT tối thiểu — không chứa password/password_hash (mục 4).
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  })

  return { accessToken, user: toSafeUser(user) }
}

// Đổi mật khẩu tự thân (currentUser đổi mật khẩu của chính mình, qua PUT /auth/change-password).
// Không cho khóa tài khoản bằng cách đổi mật khẩu — đây là hành động của chính user, không liên quan
// users.status (khóa/mở là hành động riêng của Admin, xem userService.setStatus).
async function changePassword(userId, currentPassword, newPassword) {
  const user = await findUserById(userId)
  if (!user) {
    throw new AppError(404, 'Không tìm thấy tài khoản.')
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash)
  if (!matches) {
    throw new AppError(401, 'Mật khẩu hiện tại không đúng.')
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại.')
  }

  // Đổi mật khẩu thành công (dù là đổi tự nguyện hay đang bị bắt đổi mật khẩu tạm) -> luôn tắt cờ
  // must_change_password — đây chính là hành động "giải phóng" khỏi trạng thái bắt buộc đổi.
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await pool.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, userId])
}

// Tự phục vụ (currentUser tự tắt/bật email cho CHÍNH MÌNH) — không qua Admin, không dùng chung route
// PUT /api/users/:id (admin-only tuyệt đối, xem server/routes/userRoutes.js).
async function setEmailNotifications(userId, enabled) {
  await pool.execute('UPDATE users SET email_notifications = ? WHERE id = ?', [enabled ? 1 : 0, userId])
  return toSafeUser(await findUserById(userId))
}

module.exports = { login, findUserById, toSafeUser, changePassword, setEmailNotifications }
