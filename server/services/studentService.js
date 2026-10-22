const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const { parsePagination } = require('../utils/pagination')
const { assertUserCanLinkProfileType, isEmailTaken: isUserEmailTaken } = require('./userService')

// Field Student được tự sửa trên chính hồ sơ mình — đúng StudentProfilePage.jsx (mục 7 Phase 3B).
const STUDENT_SELF_EDITABLE_FIELDS = ['email', 'phone', 'address', 'gender', 'date_of_birth']

// Trả { rows, pagination }. `pagination` null khi KHÔNG truyền `page` trong query — rows lúc đó là
// TOÀN BỘ kết quả, đúng hành vi cũ (không phá frontend hiện tại chưa gửi page/pageSize). Khi có
// `page`, rows chỉ là 1 trang + pagination.total là tổng số dòng KHỚP ĐÚNG where/scope hiện tại.
async function getAll({ search, department_id, status, page, pageSize }, currentUser) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(s.student_code LIKE ? OR s.full_name LIKE ? OR s.email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (department_id) {
    conditions.push('s.department_id = ?')
    params.push(department_id)
  }
  if (status) {
    conditions.push('s.status = ?')
    params.push(status)
  }

  let join = ''
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    conditions.push('s.id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    join = 'JOIN internships i ON i.student_id = s.id'
    conditions.push('i.lecturer_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    join = 'JOIN internships i ON i.student_id = s.id'
    conditions.push('i.company_mentor_id = ?')
    params.push(own?.id ?? 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const pagination = parsePagination({ page, pageSize })
  if (!pagination) {
    const [rows] = await pool.execute(`SELECT DISTINCT s.* FROM students s ${join} ${where} ORDER BY s.id`, params)
    return { rows, pagination: null }
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM (SELECT DISTINCT s.id FROM students s ${join} ${where}) t`,
    params,
  )
  const [rows] = await pool.query(
    `SELECT DISTINCT s.* FROM students s ${join} ${where} ORDER BY s.id LIMIT ? OFFSET ?`,
    [...params, pagination.pageSize, pagination.offset],
  )
  return { rows, pagination: { total, page: pagination.page, pageSize: pagination.pageSize } }
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM students WHERE id = ?', [id])
  return rows[0] ?? null
}

// Kiểm tra currentUser có quyền đọc student `id` hay không (admin luôn true).
async function canAccessStudent(id, currentUser) {
  if (currentUser.role === 'admin') return true
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    return own?.id === Number(id)
  }
  if (currentUser.role === 'lecturer' || currentUser.role === 'company_mentor') {
    const own =
      currentUser.role === 'lecturer'
        ? await scopeService.getLecturerProfile(currentUser.id)
        : await scopeService.getCompanyMentorProfile(currentUser.id)
    if (!own) return false
    const column = currentUser.role === 'lecturer' ? 'lecturer_id' : 'company_mentor_id'
    const [rows] = await pool.execute(
      `SELECT id FROM internships WHERE student_id = ? AND ${column} = ?`,
      [id, own.id],
    )
    return rows.length > 0
  }
  return false
}

async function getByIdForUser(id, currentUser) {
  if (!(await canAccessStudent(id, currentUser))) {
    throw new AppError(403, 'Bạn không có quyền xem sinh viên này.')
  }
  const student = await getById(id)
  return student
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM students WHERE student_code = ?'
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

async function isUserLinkedToOtherStudent(userId, ignoreId) {
  const params = [userId]
  let query = 'SELECT id FROM students WHERE user_id = ?'
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
    if (await isUserLinkedToOtherStudent(user_id, ignoreId)) {
      throw new AppError(409, 'Tài khoản này đã được liên kết với một sinh viên khác.')
    }
    // Enforce invariant đã chốt ở Phase 4F-1 (mục 0/11/12): role của user phải là 'student', và user
    // đó không được đồng thời link sang lecturers/company_mentors.
    await assertUserCanLinkProfileType(user_id, 'student')
  }
}

async function create(payload) {
  const { student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class: className, status, user_id } = payload

  if (await isCodeTaken(student_code)) {
    throw new AppError(409, 'Mã sinh viên đã tồn tại.')
  }
  await validateReferences({ department_id, user_id })

  const [result] = await pool.execute(
    `INSERT INTO students
      (user_id, student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id ?? null,
      student_code,
      full_name,
      gender ?? null,
      date_of_birth ?? null,
      phone ?? null,
      email,
      address ?? null,
      department_id,
      major ?? null,
      className ?? null,
      status ?? 'active',
    ],
  )
  return getById(result.insertId)
}

async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy sinh viên.')
  }

  // Student chỉ được sửa CHÍNH MÌNH, và chỉ đúng tập field liên hệ (mục 7 Phase 3B) — field khác
  // (student_code/full_name/department_id/class/major/status/user_id) bị từ chối rõ ràng, không
  // silently ignore.
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (!own || own.id !== Number(id)) {
      throw new AppError(403, 'Bạn chỉ được sửa hồ sơ của chính mình.')
    }
    const disallowed = Object.keys(payload).filter((field) => !STUDENT_SELF_EDITABLE_FIELDS.includes(field))
    if (disallowed.length > 0) {
      throw new AppError(403, `Bạn không được tự sửa field: ${disallowed.join(', ')}.`)
    }

    // Rule mới: nếu hồ sơ có user_id (có tài khoản đăng nhập liên kết) và Student đổi email, phải
    // đồng bộ luôn users.email trong CÙNG 1 transaction — check trùng ở bảng users (không phải students,
    // bảng students không có ràng buộc UNIQUE trên email).
    const nextEmail = payload.email ?? existing.email
    if ('email' in payload && own.user_id && (await isUserEmailTaken(nextEmail, own.user_id))) {
      throw new AppError(409, 'Email này đã được dùng cho một tài khoản khác.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute(
        'UPDATE students SET email = ?, phone = ?, address = ?, gender = ?, date_of_birth = ? WHERE id = ?',
        [
          nextEmail,
          payload.phone ?? existing.phone,
          payload.address ?? existing.address,
          payload.gender ?? existing.gender,
          payload.date_of_birth ?? existing.date_of_birth,
          id,
        ],
      )
      if ('email' in payload && own.user_id) {
        await connection.execute('UPDATE users SET email = ? WHERE id = ?', [nextEmail, own.user_id])
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    return getById(id)
  }

  const { student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class: className, status, user_id } = payload

  if (await isCodeTaken(student_code, id)) {
    throw new AppError(409, 'Mã sinh viên đã tồn tại.')
  }
  await validateReferences({ department_id, user_id }, id)

  await pool.execute(
    `UPDATE students SET
      student_code = ?, full_name = ?, gender = ?, date_of_birth = ?, phone = ?, email = ?,
      address = ?, department_id = ?, major = ?, class = ?, status = ?, user_id = ?
     WHERE id = ?`,
    [
      student_code,
      full_name,
      gender ?? null,
      date_of_birth ?? null,
      phone ?? null,
      email,
      address ?? null,
      department_id,
      major ?? null,
      className ?? null,
      status ?? 'active',
      user_id ?? null,
      id,
    ],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy sinh viên.')
  }

  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE student_id = ?',
    [id],
  )
  if (internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa sinh viên đang có Hồ sơ thực tập.')
  }

  try {
    await pool.execute('DELETE FROM students WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa sinh viên đang có Hồ sơ thực tập.')
    }
    throw error
  }
}

module.exports = { getAll, getById, getByIdForUser, canAccessStudent, create, update, remove, isCodeTaken }
