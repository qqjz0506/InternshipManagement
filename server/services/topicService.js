const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const notificationService = require('./notificationService')

// Tìm giảng viên ĐANG phụ trách hồ sơ thực tập của sinh viên này (nếu có) — dùng để báo "có đề tài
// mới chờ duyệt" khi Student đề xuất. Lấy bất kỳ 1 hồ sơ có lecturer_id (ưu tiên hồ sơ gần nhất).
async function getCurrentLecturerIdForStudent(studentId) {
  const [rows] = await pool.execute(
    'SELECT lecturer_id FROM internships WHERE student_id = ? AND lecturer_id IS NOT NULL ORDER BY id DESC LIMIT 1',
    [studentId],
  )
  return rows[0]?.lecturer_id ?? null
}

async function getAll({ search, status }) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(topic_code LIKE ? OR topic_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM topics ${where} ORDER BY id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM topics WHERE id = ?', [id])
  return rows[0] ?? null
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM topics WHERE topic_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function studentExists(studentId) {
  const [rows] = await pool.execute('SELECT id FROM students WHERE id = ?', [studentId])
  return rows.length > 0
}

async function companyExists(companyId) {
  const [rows] = await pool.execute('SELECT id FROM companies WHERE id = ?', [companyId])
  return rows.length > 0
}

// Không enforce "chỉ 1 trong 2" giữa suggested_by_student_id/company_id — đúng quyết định đã có
// ở Database Design (mục I.4), không tự thêm business rule mới.
async function validateReferences({ suggested_by_student_id, company_id }) {
  if (suggested_by_student_id && !(await studentExists(suggested_by_student_id))) {
    throw new AppError(400, 'Sinh viên đề xuất không tồn tại.')
  }
  if (company_id && !(await companyExists(company_id))) {
    throw new AppError(400, 'Doanh nghiệp đề xuất không tồn tại.')
  }
}

async function create(payload) {
  const { topic_code, topic_name, description, suggested_by_student_id, company_id, status } = payload

  if (await isCodeTaken(topic_code)) {
    throw new AppError(409, 'Mã đề tài đã tồn tại.')
  }
  await validateReferences({ suggested_by_student_id, company_id })

  const [result] = await pool.execute(
    `INSERT INTO topics (topic_code, topic_name, description, suggested_by_student_id, company_id, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      topic_code,
      topic_name,
      description ?? null,
      suggested_by_student_id ?? null,
      company_id ?? null,
      status ?? 'proposed',
    ],
  )
  const created = await getById(result.insertId)

  // Thông báo: Sinh viên đề xuất đề tài mới -> báo Giảng viên đang phụ trách hồ sơ thực tập của mình.
  if (suggested_by_student_id) {
    const [studentInfo, lecturerId] = await Promise.all([
      scopeService.getStudentBasicInfo(suggested_by_student_id),
      getCurrentLecturerIdForStudent(suggested_by_student_id),
    ])
    const lecturerInfo = await scopeService.getLecturerBasicInfo(lecturerId)
    await notificationService.notify({
      userId: lecturerInfo?.user_id,
      type: 'assignment',
      title: 'Có đề tài mới chờ duyệt',
      content: `Sinh viên ${studentInfo?.full_name ?? ''} vừa đề xuất đề tài "${created.topic_name}", đang chờ duyệt.`,
    })
  }

  return created
}

// Lecturer không có quyền duyệt MỌI đề tài — chỉ đề tài đang gắn với 1 Internship do chính Lecturer
// đó hướng dẫn (internships.topic_id = topic này AND internships.lecturer_id = lecturer này). KHÔNG
// dùng suggested_by_student_id để suy ra quyền (1 Lecturer bất kỳ không mặc nhiên có quyền duyệt đề
// tài do 1 Student bất kỳ đề xuất — phải đúng Lecturer đang phụ trách Internship dùng đề tài đó).
async function canLecturerApproveTopic(topicId, lecturerId) {
  const [rows] = await pool.execute(
    'SELECT id FROM internships WHERE topic_id = ? AND lecturer_id = ?',
    [topicId, lecturerId],
  )
  return rows.length > 0
}

async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đề tài.')
  }

  if (currentUser?.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    if (!own || !(await canLecturerApproveTopic(id, own.id))) {
      throw new AppError(403, 'Bạn không có quyền duyệt đề tài này.')
    }
    if (existing.status !== 'proposed') {
      throw new AppError(403, 'Chỉ có thể duyệt/từ chối đề tài đang ở trạng thái Đề xuất.')
    }

    await pool.execute('UPDATE topics SET status = ? WHERE id = ?', [payload.status, id])
    const updated = await getById(id)

    // Thông báo: Giảng viên duyệt/từ chối -> báo Sinh viên đã đề xuất đề tài này (nếu có).
    if (existing.suggested_by_student_id) {
      const studentInfo = await scopeService.getStudentBasicInfo(existing.suggested_by_student_id)
      await notificationService.notify({
        userId: studentInfo?.user_id,
        type: 'assignment',
        title: payload.status === 'approved' ? 'Đề tài đã được duyệt' : 'Đề tài bị từ chối',
        content: `Đề tài "${existing.topic_name}" bạn đề xuất đã ${payload.status === 'approved' ? 'được duyệt' : 'bị từ chối'}.`,
      })
    }

    return updated
  }

  const { topic_code, topic_name, description, suggested_by_student_id, company_id, status } = payload

  if (await isCodeTaken(topic_code, id)) {
    throw new AppError(409, 'Mã đề tài đã tồn tại.')
  }
  await validateReferences({ suggested_by_student_id, company_id })

  await pool.execute(
    `UPDATE topics SET
      topic_code = ?, topic_name = ?, description = ?, suggested_by_student_id = ?, company_id = ?, status = ?
     WHERE id = ?`,
    [
      topic_code,
      topic_name,
      description ?? null,
      suggested_by_student_id ?? null,
      company_id ?? null,
      status ?? 'proposed',
      id,
    ],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đề tài.')
  }

  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE topic_id = ?',
    [id],
  )
  if (internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa đề tài đang được Hồ sơ thực tập sử dụng.')
  }

  try {
    await pool.execute('DELETE FROM topics WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa đề tài đang được Hồ sơ thực tập sử dụng.')
    }
    throw error
  }
}

module.exports = { getAll, getById, create, update, remove, isCodeTaken }
