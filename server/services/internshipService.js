const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const { ALLOWED_TRANSITIONS } = require('../utils/internshipStatus')
const scopeService = require('./scopeService')
const settingsService = require('./settingsService')
const notificationService = require('./notificationService')
const evaluationService = require('./evaluationService')
const { parsePagination } = require('../utils/pagination')

const STATUS_LABEL_VI = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang thực tập',
  completed: 'Hoàn thành',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}

const PROGRESS_LOCKED_STATUSES = ['completed', 'cancelled', 'rejected']
// Bất biến hồ sơ 'completed'/'in_progress' (đợt kiểm tra trước bảo vệ): KHÔNG cho GỠ (set null)
// company_id/lecturer_id/company_mentor_id khi hồ sơ đang ở 1 trong 2 trạng thái này — đổi SANG đối
// tượng khác (active, đúng company) vẫn được khi 'in_progress' (chỉ cấm gỡ hẳn về null, không cấm
// thay thế).
const ASSIGNMENT_LOCKED_STATUSES = ['in_progress', 'completed']
// Internship chỉ cho Student tự đổi company/mentor/topic khi còn ở giai đoạn đầu — đúng
// EDITABLE_STATUSES trong StudentInternshipPage.jsx (mục 7 Phase 3B, trước đây hoãn lại ở Phase 2D
// vì chưa có danh tính thật để enforce).
const STUDENT_EDITABLE_STATUSES = ['pending', 'approved']
const STUDENT_EDITABLE_FIELDS = ['company_id', 'company_mentor_id', 'topic_id']

