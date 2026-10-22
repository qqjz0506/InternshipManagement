const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const { assertUserCanLinkProfileType } = require('./userService')

async function getAll({ search, company_id }, currentUser) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(cm.full_name LIKE ? OR cm.email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (company_id) {
    conditions.push('cm.company_id = ?')
    params.push(company_id)
  }

  let join = ''
  if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    conditions.push('cm.id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    join = 'JOIN internships i ON i.company_mentor_id = cm.id'
    conditions.push('i.student_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    join = 'JOIN internships i ON i.company_mentor_id = cm.id'
    conditions.push('i.lecturer_id = ?')
    params.push(own?.id ?? 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(
    `SELECT DISTINCT cm.* FROM company_mentors cm ${join} ${where} ORDER BY cm.id`,
    params,
  )
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM company_mentors WHERE id = ?', [id])
  return rows[0] ?? null
}

// Company Mentor: chỉ đọc chính mình (read-only, không PUT self-edit — CompanyProfilePage.jsx).
// Student/Lecturer: chỉ đọc mentor gắn với internship của chính mình.
async function canAccessMentor(id, currentUser) {
  if (currentUser.role === 'admin') return true
  if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    return own?.id === Number(id)
  }
  if (currentUser.role === 'student' || currentUser.role === 'lecturer') {
    const own =
      currentUser.role === 'student'
        ? await scopeService.getStudentProfile(currentUser.id)
        : await scopeService.getLecturerProfile(currentUser.id)
    if (!own) return false
    const column = currentUser.role === 'student' ? 'student_id' : 'lecturer_id'
    const [rows] = await pool.execute(
      `SELECT id FROM internships WHERE company_mentor_id = ? AND ${column} = ?`,
      [id, own.id],
    )
    return rows.length > 0
  }
  return false
}

async function getByIdForUser(id, currentUser) {
  if (!(await canAccessMentor(id, currentUser))) {
    throw new AppError(403, 'Bạn không có quyền xem người hướng dẫn này.')
  }
  return getById(id)
}

async function isEmailTaken(email, ignoreId) {
  const params = [email]
  let query = 'SELECT id FROM company_mentors WHERE email = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function companyExists(companyId) {
  const [rows] = await pool.execute('SELECT id FROM companies WHERE id = ?', [companyId])
  return rows.length > 0
}

async function userExists(userId) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId])
  return rows.length > 0
}

async function isUserLinkedToOtherMentor(userId, ignoreId) {
  const params = [userId]
  let query = 'SELECT id FROM company_mentors WHERE user_id = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function validateReferences({ company_id, user_id }, ignoreId) {
  if (!(await companyExists(company_id))) {
    throw new AppError(400, 'Doanh nghiệp không tồn tại.')
  }
  if (user_id) {
    if (!(await userExists(user_id))) {
      throw new AppError(400, 'Tài khoản (user_id) không tồn tại.')
    }
    if (await isUserLinkedToOtherMentor(user_id, ignoreId)) {
      throw new AppError(409, 'Tài khoản này đã được liên kết với một người hướng dẫn khác.')
    }
    // Enforce invariant đã chốt ở Phase 4F-1 (mục 0/11/12): role của user phải là 'company_mentor', và
    // user đó không được đồng thời link sang students/lecturers.
    await assertUserCanLinkProfileType(user_id, 'company_mentor')
  }
}

async function create(payload) {
  const { full_name, email, phone, company_id, position, status, user_id } = payload

  if (await isEmailTaken(email)) {
    throw new AppError(409, 'Email đã được dùng cho người hướng dẫn khác.')
  }
  await validateReferences({ company_id, user_id })

  const [result] = await pool.execute(
    `INSERT INTO company_mentors (user_id, company_id, full_name, email, phone, position, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user_id ?? null, company_id, full_name, email, phone ?? null, position ?? null, status ?? 'active'],
  )
  return getById(result.insertId)
}

// Đúng behavior CompanyMentorsPage.jsx: đổi company_id thì gỡ (company_mentor_id = NULL) khỏi
// mọi Internship đang dùng mentor này (mentor không còn thuộc company cũ) — đây là business rule
// đã được duyệt ở Database Design (mục H.14), KHÔNG tự ý thêm mới. Đụng 2 bảng -> dùng transaction.
async function update(id, payload) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy người hướng dẫn.')
  }

  const { full_name, email, phone, company_id, position, status, user_id } = payload

  if (await isEmailTaken(email, id)) {
    throw new AppError(409, 'Email đã được dùng cho người hướng dẫn khác.')
  }
  await validateReferences({ company_id, user_id }, id)

  const companyChanged = Number(company_id) !== Number(existing.company_id)
  let unassignedCount = 0

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE company_mentors SET
        full_name = ?, email = ?, phone = ?, company_id = ?, position = ?, status = ?, user_id = ?
       WHERE id = ?`,
      [full_name, email, phone ?? null, company_id, position ?? null, status ?? 'active', user_id ?? null, id],
    )

    if (companyChanged) {
      const [result] = await connection.execute(
        'UPDATE internships SET company_mentor_id = NULL WHERE company_mentor_id = ?',
        [id],
      )
      unassignedCount = result.affectedRows
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const updated = await getById(id)
  return { mentor: updated, unassignedInternshipCount: unassignedCount }
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy người hướng dẫn.')
  }

  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE company_mentor_id = ?',
    [id],
  )
  if (internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa người hướng dẫn đang được phân công cho hồ sơ thực tập.')
  }

  // KHÔNG đụng tới bảng users dù mentor có user_id — xóa mentor chỉ xóa đúng hàng company_mentors,
  // tài khoản liên kết (nếu có) vẫn còn nguyên (đúng CompanyMentorsPage.handleDelete hiện tại).
  try {
    await pool.execute('DELETE FROM company_mentors WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa người hướng dẫn đang được phân công cho hồ sơ thực tập.')
    }
    throw error
  }
}

module.exports = { getAll, getById, getByIdForUser, canAccessMentor, create, update, remove, isEmailTaken }
