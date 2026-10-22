const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const notificationService = require('./notificationService')
const { parsePagination } = require('../utils/pagination')
const { todayDateString } = require('../utils/dateTime')

// Field nội dung do Student ghi — bị khóa (không sửa/xóa) khi status = 'reviewed', đúng
// StudentLogsPage.jsx (isLocked = row.status === 'reviewed').
const CONTENT_FIELDS = ['log_date', 'title', 'content', 'result', 'difficulties', 'next_plan', 'note', 'progress', 'attachment']
const LECTURER_EDITABLE_FIELDS = ['lecturer_comment', 'status']
const COMPANY_EDITABLE_FIELDS = ['company_comment']

function resolveOptionalText(value) {
  return value === undefined || value === null || value === '' ? null : value
}

// Rule mới: log_date không được ở tương lai, và nếu internship có start_date/end_date thì log_date
// phải nằm trong khoảng đó (phản ánh đúng nghiệp vụ: không ghi nhật ký cho giai đoạn chưa/đã kết thúc).
function validateLogDate(logDate, internship) {
  if (logDate > todayDateString()) {
    throw new AppError(400, 'log_date không được ở tương lai.')
  }
  if (internship.start_date && logDate < internship.start_date) {
    throw new AppError(400, 'log_date phải nằm trong khoảng thời gian thực tập.')
  }
  if (internship.end_date && logDate > internship.end_date) {
    throw new AppError(400, 'log_date phải nằm trong khoảng thời gian thực tập.')
  }
}

