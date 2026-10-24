const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')

const STATUS_VALUES = ['open', 'closed']

async function getCompanyById(id) {
  const [rows] = await pool.execute('SELECT id, status FROM companies WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getPeriodById(id) {
  const [rows] = await pool.execute('SELECT id, status FROM internship_periods WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getMentorCompanyId(currentUser) {
  const mentor = await scopeService.getCompanyMentorProfile(currentUser.id)
  return mentor?.company_id ?? null
}

// Scope: Admin thấy tất cả; Company Mentor CHỈ thấy vị trí của công ty mình (mọi status, để tự quản
// lý); Student CHỈ thấy vị trí 'open' của đợt KHÔNG 'closed' (để ứng tuyển); Lecturer không có nhu
// cầu nghiệp vụ riêng với vị trí thực tập (không trong phạm vi yêu cầu) — cho xem như Admin (không
// có dữ liệu nhạy cảm nào trong mô tả vị trí, không cần hạn chế thêm).
async function getAll({ search, period_id, company_id, status }, currentUser) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(p.title LIKE ? OR c.company_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (period_id) {
    conditions.push('p.period_id = ?')
    params.push(period_id)
  }

  if (currentUser.role === 'company_mentor') {
    const ownCompanyId = await getMentorCompanyId(currentUser)
    conditions.push('p.company_id = ?')
    params.push(ownCompanyId ?? 0)
  } else if (company_id) {
    conditions.push('p.company_id = ?')
    params.push(company_id)
  }

  if (currentUser.role === 'student') {
    conditions.push("p.status = 'open'", "pr.status != 'closed'")
  } else if (status) {
    conditions.push('p.status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(
    `SELECT p.*, c.company_name, c.company_code,
        (SELECT COUNT(*) FROM position_applications a WHERE a.position_id = p.id AND a.status = 'accepted') AS accepted_count
     FROM internship_positions p
     JOIN companies c ON c.id = p.company_id
     JOIN internship_periods pr ON pr.id = p.period_id
     ${where}
     ORDER BY p.id DESC`,
    params,
  )
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM internship_positions WHERE id = ?', [id])
  return rows[0] ?? null
}

async function assertOwnCompanyOrAdmin(position, currentUser) {
  if (currentUser.role === 'admin') {
    return
  }
  if (currentUser.role === 'company_mentor') {
    const ownCompanyId = await getMentorCompanyId(currentUser)
    if (ownCompanyId !== null && position.company_id === ownCompanyId) {
      return
    }
  }
  throw new AppError(403, 'Bạn không có quyền quản lý vị trí thực tập này.')
}

function validateSlots(value) {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(400, 'Số lượng vị trí (slots) phải là số nguyên dương.')
  }
  return num
}

// CREATE: Admin được chọn company_id bất kỳ; Company Mentor BỊ ÉP company_id = đúng công ty mình
// (không tin giá trị client gửi — IDOR protection, giống mọi chỗ "self role" khác trong dự án).
async function create(payload, currentUser) {
  const { title, description, requirements, slots, status } = payload
  let { company_id, period_id } = payload

  if (currentUser.role === 'company_mentor') {
    const ownCompanyId = await getMentorCompanyId(currentUser)
    if (!ownCompanyId) {
      throw new AppError(403, 'Tài khoản chưa được liên kết hồ sơ người hướng dẫn hoặc công ty.')
    }
    if (company_id !== undefined && Number(company_id) !== ownCompanyId) {
      throw new AppError(403, 'Không được tạo vị trí thực tập cho công ty khác.')
    }
    company_id = ownCompanyId
  }

  const company = await getCompanyById(company_id)
  if (!company) {
    throw new AppError(400, 'Doanh nghiệp không tồn tại.')
  }
  if (company.status !== 'active') {
    throw new AppError(400, 'Doanh nghiệp này không ở trạng thái hoạt động, không thể đăng vị trí.')
  }

  const period = await getPeriodById(period_id)
  if (!period) {
    throw new AppError(400, 'Đợt thực tập không tồn tại.')
  }
  if (period.status === 'closed') {
    throw new AppError(409, 'Đợt thực tập này đã đóng, không thể đăng vị trí mới.')
  }

  const resolvedSlots = validateSlots(slots)
  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    throw new AppError(400, `status phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }

  const [result] = await pool.execute(
    `INSERT INTO internship_positions (company_id, period_id, title, description, requirements, slots, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [company_id, period_id, title, description ?? null, requirements ?? null, resolvedSlots, status ?? 'open'],
  )
  return getById(result.insertId)
}

// UPDATE: company_id/period_id immutable (không UI nào cho đổi — vị trí thuộc cố định 1 công ty/1
// đợt, đổi company/period lẽ ra phải là vị trí khác). Giảm slots xuống dưới số đã accepted -> reject
// (không được giảm xuống dưới số đã nhận, tránh hồ sơ đã accepted trở nên "ảo" vì vượt slot ngược).
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy vị trí thực tập.')
  }
  await assertOwnCompanyOrAdmin(existing, currentUser)

  if ('company_id' in payload) {
    throw new AppError(400, 'company_id là immutable — không được gửi field này khi cập nhật vị trí thực tập.')
  }
  if ('period_id' in payload) {
    throw new AppError(400, 'period_id là immutable — không được gửi field này khi cập nhật vị trí thực tập.')
  }

  const changes = {}
  if ('title' in payload) {
    changes.title = payload.title
  }
  if ('description' in payload) {
    changes.description = payload.description || null
  }
  if ('requirements' in payload) {
    changes.requirements = payload.requirements || null
  }
  if ('slots' in payload) {
    const resolvedSlots = validateSlots(payload.slots)
    const [[{ acceptedCount }]] = await pool.query(
      "SELECT COUNT(*) AS acceptedCount FROM position_applications WHERE position_id = ? AND status = 'accepted'",
      [id],
    )
    if (resolvedSlots < acceptedCount) {
      throw new AppError(400, `Không thể giảm slots xuống dưới số đã nhận (${acceptedCount}).`)
    }
    changes.slots = resolvedSlots
  }
  if ('status' in payload) {
    if (!STATUS_VALUES.includes(payload.status)) {
      throw new AppError(400, `status phải là một trong: ${STATUS_VALUES.join(', ')}.`)
    }
    changes.status = payload.status
  }

  const fields = Object.keys(changes)
  if (fields.length === 0) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  const setClause = fields.map((field) => `${field} = ?`).join(', ')
  const values = fields.map((field) => changes[field])
  await pool.execute(`UPDATE internship_positions SET ${setClause} WHERE id = ?`, [...values, id])
  return getById(id)
}

module.exports = { getAll, getById, create, update, assertOwnCompanyOrAdmin, getMentorCompanyId }
