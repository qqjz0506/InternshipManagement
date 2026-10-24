const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const settingsService = require('./settingsService')
const notificationService = require('./notificationService')
const positionService = require('./internshipPositionService')

const MAX_PENDING_APPLICATIONS = 3
// internships tạo/cập nhật từ accept() đi thẳng vào 'approved' (chấp nhận đơn CHÍNH LÀ hành động
// duyệt) — các status khác coi như "đã xử lý qua đường khác", accept() không được lùi lại.
const BLOCKING_INTERNSHIP_STATUSES = ['approved', 'in_progress', 'completed']

async function getAll({ position_id, status }, currentUser) {
  const conditions = []
  const params = []

  if (position_id) {
    conditions.push('a.position_id = ?')
    params.push(position_id)
  }
  if (status) {
    conditions.push('a.status = ?')
    params.push(status)
  }

  let join = ''
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    conditions.push('a.student_id = ?')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const ownCompanyId = await positionService.getMentorCompanyId(currentUser)
    join = 'JOIN internship_positions p ON p.id = a.position_id'
    conditions.push('p.company_id = ?')
    params.push(ownCompanyId ?? 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(
    `SELECT a.* FROM position_applications a ${join} ${where} ORDER BY a.id DESC`,
    params,
  )
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM position_applications WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getExistingInternship(studentId, periodId) {
  const [rows] = await pool.execute(
    'SELECT * FROM internships WHERE student_id = ? AND period_id = ?',
    [studentId, periodId],
  )
  return rows[0] ?? null
}

async function notifyCompanyMentorsAndAdmins(companyId, title, content) {
  const [mentorRows] = await pool.execute(
    'SELECT user_id FROM company_mentors WHERE company_id = ? AND user_id IS NOT NULL',
    [companyId],
  )
  const adminIds = await scopeService.getAdminUserIds()
  const recipientIds = [...mentorRows.map((row) => row.user_id), ...adminIds]
  for (const userId of recipientIds) {
    await notificationService.notify({ userId, type: 'internship', title, content })
  }
}

// Ứng tuyển — CHỈ Student, cho CHÍNH MÌNH (không nhận student_id từ client, luôn ép theo currentUser,
// giống internshipService.create()). Validate theo đúng thứ tự: vị trí/đợt hợp lệ -> cho phép đăng
// ký -> chưa có internship khác đã approved trong đợt -> chưa đủ 3 đơn đang chờ -> không trùng đơn.
async function apply(positionId, note, currentUser) {
  const studentProfile = await scopeService.getStudentProfile(currentUser.id)
  if (!studentProfile) {
    throw new AppError(403, 'Tài khoản chưa được liên kết hồ sơ sinh viên.')
  }

  const position = await positionService.getById(positionId)
  if (!position) {
    throw new AppError(404, 'Không tìm thấy vị trí thực tập.')
  }
  if (position.status !== 'open') {
    throw new AppError(409, 'Vị trí thực tập này đã đóng, không thể ứng tuyển.')
  }

  const [[period]] = await pool.execute('SELECT status FROM internship_periods WHERE id = ?', [position.period_id])
  if (period.status === 'closed') {
    throw new AppError(409, 'Đợt thực tập của vị trí này đã đóng, không thể ứng tuyển.')
  }

  const settings = await settingsService.get()
  if (!settings.allow_student_registration) {
    throw new AppError(403, 'Hệ thống đang tạm khóa đăng ký thực tập mới. Vui lòng liên hệ Admin.')
  }
  if (studentProfile.status === 'inactive') {
    throw new AppError(403, 'Hồ sơ sinh viên của bạn đang ở trạng thái không hoạt động, không thể ứng tuyển.')
  }

  const existingInternship = await getExistingInternship(studentProfile.id, position.period_id)
  if (existingInternship && BLOCKING_INTERNSHIP_STATUSES.includes(existingInternship.status)) {
    throw new AppError(409, 'Bạn đã có hồ sơ thực tập (đã duyệt hoặc đang thực hiện) trong đợt này, không thể ứng tuyển vị trí khác.')
  }

  const [[{ pendingCount }]] = await pool.query(
    "SELECT COUNT(*) AS pendingCount FROM position_applications WHERE student_id = ? AND status = 'applied'",
    [studentProfile.id],
  )
  if (pendingCount >= MAX_PENDING_APPLICATIONS) {
    throw new AppError(409, `Bạn đang có ${pendingCount} đơn chờ xử lý — tối đa ${MAX_PENDING_APPLICATIONS} đơn cùng lúc.`)
  }

  const existingApplication = await pool
    .execute('SELECT * FROM position_applications WHERE position_id = ? AND student_id = ?', [positionId, studentProfile.id])
    .then(([rows]) => rows[0] ?? null)

  let application
  if (!existingApplication) {
    const [result] = await pool.execute(
      `INSERT INTO position_applications (position_id, student_id, status, note) VALUES (?, ?, 'applied', ?)`,
      [positionId, studentProfile.id, note ?? null],
    )
    application = await getById(result.insertId)
  } else if (['applied', 'accepted'].includes(existingApplication.status)) {
    throw new AppError(409, 'Bạn đã ứng tuyển vị trí này rồi.')
  } else {
    // 'withdrawn'/'rejected' trước đó -> ứng tuyển lại = UPDATE lại dòng cũ (UNIQUE(position_id,
    // student_id) không cho phép INSERT dòng mới).
    await pool.execute(
      "UPDATE position_applications SET status = 'applied', note = ? WHERE id = ?",
      [note ?? null, existingApplication.id],
    )
    application = await getById(existingApplication.id)
  }

  await notifyCompanyMentorsAndAdmins(
    position.company_id,
    'Có sinh viên mới ứng tuyển vị trí thực tập',
    `Sinh viên ${studentProfile.full_name} (MSSV ${studentProfile.student_code}) vừa ứng tuyển vị trí "${position.title}".`,
  )

  return application
}

async function assertOwnApplicationOrManage(application, currentUser) {
  if (currentUser.role === 'admin') {
    return
  }
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    if (own?.id === application.student_id) {
      return
    }
  }
  if (currentUser.role === 'company_mentor') {
    const position = await positionService.getById(application.position_id)
    const ownCompanyId = await positionService.getMentorCompanyId(currentUser)
    if (position && ownCompanyId !== null && position.company_id === ownCompanyId) {
      return
    }
  }
  throw new AppError(403, 'Bạn không có quyền thực hiện hành động này trên đơn ứng tuyển này.')
}

// Rút đơn — CHỈ chính Student, CHỈ khi còn 'applied'.
async function withdraw(id, currentUser) {
  const application = await getById(id)
  if (!application) {
    throw new AppError(404, 'Không tìm thấy đơn ứng tuyển.')
  }
  if (currentUser.role !== 'student') {
    throw new AppError(403, 'Chỉ Sinh viên được rút đơn ứng tuyển của chính mình.')
  }
  const own = await scopeService.getStudentProfile(currentUser.id)
  if (own?.id !== application.student_id) {
    throw new AppError(403, 'Bạn không có quyền rút đơn ứng tuyển này.')
  }
  if (application.status !== 'applied') {
    throw new AppError(409, `Không thể rút đơn đang ở trạng thái "${application.status}".`)
  }

  await pool.execute("UPDATE position_applications SET status = 'withdrawn' WHERE id = ?", [id])
  return getById(id)
}

// Từ chối — Admin hoặc Company Mentor (đúng công ty của vị trí), CHỈ khi còn 'applied'.
async function reject(id, currentUser) {
  const application = await getById(id)
  if (!application) {
    throw new AppError(404, 'Không tìm thấy đơn ứng tuyển.')
  }
  await assertOwnApplicationOrManage(application, currentUser)
  if (currentUser.role === 'student') {
    throw new AppError(403, 'Sinh viên không được từ chối đơn ứng tuyển — chỉ được rút đơn.')
  }
  if (application.status !== 'applied') {
    throw new AppError(409, `Không thể từ chối đơn đang ở trạng thái "${application.status}".`)
  }

  await pool.execute("UPDATE position_applications SET status = 'rejected' WHERE id = ?", [id])

  const studentInfo = await scopeService.getStudentBasicInfo(application.student_id)
  const position = await positionService.getById(application.position_id)
  await notificationService.notify({
    userId: studentInfo?.user_id,
    type: 'internship',
    title: 'Đơn ứng tuyển vị trí thực tập bị từ chối',
    content: `Đơn ứng tuyển vị trí "${position?.title ?? ''}" của bạn đã bị từ chối.`,
  })

  return getById(id)
}

// Chấp nhận — Admin hoặc Company Mentor (đúng công ty). Transaction + SELECT...FOR UPDATE trên
// internship_positions để chống vượt slot khi nhiều request chấp nhận ĐỒNG THỜI cho CÙNG 1 vị trí
// (claim-ticket kiểu: khóa hàng position trước, đếm accepted TRONG transaction đó, chỉ 1 request
// thắng nếu vừa đủ slot cuối cùng — các request khác lock-wait rồi thấy count đã đủ, tự 409).
async function accept(id, currentUser) {
  const application = await getById(id)
  if (!application) {
    throw new AppError(404, 'Không tìm thấy đơn ứng tuyển.')
  }
  await assertOwnApplicationOrManage(application, currentUser)
  if (currentUser.role === 'student') {
    throw new AppError(403, 'Sinh viên không được chấp nhận đơn ứng tuyển.')
  }

  // Mentor chấp nhận -> company_mentor_id của internship = ĐÚNG hồ sơ mentor đang đăng nhập. Admin
  // chấp nhận -> không có mentor cụ thể nào được suy ra, để NULL (Admin gán sau qua AssignCompanyModal
  // có sẵn) — internship_positions không có cột mentor riêng theo đúng thiết kế đã chốt.
  const mentorIdForInternship =
    currentUser.role === 'company_mentor' ? (await scopeService.getCompanyMentorProfile(currentUser.id))?.id ?? null : null

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [[position]] = await connection.execute(
      'SELECT * FROM internship_positions WHERE id = ? FOR UPDATE',
      [application.position_id],
    )
    if (!position) {
      throw new AppError(404, 'Không tìm thấy vị trí thực tập.')
    }
    if (position.status !== 'open') {
      throw new AppError(409, 'Vị trí thực tập này đã đóng.')
    }

    const [[freshApplication]] = await connection.execute(
      'SELECT * FROM position_applications WHERE id = ? FOR UPDATE',
      [id],
    )
    if (freshApplication.status !== 'applied') {
      throw new AppError(409, `Không thể chấp nhận đơn đang ở trạng thái "${freshApplication.status}".`)
    }

    const [[{ acceptedCount }]] = await connection.query(
      "SELECT COUNT(*) AS acceptedCount FROM position_applications WHERE position_id = ? AND status = 'accepted'",
      [position.id],
    )
    if (acceptedCount >= position.slots) {
      throw new AppError(409, `Vị trí này đã hết chỗ (${acceptedCount}/${position.slots}).`)
    }

    await connection.execute("UPDATE position_applications SET status = 'accepted' WHERE id = ?", [id])

    const newAcceptedCount = acceptedCount + 1
    if (newAcceptedCount >= position.slots) {
      await connection.execute("UPDATE internship_positions SET status = 'closed' WHERE id = ?", [position.id])
    }

    const [[existingInternship]] = await connection.execute(
      'SELECT * FROM internships WHERE student_id = ? AND period_id = ? FOR UPDATE',
      [application.student_id, position.period_id],
    )

    if (existingInternship) {
      const nextStatus = existingInternship.status === 'pending' ? 'approved' : existingInternship.status
      await connection.execute(
        'UPDATE internships SET company_id = ?, company_mentor_id = ?, status = ? WHERE id = ?',
        [position.company_id, mentorIdForInternship, nextStatus, existingInternship.id],
      )
    } else {
      await connection.execute(
        `INSERT INTO internships (student_id, period_id, company_id, company_mentor_id, status, progress)
         VALUES (?, ?, ?, ?, 'approved', 0)`,
        [application.student_id, position.period_id, position.company_id, mentorIdForInternship],
      )
    }

    // Chấp nhận 1 đơn -> tự rút toàn bộ đơn 'applied' KHÁC của sinh viên này (đã có chỗ, không cần
    // giữ các đơn đang chờ khác nữa).
    await connection.execute(
      "UPDATE position_applications SET status = 'withdrawn' WHERE student_id = ? AND status = 'applied' AND id != ?",
      [application.student_id, id],
    )

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const studentInfo = await scopeService.getStudentBasicInfo(application.student_id)
  const position = await positionService.getById(application.position_id)
  await notificationService.notify({
    userId: studentInfo?.user_id,
    type: 'internship',
    title: 'Đơn ứng tuyển vị trí thực tập được chấp nhận',
    content: `Đơn ứng tuyển vị trí "${position?.title ?? ''}" của bạn đã được chấp nhận — hồ sơ thực tập của bạn đã được cập nhật.`,
  })

  return getById(id)
}

module.exports = { getAll, getById, apply, withdraw, reject, accept, MAX_PENDING_APPLICATIONS }