async function getAll({ internship_id, page, pageSize }, currentUser) {
  const conditions = []
  const params = []
  if (internship_id) {
    conditions.push('l.internship_id = ?')
    params.push(internship_id)
  }

  let join = ''
  if (currentUser.role !== 'admin') {
    const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
    join = 'JOIN internships i ON i.id = l.internship_id'
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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const pagination = parsePagination({ page, pageSize })
  if (!pagination) {
    const [rows] = await pool.execute(`SELECT l.* FROM internship_logs l ${join} ${where} ORDER BY l.id`, params)
    return { rows, pagination: null }
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM internship_logs l ${join} ${where}`, params)
  const [rows] = await pool.query(
    `SELECT l.* FROM internship_logs l ${join} ${where} ORDER BY l.id LIMIT ? OFFSET ?`,
    [...params, pagination.pageSize, pagination.offset],
  )
  return { rows, pagination: { total, page: pagination.page, pageSize: pagination.pageSize } }
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM internship_logs WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getByIdForUser(id, currentUser) {
  const log = await getById(id)
  if (!log) {
    return null
  }
  await scopeService.assertOwnInternshipById(log.internship_id, currentUser)
  return log
}

function validateProgress(value) {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0 || num > 100) {
    throw new AppError(400, 'Tiến độ phải nằm trong khoảng 0-100.')
  }
  return num
}

// CREATE: chỉ Student tạo (StudentLogsPage.jsx) cho ĐÚNG internship của chính mình — Admin được tạo
// cho bất kỳ internship nào (bypass scope nhưng vẫn phải qua business rule 'in_progress' — mục 18).
async function create(payload, currentUser) {
  const {
    internship_id, log_date, title, content, result, difficulties, next_plan, note, progress, attachment,
    status, lecturer_comment, company_comment,
  } = payload

  const internship = await scopeService.getInternshipOrThrow(internship_id).catch(() => null)
  if (!internship) {
    throw new AppError(400, 'Hồ sơ thực tập không tồn tại.')
  }

  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (!own || internship.student_id !== own.id) {
      throw new AppError(403, 'Bạn chỉ được ghi nhật ký cho hồ sơ thực tập của chính mình.')
    }
  }

  if (internship.status !== 'in_progress') {
    throw new AppError(409, 'Chỉ được ghi nhật ký khi hồ sơ thực tập đang ở trạng thái "in_progress".')
  }

  validateLogDate(log_date, internship)

  if (status !== undefined && status !== 'submitted') {
    throw new AppError(400, "status không được set khi tạo mới — nhật ký luôn bắt đầu ở trạng thái 'submitted'.")
  }
  if (lecturer_comment) {
    throw new AppError(400, 'lecturer_comment không được set khi tạo mới.')
  }
  if (company_comment) {
    throw new AppError(400, 'company_comment không được set khi tạo mới.')
  }

  const resolvedProgress = progress === undefined || progress === null || progress === '' ? 0 : validateProgress(progress)

  const [insertResult] = await pool.execute(
    `INSERT INTO internship_logs
      (internship_id, log_date, title, content, result, difficulties, next_plan, note, progress, attachment, lecturer_comment, company_comment, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'submitted')`,
    [
      internship_id,
      log_date,
      title,
      content,
      resolveOptionalText(result),
      resolveOptionalText(difficulties),
      resolveOptionalText(next_plan),
      resolveOptionalText(note),
      resolvedProgress,
      resolveOptionalText(attachment),
    ],
  )
  const created = await getById(insertResult.insertId)

  // Thông báo: Sinh viên nộp nhật ký mới -> báo Giảng viên + Mentor của hồ sơ này.
  if (currentUser.role === 'student') {
    const studentInfo = await scopeService.getStudentBasicInfo(internship.student_id)
    const [lecturerInfo, mentorInfo] = await Promise.all([
      scopeService.getLecturerBasicInfo(internship.lecturer_id),
      scopeService.getCompanyMentorBasicInfo(internship.company_mentor_id),
    ])
    const notifyTitle = 'Sinh viên vừa nộp nhật ký thực tập'
    const content = `Sinh viên ${studentInfo?.full_name ?? ''} vừa nộp nhật ký "${title}" cho hồ sơ thực tập #${internship_id}.`
    await notificationService.notify({ userId: lecturerInfo?.user_id, type: 'log', title: notifyTitle, content })
    await notificationService.notify({ userId: mentorInfo?.user_id, type: 'log', title: notifyTitle, content })
  }

  return created
}

// UPDATE: PARTIAL — 3 điểm gọi thật sự khác nhau theo đúng 3 role (Student sửa nội dung, Lecturer
// nhận xét + chuyển 'reviewed', Company chỉ thêm company_comment). Admin bypass scope nhưng field
// nào cũng phải qua đúng business rule (lock khi reviewed, transition 1 chiều) — mục 18.
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy nhật ký thực tập.')
  }

  if ('internship_id' in payload) {
    throw new AppError(400, 'internship_id là immutable — không được gửi field này khi cập nhật nhật ký.')
  }

  if (currentUser.role !== 'admin') {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
    if (!scopeService.isOwnInternship(internship, currentUser, ownIds)) {
      throw new AppError(403, 'Bạn không có quyền sửa nhật ký này.')
    }

    const allowedFields =
      currentUser.role === 'student'
        ? CONTENT_FIELDS
        : currentUser.role === 'lecturer'
          ? LECTURER_EDITABLE_FIELDS
          : currentUser.role === 'company_mentor'
            ? COMPANY_EDITABLE_FIELDS
            : []
    const disallowed = Object.keys(payload).filter((field) => !allowedFields.includes(field))
    if (disallowed.length > 0) {
      throw new AppError(403, `Bạn không được sửa field: ${disallowed.join(', ')}.`)
    }
  }

  const changes = {}
  const touchesContent = CONTENT_FIELDS.some((field) => field in payload)
  if (touchesContent && existing.status === 'reviewed') {
    throw new AppError(409, 'Không thể sửa nội dung nhật ký đã được giảng viên nhận xét ("reviewed").')
  }

  if ('log_date' in payload) {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    validateLogDate(payload.log_date, internship)
  }

  CONTENT_FIELDS.forEach((field) => {
    if (field in payload) {
      changes[field] = field === 'progress' ? validateProgress(payload.progress) : resolveOptionalText(payload[field])
    }
  })

  if ('status' in payload) {
    const nextStatus = payload.status
    if (nextStatus === 'reviewed') {
      if (!['submitted', 'reviewed'].includes(existing.status)) {
        throw new AppError(409, `Không thể chuyển trạng thái từ "${existing.status}" sang "reviewed".`)
      }
      changes.status = 'reviewed'
    } else if (nextStatus === 'submitted') {
      throw new AppError(409, 'Không thể chuyển nhật ký đã "reviewed" trở lại "submitted".')
    } else {
      throw new AppError(400, "status phải là 'reviewed' (đúng luồng Lecturer nhận xét).")
    }
  }

  if ('lecturer_comment' in payload) {
    changes.lecturer_comment = resolveOptionalText(payload.lecturer_comment)
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
  await pool.execute(`UPDATE internship_logs SET ${setClause} WHERE id = ?`, [...values, id])

  const updated = await getById(id)

  // Thông báo: Giảng viên nhận xét/duyệt, hoặc Company Mentor nhận xét -> báo Sinh viên.
  if ('lecturer_comment' in changes || 'company_comment' in changes || changes.status === 'reviewed') {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const studentInfo = await scopeService.getStudentBasicInfo(internship.student_id)
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'log',
      title: 'Nhật ký thực tập có nhận xét mới',
      content: `Nhật ký thực tập #${id} của bạn vừa được nhận xét/cập nhật.`,
    })
  }

  return updated
}

// DELETE: Student xóa log của chính mình (chưa 'reviewed') — Admin bypass scope nhưng vẫn qua
// đúng business rule khóa khi đã reviewed (mục 18). Lecturer/Company Mentor không có quyền xóa
// (chặn ở route, không có UI nào cho phép).
async function remove(id, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy nhật ký thực tập.')
  }

  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    if (!own || internship.student_id !== own.id) {
      throw new AppError(403, 'Bạn không có quyền xóa nhật ký này.')
    }
  }

  if (existing.status === 'reviewed') {
    throw new AppError(409, 'Không thể xóa nhật ký đã được giảng viên nhận xét ("reviewed").')
  }

  await pool.execute('DELETE FROM internship_logs WHERE id = ?', [id])
}

module.exports = { getAll, getById, getByIdForUser, create, update, remove }
