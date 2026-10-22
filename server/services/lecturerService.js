const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const { assertUserCanLinkProfileType } = require('./userService')

async function getAll({ search, department_id, status }, currentUser) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(l.lecturer_code LIKE ? OR l.full_name LIKE ? OR l.email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (department_id) {
    conditions.push('l.department_id = ?')
    params.push(department_id)
  }
  if (status) {
    conditions.push('l.status = ?')
    params.push(status)
  }

  let join = ''
  if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    conditions.push('l.id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    join = 'JOIN internships i ON i.lecturer_id = l.id'
    conditions.push('i.student_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    join = 'JOIN internships i ON i.lecturer_id = l.id'
    conditions.push('i.company_mentor_id = ?')
    params.push(own?.id ?? 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT DISTINCT l.* FROM lecturers l ${join} ${where} ORDER BY l.id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM lecturers WHERE id = ?', [id])
  return rows[0] ?? null
}

// Lecturer: chỉ đọc chính mình (read-only, không có PUT tự sửa — LecturerProfilePage.jsx).
// Student/Company Mentor: chỉ đọc lecturer gắn với internship của chính mình.
async function canAccessLecturer(id, currentUser) {
  if (currentUser.role === 'admin') return true
  if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    return own?.id === Number(id)
  }
  if (currentUser.role === 'student' || currentUser.role === 'company_mentor') {
    const own =
      currentUser.role === 'student'
        ? await scopeService.getStudentProfile(currentUser.id)
        : await scopeService.getCompanyMentorProfile(currentUser.id)
    if (!own) return false
    const column = currentUser.role === 'student' ? 'student_id' : 'company_mentor_id'
    const [rows] = await pool.execute(
      `SELECT id FROM internships WHERE lecturer_id = ? AND ${column} = ?`,
      [id, own.id],
    )
    return rows.length > 0
  }
  return false
}

async function getByIdForUser(id, currentUser) {
  if (!(await canAccessLecturer(id, currentUser))) {
    throw new AppError(403, 'Bạn không có quyền xem giảng viên này.')
  }
  return getById(id)
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM lecturers WHERE lecturer_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function departmentExists(departmentId) {
  const [rows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [departmentId])
  return rows.length > 0
}

async function userExists(userId) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId])
  return rows.length > 0
}

async function isUserLinkedToOtherLecturer(userId, ignoreId) {
  const params = [userId]
  let query = 'SELECT id FROM lecturers WHERE user_id = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function validateReferences({ department_id, user_id }, ignoreId) {
  if (!(await departmentExists(department_id))) {
    throw new AppError(400, 'Khoa/bộ môn không tồn tại.')
  }
  if (user_id) {
    if (!(await userExists(user_id))) {
      throw new AppError(400, 'Tài khoản (user_id) không tồn tại.')
    }
    if (await isUserLinkedToOtherLecturer(user_id, ignoreId)) {
      throw new AppError(409, 'Tài khoản này đã được liên kết với một giảng viên khác.')
    }
    // Enforce invariant đã chốt ở Phase 4F-1 (mục 0/11/12): role của user phải là 'lecturer', và user
    // đó không được đồng thời link sang students/company_mentors.
    await assertUserCanLinkProfileType(user_id, 'lecturer')
  }
}

async function create(payload) {
  const { lecturer_code, full_name, email, phone, department_id, position, status, user_id } = payload

  if (await isCodeTaken(lecturer_code)) {
    throw new AppError(409, 'Mã giảng viên đã tồn tại.')
  }
  await validateReferences({ department_id, user_id })

  const [result] = await pool.execute(
    `INSERT INTO lecturers (user_id, lecturer_code, full_name, email, phone, department_id, position, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id ?? null, lecturer_code, full_name, email, phone ?? null, department_id, position ?? null, status ?? 'active'],
  )
  return getById(result.insertId)
}

async function update(id, payload) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy giảng viên.')
  }

  const { lecturer_code, full_name, email, phone, department_id, position, status, user_id } = payload

  if (await isCodeTaken(lecturer_code, id)) {
    throw new AppError(409, 'Mã giảng viên đã tồn tại.')
  }
  await validateReferences({ department_id, user_id }, id)

  await pool.execute(
    `UPDATE lecturers SET
      lecturer_code = ?, full_name = ?, email = ?, phone = ?, department_id = ?, position = ?, status = ?, user_id = ?
     WHERE id = ?`,
    [lecturer_code, full_name, email, phone ?? null, department_id, position ?? null, status ?? 'active', user_id ?? null, id],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy giảng viên.')
  }

  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE lecturer_id = ?',
    [id],
  )
  if (internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa giảng viên đang được phân công cho Hồ sơ thực tập.')
  }

  try {
    await pool.execute('DELETE FROM lecturers WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa giảng viên đang được phân công cho Hồ sơ thực tập.')
    }
    throw error
  }
}

module.exports = { getAll, getById, getByIdForUser, canAccessLecturer, create, update, remove, isCodeTaken }
