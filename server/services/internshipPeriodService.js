const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

// '' (chuỗi rỗng từ input date/number client gửi khi để trống) phải thành NULL — không được INSERT
// thẳng '' vào cột DATE/TINYINT (lỗi SQL), giống resolveOptionalText() ở reportService/internshipLogService.
function resolveOptionalDate(value) {
  return value === undefined || value === null || value === '' ? null : value
}

function resolveLogFrequencyDays(value) {
  return value === undefined || value === null || value === '' ? 7 : Number(value)
}

async function getAll({ search, status }) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(period_code LIKE ? OR period_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM internship_periods ${where} ORDER BY id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM internship_periods WHERE id = ?', [id])
  return rows[0] ?? null
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM internship_periods WHERE period_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function create({
  period_code, period_name, start_date, end_date, status, description,
  log_frequency_days, final_report_deadline, evaluation_deadline,
}) {
  if (await isCodeTaken(period_code)) {
    throw new AppError(409, 'Mã đợt thực tập đã tồn tại.')
  }

  const [result] = await pool.execute(
    `INSERT INTO internship_periods
      (period_code, period_name, start_date, end_date, status, description, log_frequency_days, final_report_deadline, evaluation_deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      period_code, period_name, start_date, end_date, status ?? 'upcoming', description ?? null,
      resolveLogFrequencyDays(log_frequency_days), resolveOptionalDate(final_report_deadline), resolveOptionalDate(evaluation_deadline),
    ],
  )
  return getById(result.insertId)
}

async function update(id, {
  period_code, period_name, start_date, end_date, status, description,
  log_frequency_days, final_report_deadline, evaluation_deadline,
}) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đợt thực tập.')
  }

  if (await isCodeTaken(period_code, id)) {
    throw new AppError(409, 'Mã đợt thực tập đã tồn tại.')
  }

  await pool.execute(
    `UPDATE internship_periods SET
      period_code = ?, period_name = ?, start_date = ?, end_date = ?, status = ?, description = ?,
      log_frequency_days = ?, final_report_deadline = ?, evaluation_deadline = ?
     WHERE id = ?`,
    [
      period_code, period_name, start_date, end_date, status ?? 'upcoming', description ?? null,
      resolveLogFrequencyDays(log_frequency_days), resolveOptionalDate(final_report_deadline), resolveOptionalDate(evaluation_deadline), id,
    ],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đợt thực tập.')
  }

  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE period_id = ?',
    [id],
  )
  if (internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa đợt thực tập đang có Hồ sơ thực tập sử dụng.')
  }

  try {
    await pool.execute('DELETE FROM internship_periods WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa đợt thực tập đang có Hồ sơ thực tập sử dụng.')
    }
    throw error
  }
}

module.exports = { getAll, getById, create, update, remove, isCodeTaken }
