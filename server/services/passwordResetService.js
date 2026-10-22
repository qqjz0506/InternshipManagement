const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const mailService = require('./mailService')
const settingsService = require('./settingsService')
const { toSafeUser } = require('./authService')

const BCRYPT_COST = 10
const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 phút

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function buildResetEmail(systemName, resetLink) {
  const subject = `[${systemName}] Yêu cầu đặt lại mật khẩu`
  const text = `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản ${systemName}. Nhấn vào đường link sau để đặt mật khẩu mới (hết hạn sau 30 phút): ${resetLink}\n\nNếu bạn không yêu cầu điều này, hãy bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.`
  const html = `<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản <strong>${systemName}</strong>.</p>
<p><a href="${resetLink}">Nhấn vào đây để đặt mật khẩu mới</a> (đường link hết hạn sau 30 phút).</p>
<p>Nếu bạn không yêu cầu điều này, hãy bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.</p>`
  return { subject, text, html }
}

// Luôn trả về CÙNG 1 kết quả (không phân biệt email tồn tại/không tồn tại, tài khoản locked hay
// không) — chống dò tài khoản qua endpoint này (user enumeration), đúng nguyên tắc đã áp dụng ở
// authService.login() (INVALID_CREDENTIALS_MESSAGE chung cho "sai email" và "sai mật khẩu").
// Tài khoản `locked` KHÔNG được tạo token/gửi email — phải được Admin mở khóa trước, nhất quán với
// rule login() hiện tại (locked chặn đăng nhập hoàn toàn, tự phục vụ không được bỏ qua việc đó).
async function requestReset(email) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
  const user = rows[0]

  if (user && user.status !== 'locked') {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await pool.execute(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt],
    )

    const settings = await settingsService.get()
    const systemName = settings?.system_name ?? 'Hệ thống quản lý thực tập'
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`
    const { subject, text, html } = buildResetEmail(systemName, resetLink)
    // Không await — gửi email không được làm chậm response của endpoint này (mục "bất đồng bộ,
    // không chờ" đã áp dụng cho notificationService.notify()).
    mailService.sendMail({ to: user.email, subject, text, html })
  }
}

// Validate token: đúng hash, chưa hết hạn, chưa dùng — trả về user tương ứng hoặc throw 400 (1 message
// chung cho mọi lý do từ chối, không lộ lý do cụ thể nào giúp kẻ tấn công đoán token gần đúng).
async function findValidToken(token) {
  const tokenHash = hashToken(token)
  const [rows] = await pool.execute(
    'SELECT * FROM password_reset_tokens WHERE token_hash = ?',
    [tokenHash],
  )
  const record = rows[0]
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw new AppError(400, 'Đường link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.')
  }
  return record
}

async function resetPassword(token, newPassword) {
  const record = await findValidToken(token)

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // Vô hiệu MỌI token khác của user này (không chỉ token đang dùng) — phòng trường hợp user yêu
    // cầu reset nhiều lần liên tiếp (vd. không nhận được email lần đầu, thử lại), token cũ không còn
    // dùng được sau khi 1 trong số đó đã dùng để đổi mật khẩu thành công.
    await connection.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [record.user_id],
    )
    await connection.execute(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [passwordHash, record.user_id],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [record.user_id])
  return toSafeUser(rows[0])
}

module.exports = { requestReset, resetPassword }