async function getAll({ search, status, period_id, company_id, lecturer_id, page, pageSize }, currentUser) {
  const conditions = []
  const params = []
  let joinStudents = false

  if (search) {
    joinStudents = true
    conditions.push('(s.student_code LIKE ? OR s.full_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    conditions.push('i.status = ?')
    params.push(status)
  }
  if (period_id) {
    conditions.push('i.period_id = ?')
    params.push(period_id)
  }
  if (company_id) {
    conditions.push('i.company_id = ?')
    params.push(company_id)
  }
  if (lecturer_id) {
    conditions.push('i.lecturer_id = ?')
    params.push(lecturer_id)
  }

  // Data-level scope: KHÔNG tin query param để lọc theo người khác — scope luôn tự suy ra từ
  // danh tính JWT (mục 15/22 Phase 3B), áp dụng SAU các filter phía trên.
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    conditions.push('i.student_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    conditions.push('i.lecturer_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    conditions.push('i.company_mentor_id = ?')
    params.push(own?.id ?? 0)
  }

  const join = joinStudents ? 'JOIN students s ON s.id = i.student_id' : ''
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const pagination = parsePagination({ page, pageSize })
  if (!pagination) {
    const [rows] = await pool.execute(`SELECT i.* FROM internships i ${join} ${where} ORDER BY i.id`, params)
    return { rows, pagination: null }
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM internships i ${join} ${where}`, params)
  const [rows] = await pool.query(
    `SELECT i.* FROM internships i ${join} ${where} ORDER BY i.id LIMIT ? OFFSET ?`,
    [...params, pagination.pageSize, pagination.offset],
  )
  return { rows, pagination: { total, page: pagination.page, pageSize: pagination.pageSize } }
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM internships WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getByIdForUser(id, currentUser) {
  const internship = await getById(id)
  if (!internship) {
    return null
  }
  const ownIds = await scopeService.resolveOwnProfileIds(currentUser)
  if (!scopeService.isOwnInternship(internship, currentUser, ownIds)) {
    throw new AppError(403, 'Bạn không có quyền truy cập hồ sơ thực tập này.')
  }
  return internship
}

async function isDuplicateRegistration(studentId, periodId, ignoreId) {
  const params = [studentId, periodId]
  let query = 'SELECT id FROM internships WHERE student_id = ? AND period_id = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function studentExists(id) {
  const [rows] = await pool.execute('SELECT id FROM students WHERE id = ?', [id])
  return rows.length > 0
}

async function getPeriodById(id) {
  const [rows] = await pool.execute('SELECT * FROM internship_periods WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getCompanyById(id) {
  const [rows] = await pool.execute('SELECT id, status FROM companies WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getMentorById(id) {
  const [rows] = await pool.execute('SELECT id, company_id, status FROM company_mentors WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getLecturerById(id) {
  const [rows] = await pool.execute('SELECT id, status FROM lecturers WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getTopicById(id) {
  const [rows] = await pool.execute('SELECT * FROM topics WHERE id = ?', [id])
  return rows[0] ?? null
}

// Rule mới: Student chỉ được chọn đề tài 'approved' hoặc 'proposed' do CHÍNH MÌNH đề xuất — không
// được chọn đề tài 'rejected' hay đề tài 'proposed' của sinh viên khác. Admin được gán đề tài bất kỳ
// trạng thái nào TRỪ 'rejected'. studentId: id của students (không phải user.id), null nếu không áp dụng.
function assertTopicAssignable(topic, currentUser, studentId) {
  if (currentUser.role === 'student') {
    const isOwnProposed = topic.status === 'proposed' && topic.suggested_by_student_id === studentId
    if (topic.status !== 'approved' && !isOwnProposed) {
      throw new AppError(
        400,
        'Bạn chỉ được chọn đề tài đã duyệt, hoặc đề tài đang đề xuất do chính mình đề xuất.',
      )
    }
    return
  }
  if (topic.status === 'rejected') {
    throw new AppError(400, 'Không thể gán đề tài đã bị từ chối.')
  }
}

// Giới hạn lecturers.max_students (migration 011) — đếm internship 'pending'/'approved'/'in_progress'
// của giảng viên đó TRONG CÙNG ĐỢT (period_id) — 1 giảng viên có thể hướng dẫn nhiều đợt khác nhau
// không bị cộng chung. ignoreInternshipId: loại trừ chính hồ sơ đang sửa (tránh tự đếm mình khi giữ
// nguyên lecturer_id cũ trong 1 request update khác field).
async function assertLecturerCapacity(lecturerId, periodId, ignoreInternshipId) {
  const params = [lecturerId, periodId]
  let query = `SELECT COUNT(*) AS count FROM internships WHERE lecturer_id = ? AND period_id = ? AND status IN ('pending','approved','in_progress')`
  if (ignoreInternshipId) {
    query += ' AND id != ?'
    params.push(ignoreInternshipId)
  }
  const [[{ count }]] = await pool.query(query, params)
  const [[lecturer]] = await pool.execute('SELECT max_students FROM lecturers WHERE id = ?', [lecturerId])
  if (count >= lecturer.max_students) {
    throw new AppError(
      409,
      `Giảng viên này đã đủ số lượng sinh viên hướng dẫn tối đa trong đợt này (${count}/${lecturer.max_students}).`,
    )
  }
}

function resolveOptionalId(value) {
  return value === undefined || value === null || value === '' ? null : Number(value)
}

function resolveOptionalDate(value) {
  return value === undefined || value === null || value === '' ? null : value
}

// CREATE: đúng behavior InternshipsContext.addInternship() / handleRegister (Admin + Student dùng chung
// 1 shape request tối thiểu: chỉ student_id + period_id là bắt buộc). Các field khác là OPTIONAL —
// nếu client gửi kèm thì PHẢI validate/lưu đúng, KHÔNG được silently ignore giá trị sai (sửa theo
// review Phase 2D). Nếu không gửi/gửi null thì giữ mặc định null/0 như Context vẫn làm.
async function create(payload, currentUser) {
  const { period_id, company_id, company_mentor_id, lecturer_id, topic_id, start_date, end_date, progress, status } = payload
  let { student_id } = payload

  // Student tự đăng ký: KHÔNG tin student_id từ client, luôn ép về đúng hồ sơ của chính mình (mục 24
  // Phase 3B — IDOR protection). Gửi kèm student_id KHÁC hồ sơ của mình -> từ chối rõ ràng.
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (!own) {
      throw new AppError(403, 'Tài khoản chưa được liên kết hồ sơ sinh viên.')
    }
    if (student_id !== undefined && Number(student_id) !== own.id) {
      throw new AppError(403, 'Không được tạo hồ sơ thực tập dưới danh nghĩa sinh viên khác.')
    }
    student_id = own.id
  }

  if (!(await studentExists(student_id))) {
    throw new AppError(400, 'Sinh viên không tồn tại.')
  }
  const period = await getPeriodById(period_id)
  if (!period) {
    throw new AppError(400, 'Đợt thực tập không tồn tại.')
  }
  // Rule mới: đợt đã 'closed' thì KHÔNG ai được đăng ký thêm (áp dụng cả Admin) — khác với
  // allow_student_registration (chỉ khóa riêng Student, Admin vẫn tạo được khi registration tắt).
  if (period.status === 'closed') {
    throw new AppError(409, 'Đợt thực tập này đã đóng, không thể đăng ký hồ sơ thực tập mới.')
  }
  if (currentUser.role === 'student') {
    const settings = await settingsService.get()
    if (!settings.allow_student_registration) {
      throw new AppError(403, 'Hệ thống đang tạm khóa đăng ký thực tập mới. Vui lòng liên hệ Admin.')
    }
    const studentProfile = await scopeService.getStudentProfile(currentUser.id)
    if (studentProfile?.status === 'inactive') {
      throw new AppError(403, 'Hồ sơ sinh viên của bạn đang ở trạng thái không hoạt động, không thể đăng ký thực tập.')
    }
  }
  if (await isDuplicateRegistration(student_id, period_id)) {
    throw new AppError(409, 'Sinh viên này đã có hồ sơ thực tập trong đợt đã chọn.')
  }

  // Hồ sơ luôn bắt đầu ở 'pending' (đúng addInternship) — đây là business rule bảo vệ quy trình duyệt,
  // không phải field bị bỏ sót. Cho phép gửi status='pending' (no-op, khớp mặc định), từ chối giá trị khác.
  if (status !== undefined && status !== 'pending') {
    throw new AppError(400, "status không được set khi tạo mới — hồ sơ luôn bắt đầu ở trạng thái 'pending'.")
  }

  const resolvedCompanyId = resolveOptionalId(company_id)
  if (resolvedCompanyId !== null) {
    const company = await getCompanyById(resolvedCompanyId)
    if (!company) {
      throw new AppError(400, 'Doanh nghiệp không tồn tại.')
    }
    if (company.status !== 'active') {
      throw new AppError(400, 'Doanh nghiệp này không ở trạng thái hoạt động, không thể gán.')
    }
  }

  const resolvedLecturerId = resolveOptionalId(lecturer_id)
  if (resolvedLecturerId !== null) {
    const lecturer = await getLecturerById(resolvedLecturerId)
    if (!lecturer) {
      throw new AppError(400, 'Giảng viên không tồn tại.')
    }
    if (lecturer.status !== 'active') {
      throw new AppError(400, 'Giảng viên này không ở trạng thái hoạt động, không thể gán.')
    }
    await assertLecturerCapacity(resolvedLecturerId, period_id)
  }

  const resolvedTopicId = resolveOptionalId(topic_id)
  if (resolvedTopicId !== null) {
    const topic = await getTopicById(resolvedTopicId)
    if (!topic) {
      throw new AppError(400, 'Đề tài không tồn tại.')
    }
    assertTopicAssignable(topic, currentUser, student_id)
  }

  // company_mentor_id: phải tồn tại, đang 'active', VÀ thuộc đúng company_id hiệu lực — giữ nguyên
  // rule Phase 2D (mục H.3), bổ sung check status.
  const resolvedMentorId = resolveOptionalId(company_mentor_id)
  if (resolvedMentorId !== null) {
    const mentor = await getMentorById(resolvedMentorId)
    if (!mentor) {
      throw new AppError(400, 'Người hướng dẫn không tồn tại.')
    }
    if (mentor.status !== 'active') {
      throw new AppError(400, 'Người hướng dẫn này không ở trạng thái hoạt động, không thể gán.')
    }
    if (resolvedCompanyId === null || mentor.company_id !== resolvedCompanyId) {
      throw new AppError(400, 'Người hướng dẫn không thuộc doanh nghiệp đã chọn cho hồ sơ này.')
    }
  }

  const resolvedStartDate = resolveOptionalDate(start_date)
  const resolvedEndDate = resolveOptionalDate(end_date)
  if (resolvedStartDate && resolvedEndDate && resolvedStartDate > resolvedEndDate) {
    throw new AppError(400, 'Ngày kết thúc phải sau ngày bắt đầu.')
  }
  // Rule mới: start_date/end_date của hồ sơ thực tập phải nằm trong khoảng start_date/end_date của đợt.
  if (resolvedStartDate && resolvedStartDate < period.start_date) {
    throw new AppError(400, 'Ngày bắt đầu phải nằm trong khoảng thời gian của đợt thực tập.')
  }
  if (resolvedEndDate && resolvedEndDate > period.end_date) {
    throw new AppError(400, 'Ngày kết thúc phải nằm trong khoảng thời gian của đợt thực tập.')
  }

  // progress: status luôn là 'pending' lúc tạo (không nằm trong PROGRESS_LOCKED_STATUSES) nên không có
  // tình huống khóa progress ở bước tạo mới — chỉ cần validate range, giữ nguyên rule chung 0-100.
  let resolvedProgress = 0
  if (progress !== undefined && progress !== null && progress !== '') {
    const value = Number(progress)
    if (Number.isNaN(value) || value < 0 || value > 100) {
      throw new AppError(400, 'Tiến độ phải nằm trong khoảng 0-100.')
    }
    resolvedProgress = value
  }

  const [result] = await pool.execute(
    `INSERT INTO internships
      (student_id, period_id, company_id, company_mentor_id, lecturer_id, topic_id, start_date, end_date, status, progress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      student_id,
      period_id,
      resolvedCompanyId,
      resolvedMentorId,
      resolvedLecturerId,
      resolvedTopicId,
      resolvedStartDate,
      resolvedEndDate,
      resolvedProgress,
    ],
  )
  const created = await getById(result.insertId)

  // Thông báo: Sinh viên tự đăng ký (KHÔNG áp dụng khi Admin tạo hộ) -> báo mọi Admin để duyệt.
  if (currentUser.role === 'student') {
    const studentInfo = await scopeService.getStudentBasicInfo(student_id)
    const adminIds = await scopeService.getAdminUserIds()
    const title = 'Có hồ sơ thực tập mới chờ duyệt'
    const content = `Sinh viên ${studentInfo?.full_name ?? ''} (MSSV ${studentInfo?.student_code ?? ''}) vừa đăng ký hồ sơ thực tập (mã hồ sơ #${created.id}), đang chờ duyệt.`
    for (const adminId of adminIds) {
      await notificationService.notify({ userId: adminId, type: 'internship', title, content })
    }
  }

  return created
}

// UPDATE: PARTIAL (giống hệt InternshipsContext.updateInternship(id, changes) — merge, không phải
// full-replace) vì Frontend có 5+ điểm gọi update độc lập (đổi trạng thái, sửa tiến độ, phân công
// giảng viên, phân công DN+mentor, chọn đề tài) — KHÔNG có 1 form "sửa tất cả" duy nhất cho Internship.
// Chỉ field nào có mặt trong payload mới được validate/ghi đè; field vắng mặt giữ nguyên giá trị cũ.
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy hồ sơ thực tập.')
  }

  // Student: chỉ sửa hồ sơ CHÍNH MÌNH, chỉ 3 field (company_id/company_mentor_id/topic_id — đúng
  // StudentProposeCompanyModal.jsx/StudentProposeTopicModal.jsx), và chỉ khi hồ sơ còn ở giai đoạn
  // đầu (EDITABLE_STATUSES) — rule đã biết từ Phase 2D, nay enforce được vì đã có danh tính thật.
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (!own || own.id !== existing.student_id) {
      throw new AppError(403, 'Bạn không có quyền sửa hồ sơ thực tập này.')
    }
    const disallowed = Object.keys(payload).filter((field) => !STUDENT_EDITABLE_FIELDS.includes(field))
    if (disallowed.length > 0) {
      throw new AppError(403, `Bạn không được tự sửa field: ${disallowed.join(', ')}.`)
    }
    if (!STUDENT_EDITABLE_STATUSES.includes(existing.status)) {
      throw new AppError(409, `Không thể sửa hồ sơ khi đang ở trạng thái "${existing.status}".`)
    }
  }

  // student_id/period_id là immutable sau khi tạo — không có UI nào cho sửa 2 field này. Từ chối
  // ngay khi field có mặt trong body (kể cả gửi trùng giá trị cũ) — không silently ignore/no-op.
  if ('student_id' in payload) {
    throw new AppError(400, 'student_id là immutable — không được gửi field này khi cập nhật hồ sơ thực tập.')
  }
  if ('period_id' in payload) {
    throw new AppError(400, 'period_id là immutable — không được gửi field này khi cập nhật hồ sơ thực tập.')
  }

  const changes = {}

  if ('company_id' in payload) {
    const value = payload.company_id === null || payload.company_id === '' ? null : Number(payload.company_id)
    if (value === null && ASSIGNMENT_LOCKED_STATUSES.includes(existing.status)) {
      throw new AppError(409, `Không thể gỡ doanh nghiệp khi hồ sơ đang ở trạng thái "${existing.status}" — chỉ được đổi sang doanh nghiệp khác.`)
    }
    if (value !== null) {
      const company = await getCompanyById(value)
      if (!company) {
        throw new AppError(400, 'Doanh nghiệp không tồn tại.')
      }
      if (company.status !== 'active') {
        throw new AppError(400, 'Doanh nghiệp này không ở trạng thái hoạt động, không thể gán.')
      }
    }
    changes.company_id = value
  }

  if ('lecturer_id' in payload) {
    const value = payload.lecturer_id === null || payload.lecturer_id === '' ? null : Number(payload.lecturer_id)
    if (value === null && ASSIGNMENT_LOCKED_STATUSES.includes(existing.status)) {
      throw new AppError(409, `Không thể gỡ giảng viên khi hồ sơ đang ở trạng thái "${existing.status}" — chỉ được đổi sang giảng viên khác.`)
    }
    if (value !== null) {
      const lecturer = await getLecturerById(value)
      if (!lecturer) {
        throw new AppError(400, 'Giảng viên không tồn tại.')
      }
      if (lecturer.status !== 'active') {
        throw new AppError(400, 'Giảng viên này không ở trạng thái hoạt động, không thể gán.')
      }
      await assertLecturerCapacity(value, existing.period_id, id)
    }
    changes.lecturer_id = value
  }

  if ('topic_id' in payload) {
    const value = payload.topic_id === null || payload.topic_id === '' ? null : Number(payload.topic_id)
    if (value !== null) {
      const topic = await getTopicById(value)
      if (!topic) {
        throw new AppError(400, 'Đề tài không tồn tại.')
      }
      const studentIdForCheck = currentUser.role === 'student' ? existing.student_id : null
      assertTopicAssignable(topic, currentUser, studentIdForCheck)
    }
    changes.topic_id = value
  }

  // company_mentor_id: phải tồn tại, đang 'active', VÀ đúng thuộc company hiệu lực (company_id mới
  // nếu có đổi, hoặc company_id hiện tại nếu không đổi) — đúng Database Design mục H.3, dựa theo
  // cascading-select của AssignCompanyModal.jsx, bổ sung check status.
  if ('company_mentor_id' in payload) {
    const value =
      payload.company_mentor_id === null || payload.company_mentor_id === '' ? null : Number(payload.company_mentor_id)
    if (value === null && ASSIGNMENT_LOCKED_STATUSES.includes(existing.status)) {
      throw new AppError(409, `Không thể gỡ người hướng dẫn khi hồ sơ đang ở trạng thái "${existing.status}" — chỉ được đổi sang người hướng dẫn khác.`)
    }
    if (value !== null) {
      const mentor = await getMentorById(value)
      if (!mentor) {
        throw new AppError(400, 'Người hướng dẫn không tồn tại.')
      }
      if (mentor.status !== 'active') {
        throw new AppError(400, 'Người hướng dẫn này không ở trạng thái hoạt động, không thể gán.')
      }
      const effectiveCompanyId = 'company_id' in changes ? changes.company_id : existing.company_id
      if (effectiveCompanyId === null || mentor.company_id !== effectiveCompanyId) {
        throw new AppError(400, 'Người hướng dẫn không thuộc doanh nghiệp đã chọn cho hồ sơ này.')
      }
    }
    changes.company_mentor_id = value
  } else if ('company_id' in changes && existing.company_mentor_id !== null) {
    // Đổi company nhưng không đổi mentor trong cùng request -> mentor cũ có thể không còn thuộc company mới.
    const mentor = await getMentorById(existing.company_mentor_id)
    if (!mentor || mentor.company_id !== changes.company_id) {
      throw new AppError(
        400,
        'Người hướng dẫn hiện tại không thuộc doanh nghiệp mới — vui lòng gửi kèm company_mentor_id khi đổi doanh nghiệp.',
      )
    }
  }

  // status: chỉ cho đi đúng ALLOWED_TRANSITIONS[status hiện tại]. Chuyển sang 'completed' luôn ép
  // progress = 100 (đúng handleStatusChange trong InternshipDetailPage.jsx), bất kể payload có gửi
  // progress khác hay không.
  if ('status' in payload) {
    const nextStatus = payload.status
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        409,
        `Không thể chuyển trạng thái từ "${existing.status}" sang "${nextStatus}".`,
      )
    }

    // Rule mới: approved -> in_progress bắt buộc đã phân công đủ Giảng viên + Doanh nghiệp +
    // Người hướng dẫn (lấy giá trị HIỆU LỰC — có thể vừa đổi trong cùng request này).
    if (nextStatus === 'in_progress') {
      const effectiveLecturerId = 'lecturer_id' in changes ? changes.lecturer_id : existing.lecturer_id
      const effectiveCompanyId = 'company_id' in changes ? changes.company_id : existing.company_id
      const effectiveMentorId = 'company_mentor_id' in changes ? changes.company_mentor_id : existing.company_mentor_id
      if (!effectiveLecturerId || !effectiveCompanyId || !effectiveMentorId) {
        throw new AppError(
          409,
          'Phải phân công đủ Giảng viên, Doanh nghiệp và Người hướng dẫn trước khi chuyển sang "in_progress".',
        )
      }
    }

    // Rule: in_progress -> completed bắt buộc đã có ít nhất 1 báo cáo tổng kết (report_type='final')
    // đã được duyệt ('approved'), VÀ đủ đánh giá ĐÃ CÔNG BỐ (is_published=1) từ cả Giảng viên và
    // Doanh nghiệp. Siết từ "chỉ cần tồn tại" lên "phải công bố" (phát hiện trong đợt kiểm tra trước
    // bảo vệ) — nếu không, 1 hồ sơ có thể "completed" trong khi đánh giá vẫn ở dạng nháp chưa công
    // bố, khiến GET /internships/:id/final-result (Mục 16C) không có giá trị cho 1 hồ sơ ĐÃ hoàn
    // thành — vô lý về nghiệp vụ (hồ sơ hoàn thành phải luôn có điểm tổng kết tính được ngay).
    if (nextStatus === 'completed') {
      const [[reportCheck]] = await pool.execute(
        `SELECT COUNT(*) AS count FROM reports WHERE internship_id = ? AND report_type = 'final' AND status = 'approved'`,
        [id],
      )
      if (reportCheck.count === 0) {
        throw new AppError(
          409,
          'Phải có ít nhất 1 báo cáo tổng kết (report_type="final") đã được duyệt trước khi chuyển sang "completed".',
        )
      }
      const [[evalCheck]] = await pool.execute(
        `SELECT COUNT(DISTINCT evaluator_role) AS count FROM evaluations WHERE internship_id = ? AND evaluator_role IN ('lecturer', 'company') AND is_published = 1`,
        [id],
      )
      if (evalCheck.count < 2) {
        throw new AppError(
          409,
          'Phải có đủ đánh giá ĐÃ CÔNG BỐ từ cả Giảng viên và Doanh nghiệp trước khi chuyển sang "completed".',
        )
      }

      // Chốt điểm tổng kết NGAY LÚC NÀY (gọi TRƯỚC khi status trong DB đổi thành 'completed' — nên
      // computeFinalResult() vẫn tính "sống" theo trọng số HIỆN TẠI, không đọc lại giá trị đã chốt
      // của chính nó) — ghi vào CÙNG câu UPDATE với status, để DB không bao giờ có trạng thái nửa vời
      // "completed nhưng chưa có final_score". Từ đây về sau, đổi trọng số Settings không ảnh hưởng.
      const finalResult = await evaluationService.computeFinalResult(id)
      if (!finalResult) {
        // Không nên xảy ra (đã check evalCheck ở trên) — phòng hờ race condition giữa 2 request.
        throw new AppError(409, 'Chưa đủ dữ liệu để tính điểm tổng kết — vui lòng thử lại.')
      }
      changes.final_score = finalResult.finalScore
      changes.final_classification = finalResult.classification
    }

    changes.status = nextStatus
    if (nextStatus === 'completed') {
      changes.progress = 100
    }
  }

  if ('progress' in payload && changes.progress === undefined) {
    // Khóa progress theo đúng canEditProgress của InternshipDetailPage.jsx: dựa trên status HIỆN TẠI
    // (trước update), không phải status mới — 2 control (đổi trạng thái / sửa tiến độ) độc lập nhau
    // trên UI thật, không có form nào gộp chung cả 2 hành động.
    if (PROGRESS_LOCKED_STATUSES.includes(existing.status)) {
      throw new AppError(409, `Không thể sửa tiến độ khi hồ sơ đang ở trạng thái "${existing.status}".`)
    }
    const value = Number(payload.progress)
    if (Number.isNaN(value) || value < 0 || value > 100) {
      throw new AppError(400, 'Tiến độ phải nằm trong khoảng 0-100.')
    }
    changes.progress = value
  }

  if ('start_date' in payload) {
    changes.start_date = payload.start_date === null || payload.start_date === '' ? null : payload.start_date
  }
  if ('end_date' in payload) {
    changes.end_date = payload.end_date === null || payload.end_date === '' ? null : payload.end_date
  }
  if (changes.start_date && changes.end_date && changes.start_date > changes.end_date) {
    throw new AppError(400, 'Ngày kết thúc phải sau ngày bắt đầu.')
  }
  // Rule mới: start_date/end_date phải nằm trong khoảng của đợt thực tập — period_id immutable nên
  // luôn dùng đúng period của existing.
  if ('start_date' in changes || 'end_date' in changes) {
    const period = await getPeriodById(existing.period_id)
    const effectiveStart = 'start_date' in changes ? changes.start_date : existing.start_date
    const effectiveEnd = 'end_date' in changes ? changes.end_date : existing.end_date
    if (period && effectiveStart && effectiveStart < period.start_date) {
      throw new AppError(400, 'Ngày bắt đầu phải nằm trong khoảng thời gian của đợt thực tập.')
    }
    if (period && effectiveEnd && effectiveEnd > period.end_date) {
      throw new AppError(400, 'Ngày kết thúc phải nằm trong khoảng thời gian của đợt thực tập.')
    }
  }

  const fields = Object.keys(changes)
  if (fields.length === 0) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  const setClause = fields.map((field) => `${field} = ?`).join(', ')
  const values = fields.map((field) => changes[field])
  await pool.execute(`UPDATE internships SET ${setClause} WHERE id = ?`, [...values, id])

  const updated = await getById(id)

  // Thông báo: đổi trạng thái -> báo Sinh viên của hồ sơ.
  if ('status' in changes) {
    const studentInfo = await scopeService.getStudentBasicInfo(existing.student_id)
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'internship',
      title: 'Hồ sơ thực tập cập nhật trạng thái',
      content: `Hồ sơ thực tập #${id} của bạn đã chuyển sang trạng thái "${STATUS_LABEL_VI[changes.status] ?? changes.status}".`,
    })
  }

  // Thông báo: vừa phân công Giảng viên mới -> báo Sinh viên + Giảng viên đó.
  if ('lecturer_id' in changes && changes.lecturer_id !== null) {
    const [studentInfo, lecturerInfo] = await Promise.all([
      scopeService.getStudentBasicInfo(existing.student_id),
      scopeService.getLecturerBasicInfo(changes.lecturer_id),
    ])
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'assignment',
      title: 'Được phân công giảng viên hướng dẫn',
      content: `Hồ sơ thực tập #${id} của bạn đã được phân công giảng viên hướng dẫn: ${lecturerInfo?.full_name ?? ''}.`,
    })
    await notificationService.notify({
      userId: lecturerInfo?.user_id,
      type: 'assignment',
      title: 'Được phân công hướng dẫn sinh viên',
      content: `Bạn được phân công hướng dẫn sinh viên ${studentInfo?.full_name ?? ''} (hồ sơ thực tập #${id}).`,
    })
  }

  // Thông báo: vừa phân công Người hướng dẫn doanh nghiệp mới -> báo Sinh viên + Mentor đó.
  if ('company_mentor_id' in changes && changes.company_mentor_id !== null) {
    const [studentInfo, mentorInfo] = await Promise.all([
      scopeService.getStudentBasicInfo(existing.student_id),
      scopeService.getCompanyMentorBasicInfo(changes.company_mentor_id),
    ])
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'assignment',
      title: 'Được phân công người hướng dẫn doanh nghiệp',
      content: `Hồ sơ thực tập #${id} của bạn đã được phân công người hướng dẫn: ${mentorInfo?.full_name ?? ''}.`,
    })
    await notificationService.notify({
      userId: mentorInfo?.user_id,
      type: 'assignment',
      title: 'Được phân công hướng dẫn sinh viên',
      content: `Bạn được phân công hướng dẫn sinh viên ${studentInfo?.full_name ?? ''} (hồ sơ thực tập #${id}).`,
    })
  }

  return updated
}

// DELETE: chỉ cho phép khi status = 'pending' (đúng InternshipDetailPage.jsx — nút "Xóa hồ sơ" chỉ
// hiện khi status === 'pending'). internship_logs/reports/evaluations CASCADE theo đúng thiết kế đã
// duyệt (weak entity) — không cần chặn thêm, để DB tự dọn.
async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy hồ sơ thực tập.')
  }
  if (existing.status !== 'pending') {
    throw new AppError(409, 'Chỉ có thể xóa hồ sơ thực tập đang ở trạng thái "pending".')
  }

  await pool.execute('DELETE FROM internships WHERE id = ?', [id])
}

module.exports = { getAll, getById, getByIdForUser, create, update, remove, isDuplicateRegistration }
