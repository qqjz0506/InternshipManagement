const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const notificationService = require('./notificationService')
const { deleteStoredFile } = require('../config/upload')
const { REPORT_TYPE_VALUES, SETTABLE_STATUSES } = require('../utils/reportStatus')
const { parsePagination } = require('../utils/pagination')
const { todayDateString } = require('../utils/dateTime')

// Student resubmit (existing.status='rejected'): CHỈ được thay file mới — file_name/stored_file_name/
// file_size/mime_type luôn đi CÙNG NHAU (do controller gắn từ req.file), không field nào đứng riêng.
const RESUBMIT_FILE_FIELDS = ['file_name', 'stored_file_name', 'file_size', 'mime_type']

const LECTURER_EDITABLE_FIELDS = ['status', 'reviewer_comment']
const COMPANY_EDITABLE_FIELDS = ['company_comment']

function resolveOptionalText(value) {
  return value === undefined || value === null || value === '' ? null : value
}

async function getAll({ internship_id, status, search, lecturer_id, company_id, period_id, page, pageSize }, currentUser) {
  const conditions = []
  const params = []
  let needsJoin = Boolean(search || lecturer_id || company_id || period_id)

  if (currentUser.role !== 'admin') {
    needsJoin = true
    const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
    if (currentUser.role === 'student') {
      conditions.push('i.student_id = ?')
      params.push(ownIds.studentId ?? 0)
    } else if (currentUser.role === 'lecturer') {
      conditions.push('i.lecturer_id = ?')
      params.push(ownIds.lecturerId ?? 0)
    } else if (currentUser.role === 'company_mentor') {
      conditions.push('i.company_mentor_id = ?')
      params.push(ownIds.companyMentorId ?? 0)
    }
  }

  if (internship_id) {
    conditions.push('r.internship_id = ?')
    params.push(internship_id)
  }
  if (status) {
    conditions.push('r.status = ?')
    params.push(status)
  }
  if (lecturer_id) {
    conditions.push('i.lecturer_id = ?')
    params.push(lecturer_id)
  }
  if (company_id) {
    conditions.push('i.company_id = ?')
    params.push(company_id)
  }
  if (period_id) {
    conditions.push('i.period_id = ?')
    params.push(period_id)
  }
  if (search) {
    conditions.push('(s.student_code LIKE ? OR s.full_name LIKE ? OR c.company_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  const joins = needsJoin
    ? 'JOIN internships i ON i.id = r.internship_id LEFT JOIN students s ON s.id = i.student_id LEFT JOIN companies c ON c.id = i.company_id'
    : ''
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const pagination = parsePagination({ page, pageSize })
  if (!pagination) {
    const [rows] = await pool.execute(`SELECT r.* FROM reports r ${joins} ${where} ORDER BY r.id`, params)
    return { rows, pagination: null }
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM reports r ${joins} ${where}`, params)
  const [rows] = await pool.query(
    `SELECT r.* FROM reports r ${joins} ${where} ORDER BY r.id LIMIT ? OFFSET ?`,
    [...params, pagination.pageSize, pagination.offset],
  )
  return { rows, pagination: { total, page: pagination.page, pageSize: pagination.pageSize } }
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getByIdForUser(id, currentUser) {
  const report = await getById(id)
  if (!report) {
    return null
  }
  await scopeService.assertOwnInternshipById(report.internship_id, currentUser)
  return report
}

// Rule mới: mỗi internship chỉ được có TỐI ĐA 1 báo cáo 'final' chưa bị 'rejected' (submitted/approved
// tính là "đang xử lý/đã duyệt") — tránh nộp trùng nhiều bản tổng kết cùng lúc. Báo cáo 'rejected' không
// tính (sinh viên nộp lại bằng flow riêng — xem update()).
async function hasActiveFinalReport(internshipId, ignoreId) {
  const params = [internshipId]
  let query = `SELECT id FROM reports WHERE internship_id = ? AND report_type = 'final' AND status != 'rejected'`
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

// CREATE: chỉ Student nộp (StudentReportsPage.jsx) cho ĐÚNG internship của chính mình — Admin bypass
// scope (mục 18) nhưng vẫn qua các business rule khác bên dưới. submitted_at/status/reviewer_comment/
// company_comment luôn do server tự set, không nhận từ client.
async function create(payload, currentUser) {
  const {
    internship_id, report_type, file_name, stored_file_name, file_size, mime_type,
    submitted_at, status, reviewer_comment, company_comment,
  } = payload

  const internship = await scopeService.getInternshipOrThrow(internship_id).catch(() => null)
  if (!internship) {
    throw new AppError(400, 'Hồ sơ thực tập không tồn tại.')
  }

  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (!own || internship.student_id !== own.id) {
      throw new AppError(403, 'Bạn chỉ được nộp báo cáo cho hồ sơ thực tập của chính mình.')
    }
  }
  // Rule mới: chỉ nộp báo cáo khi hồ sơ thực tập đang 'in_progress' hoặc đã 'completed' — không nộp
  // được khi còn 'pending'/'approved' (chưa thực tập) hay đã 'rejected'/'cancelled'.
  if (!['in_progress', 'completed'].includes(internship.status)) {
    throw new AppError(409, 'Chỉ được nộp báo cáo khi hồ sơ thực tập đang "in_progress" hoặc đã "completed".')
  }
  if (!REPORT_TYPE_VALUES.includes(report_type)) {
    throw new AppError(400, `report_type phải là một trong: ${REPORT_TYPE_VALUES.join(', ')}.`)
  }
  if (report_type === 'final' && (await hasActiveFinalReport(internship_id))) {
    throw new AppError(409, 'Hồ sơ này đã có báo cáo tổng kết đang xử lý hoặc đã được duyệt — không thể nộp thêm bản mới.')
  }
  if (submitted_at !== undefined) {
    throw new AppError(400, 'submitted_at do hệ thống tự sinh, không được gửi khi tạo báo cáo.')
  }
  if (status !== undefined && status !== 'submitted') {
    throw new AppError(400, "status không được set khi tạo mới — báo cáo luôn bắt đầu ở trạng thái 'submitted'.")
  }
  if (reviewer_comment) {
    throw new AppError(400, 'reviewer_comment không được set khi tạo mới.')
  }
  if (company_comment) {
    throw new AppError(400, 'company_comment không được set khi tạo mới.')
  }

  const [result] = await pool.execute(
    `INSERT INTO reports
      (internship_id, report_type, file_name, stored_file_name, file_size, mime_type, submitted_at, status, reviewer_comment, company_comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', NULL, NULL)`,
    [internship_id, report_type, file_name, stored_file_name ?? null, file_size ?? null, mime_type ?? null, todayDateString()],
  )
  const created = await getById(result.insertId)

  // Thông báo: Sinh viên nộp báo cáo mới -> báo Giảng viên + Mentor của hồ sơ này.
  if (currentUser.role === 'student') {
    const studentInfo = await scopeService.getStudentBasicInfo(internship.student_id)
    const [lecturerInfo, mentorInfo] = await Promise.all([
      scopeService.getLecturerBasicInfo(internship.lecturer_id),
      scopeService.getCompanyMentorBasicInfo(internship.company_mentor_id),
    ])
    const title = 'Sinh viên vừa nộp báo cáo thực tập'
    const content = `Sinh viên ${studentInfo?.full_name ?? ''} vừa nộp báo cáo (${report_type}) cho hồ sơ thực tập #${internship_id}.`
    await notificationService.notify({ userId: lecturerInfo?.user_id, type: 'report', title, content })
    await notificationService.notify({ userId: mentorInfo?.user_id, type: 'report', title, content })
  }

  return created
}

// UPDATE: PARTIAL — 2 điểm gọi thật theo đúng role (Lecturer/Admin đổi status+reviewer_comment,
// Company thêm company_comment). report_type/submitted_at/internship_id immutable — không UI nào sửa.
// file_name immutable CHO MỌI TRƯỜNG HỢP TRỪ Student nộp lại báo cáo CỦA MÌNH khi đang 'rejected'
// (rule mới) — xử lý riêng ở nhánh Student dưới đây, return sớm trước khi chạm block immutable chung.
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy báo cáo.')
  }

  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    if (!own || internship.student_id !== own.id) {
      throw new AppError(403, 'Bạn không có quyền sửa báo cáo này.')
    }
    if (existing.status !== 'rejected') {
      throw new AppError(403, 'Sinh viên chỉ được nộp lại báo cáo khi báo cáo đang ở trạng thái "rejected".')
    }
    // Phát hiện ở đợt kiểm tra trước bảo vệ: create() đã chặn tạo MỚI báo cáo final thứ 2 khi đã có 1
    // bản active, nhưng nộp lại (update, nhánh này) qua lỗ hổng khác tới cùng trạng thái — ví dụ báo
    // cáo final A bị reject, student tạo MỚI báo cáo final B (hợp lệ vì A đã rejected, không active),
    // rồi quay lại nộp LẠI chính A -> A chuyển về 'submitted', lúc đó có 2 báo cáo final active cùng
    // lúc (A và B), vi phạm bất biến "tối đa 1 final đang xử lý/đã duyệt". Check lại đúng như create(),
    // loại trừ CHÍNH báo cáo đang nộp lại (ignoreId = id) khỏi phép so sánh.
    if (existing.report_type === 'final' && (await hasActiveFinalReport(existing.internship_id, id))) {
      throw new AppError(
        409,
        'Hồ sơ này đã có báo cáo tổng kết khác đang xử lý hoặc đã được duyệt — không thể nộp lại bản này.',
      )
    }
    const disallowed = Object.keys(payload).filter((field) => !RESUBMIT_FILE_FIELDS.includes(field))
    if (disallowed.length > 0) {
      throw new AppError(403, `Khi nộp lại báo cáo, bạn chỉ được thay file mới: ${disallowed.join(', ')}.`)
    }
    if (!payload.file_name || !payload.stored_file_name) {
      throw new AppError(400, 'Vui lòng chọn file mới để nộp lại báo cáo.')
    }
    await pool.execute(
      `UPDATE reports SET file_name = ?, stored_file_name = ?, file_size = ?, mime_type = ?, status = 'submitted', reviewer_comment = NULL WHERE id = ?`,
      [payload.file_name, payload.stored_file_name, payload.file_size ?? null, payload.mime_type ?? null, id],
    )
    // Thay file mới thành công -> xóa file CŨ trên đĩa (không còn report nào tham chiếu tới nó nữa).
    await deleteStoredFile(existing.stored_file_name)
    return getById(id)
  }

  ;['internship_id', 'report_type', 'file_name', 'submitted_at'].forEach((field) => {
    if (field in payload) {
      throw new AppError(400, `${field} là immutable — không được gửi field này khi cập nhật báo cáo.`)
    }
  })

  if (currentUser.role !== 'admin') {
    // role === 'student' đã return sớm ở trên — tới đây chỉ còn lecturer/company_mentor.
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
    if (!scopeService.isOwnInternship(internship, currentUser, ownIds)) {
      throw new AppError(403, 'Bạn không có quyền sửa báo cáo này.')
    }
    const allowedFields = currentUser.role === 'lecturer' ? LECTURER_EDITABLE_FIELDS : COMPANY_EDITABLE_FIELDS
    const disallowed = Object.keys(payload).filter((field) => !allowedFields.includes(field))
    if (disallowed.length > 0) {
      throw new AppError(403, `Bạn không được sửa field: ${disallowed.join(', ')}.`)
    }
  }

  // Bất biến hồ sơ 'completed' (đợt kiểm tra trước bảo vệ): báo cáo tổng kết (report_type='final')
  // ĐÃ DUYỆT của 1 hồ sơ ĐÃ hoàn thành không được đổi status nữa (kể cả Admin) — hồ sơ completed phải
  // giữ nguyên bằng chứng đã dùng để cho phép hoàn thành (xem rule in_progress->completed).
  if ('status' in payload && existing.report_type === 'final' && existing.status === 'approved') {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    if (internship.status === 'completed') {
      throw new AppError(
        409,
        'Không thể đổi trạng thái báo cáo tổng kết đã duyệt của hồ sơ đã hoàn thành (completed).',
      )
    }
  }

  const changes = {}

  if ('status' in payload) {
    if (!SETTABLE_STATUSES.includes(payload.status)) {
      throw new AppError(400, `status phải là một trong: ${SETTABLE_STATUSES.join(', ')}.`)
    }
    changes.status = payload.status
  }
  if ('reviewer_comment' in payload) {
    changes.reviewer_comment = resolveOptionalText(payload.reviewer_comment)
  }
  if ('company_comment' in payload) {
    changes.company_comment = resolveOptionalText(payload.company_comment)
  }

  const fields = Object.keys(changes)
  if (fields.length === 0) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  const setClause = fields.map((field) => `${field} = ?`).join(', ')
  const values = fields.map((field) => changes[field])
  await pool.execute(`UPDATE reports SET ${setClause} WHERE id = ?`, [...values, id])

  const updated = await getById(id)

  // Thông báo: Giảng viên duyệt (status/reviewer_comment), hoặc Mentor nhận xét -> báo Sinh viên.
  if ('status' in changes || 'reviewer_comment' in changes || 'company_comment' in changes) {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const studentInfo = await scopeService.getStudentBasicInfo(internship.student_id)
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'report',
      title: 'Báo cáo thực tập có cập nhật mới',
      content: `Báo cáo thực tập #${id} của bạn vừa được duyệt/nhận xét.`,
    })
  }

  return updated
}

// DELETE: không có UI nào (Student/Lecturer/Company/Admin) xóa Report — cung cấp endpoint cho đủ
// REST convention, không có business rule khóa nào để enforce (khác Logs). Xóa kèm file vật lý trên
// đĩa (nếu có) — không để lại file mồ côi khi report bị xóa.
async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy báo cáo.')
  }
  // Cùng bất biến với update(): không xóa báo cáo tổng kết đã duyệt của hồ sơ đã hoàn thành.
  if (existing.report_type === 'final' && existing.status === 'approved') {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    if (internship.status === 'completed') {
      throw new AppError(
        409,
        'Không thể xóa báo cáo tổng kết đã duyệt của hồ sơ đã hoàn thành (completed).',
      )
    }
  }
  await pool.execute('DELETE FROM reports WHERE id = ?', [id])
  await deleteStoredFile(existing.stored_file_name)
}

module.exports = { getAll, getById, getByIdForUser, create, update, remove }
