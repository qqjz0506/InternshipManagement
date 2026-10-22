const bcrypt = require('bcryptjs')
const { randomInt } = require('crypto')
const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const { toSafeUser } = require('./authService')

const BCRYPT_COST = 10

// Chỉ 3 role có bảng hồ sơ nghiệp vụ tương ứng — admin không link profile (đã chốt ở Phase 4F-1 mục 0).
const PROFILE_TABLE_BY_ROLE = {
  student: 'students',
  lecturer: 'lecturers',
  company_mentor: 'company_mentors',
}

// role/id/profile_id/password_hash bị reject CỨNG khi update — immutable (đã chốt, không silently
// ignore, đúng convention "reject toàn bộ request" đã áp dụng từ Phase 3B cho tới Settings/4E-3).
const UPDATE_IMMUTABLE_FIELDS = ['id', 'role', 'profile_id', 'password_hash']

async function getAll({ search, role }) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(full_name LIKE ? OR email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (role) {
    conditions.push('role = ?')
    params.push(role)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM users ${where} ORDER BY id`, params)
  return rows.map(toSafeUser)
}

async function getRawById(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getById(id) {
  const user = await getRawById(id)
  return user ? toSafeUser(user) : null
}

async function isEmailTaken(email, ignoreId) {
  const params = [email]
  let query = 'SELECT id FROM users WHERE email = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function getProfileById(table, id) {
  const [rows] = await pool.execute(`SELECT id, user_id FROM ${table} WHERE id = ?`, [id])
  return rows[0] ?? null
}

// Dùng bởi studentService/lecturerService/companyMentorService khi họ set user_id qua PUT trực tiếp
// (Phase 2B/3B, không đi qua luồng tạo User này) — enforce đúng invariant đã chốt ở mục 0/11/12:
// role phải khớp loại profile, và 1 user không được đồng thời link nhiều loại profile khác nhau.
async function assertUserCanLinkProfileType(userId, expectedRole) {
  const user = await getRawById(userId)
  if (!user) {
    return
  }
  if (user.role !== expectedRole) {
    throw new AppError(
      400,
      `Tài khoản này có vai trò "${user.role}", không thể liên kết với hồ sơ loại "${expectedRole}".`,
    )
  }
  for (const [role, table] of Object.entries(PROFILE_TABLE_BY_ROLE)) {
    if (role === expectedRole) {
      continue
    }
    const [rows] = await pool.execute(`SELECT id FROM ${table} WHERE user_id = ?`, [userId])
    if (rows.length > 0) {
      throw new AppError(409, 'Tài khoản này đã được liên kết với một hồ sơ khác loại.')
    }
  }
}

// CREATE: tạo user + (tuỳ chọn) link 1 hồ sơ nghiệp vụ trong CÙNG 1 transaction (mục 10) — nếu bước
// link thất bại, toàn bộ (kể cả INSERT users) phải rollback, không để lại user mồ côi không profile.
async function create({ full_name, email, password, role, profile_id }) {
  if (await isEmailTaken(email)) {
    throw new AppError(409, 'Email đã được dùng cho tài khoản khác.')
  }

  let profileTable = null
  if (profile_id !== undefined && profile_id !== null) {
    profileTable = PROFILE_TABLE_BY_ROLE[role]
    if (!profileTable) {
      throw new AppError(400, 'Vai trò admin không được liên kết hồ sơ nghiệp vụ.')
    }
    const profile = await getProfileById(profileTable, profile_id)
    if (!profile) {
      throw new AppError(400, 'Hồ sơ liên kết không tồn tại.')
    }
    if (profile.user_id) {
      throw new AppError(409, 'Hồ sơ này đã được liên kết với một tài khoản khác.')
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, email, passwordHash, role],
    )
    const userId = result.insertId

    if (profileTable) {
      // Re-check trong transaction (FOR UPDATE) để tránh race condition giữa lúc validate ở trên và
      // lúc ghi thật — 2 request tạo user đồng thời cùng link 1 profile phải có đúng 1 request thắng.
      const [[lockedProfile]] = await connection.execute(
        `SELECT id, user_id FROM ${profileTable} WHERE id = ? FOR UPDATE`,
        [profile_id],
      )
      if (!lockedProfile) {
        throw new AppError(400, 'Hồ sơ liên kết không tồn tại.')
      }
      if (lockedProfile.user_id) {
        throw new AppError(409, 'Hồ sơ này đã được liên kết với một tài khoản khác.')
      }
      await connection.execute(`UPDATE ${profileTable} SET user_id = ? WHERE id = ?`, [userId, profile_id])
    }

    await connection.commit()
    return getById(userId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// UPDATE: partial merge (chỉ field có mặt trong payload mới bị đổi) — BẮT BUỘC vì password là optional
// (không gửi = giữ nguyên password_hash cũ), không giống semantics full-replace của Student/Lecturer/...
async function update(id, payload) {
  const existing = await getRawById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy tài khoản.')
  }

  UPDATE_IMMUTABLE_FIELDS.forEach((field) => {
    if (field in payload) {
      throw new AppError(400, `${field} không được phép sửa qua API (immutable).`)
    }
  })

  const { full_name, email, password } = payload
  const fields = []
  const params = []

  if (full_name !== undefined) {
    fields.push('full_name = ?')
    params.push(full_name)
  }
  if (email !== undefined) {
    if (await isEmailTaken(email, id)) {
      throw new AppError(409, 'Email đã được dùng cho tài khoản khác.')
    }
    fields.push('email = ?')
    params.push(email)
  }
  if (password !== undefined) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    fields.push('password_hash = ?')
    params.push(passwordHash)
  }

  if (fields.length === 0) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  params.push(id)
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
  return getById(id)
}

const TEMP_PASSWORD_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz' // bỏ ký tự dễ nhầm (I/l/O/0)
const TEMP_PASSWORD_DIGITS = '23456789'

// Sinh mật khẩu tạm ngẫu nhiên — LUÔN khớp rule độ mạnh dùng cho đổi mật khẩu thường (tối thiểu 8 ký
// tự, có chữ và số, xem utils/validators.isStrongPassword) để Admin không cấp 1 mật khẩu mà user
// không tự đổi lại được nếu hệ thống validate chặt hơn ở chỗ khác.
// Math.random() không phải CSPRNG (dự đoán được nếu biết state) — dùng crypto.randomInt (CSPRNG)
// cho mật khẩu tạm, đúng mức an toàn cần thiết cho 1 giá trị dùng để xác thực.
function generateTemporaryPassword() {
  let result = ''
  for (let i = 0; i < 8; i += 1) {
    result += TEMP_PASSWORD_LETTERS[randomInt(TEMP_PASSWORD_LETTERS.length)]
  }
  for (let i = 0; i < 4; i += 1) {
    result += TEMP_PASSWORD_DIGITS[randomInt(TEMP_PASSWORD_DIGITS.length)]
  }
  return result
}

// Admin đặt lại mật khẩu cho 1 tài khoản bất kỳ (quên mật khẩu, bàn giao lại...). Mật khẩu tạm CHỈ
// trả về đúng 1 lần trong response này — không lưu plaintext ở đâu khác, không log ra console.
async function resetPassword(id) {
  const existing = await getRawById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy tài khoản.')
  }

  // must_change_password = 1: bắt đăng nhập bằng mật khẩu tạm này phải đổi ngay trước khi dùng hệ
  // thống (ProtectedRoute.jsx chặn mọi route khác) — tự tắt khi user đổi mật khẩu thành công
  // (authService.changePassword).
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST)
  await pool.execute('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [passwordHash, id])

  return { user: await getById(id), temporaryPassword }
}

const STATUS_VALUES = ['active', 'locked']

// Khóa/mở tài khoản đăng nhập. currentUser: người đang thực hiện hành động (Admin) — dùng để chặn
// tự khóa chính mình và chặn khóa admin cuối cùng còn active (không ai còn quyền mở lại).
async function setStatus(id, status, currentUser) {
  if (!STATUS_VALUES.includes(status)) {
    throw new AppError(400, `status phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }

  const existing = await getRawById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy tài khoản.')
  }

  if (status === 'locked') {
    if (existing.id === currentUser.id) {
      throw new AppError(403, 'Không thể tự khóa chính tài khoản đang đăng nhập.')
    }
    if (existing.role === 'admin') {
      const [[row]] = await pool.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active' AND id != ?",
        [id],
      )
      if (row.count === 0) {
        throw new AppError(409, 'Không thể khóa admin cuối cùng đang hoạt động.')
      }
    }
  }

  await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id])
  return getById(id)
}

module.exports = {
  getAll,
  getById,
  isEmailTaken,
  create,
  update,
  assertUserCanLinkProfileType,
  resetPassword,
  setStatus,
}
