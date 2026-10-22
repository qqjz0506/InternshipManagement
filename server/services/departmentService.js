const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

async function getAll({ search }) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(department_code LIKE ? OR department_name LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM departments ${where} ORDER BY id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id])
  return rows[0] ?? null
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM departments WHERE department_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function create({ department_code, department_name, description }) {
  if (await isCodeTaken(department_code)) {
    throw new AppError(409, 'Mã khoa đã tồn tại.')
  }

  const [result] = await pool.execute(
    'INSERT INTO departments (department_code, department_name, description) VALUES (?, ?, ?)',
    [department_code, department_name, description ?? null],
  )
  return getById(result.insertId)
}

async function update(id, { department_code, department_name, description }) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy khoa/bộ môn.')
  }

  if (await isCodeTaken(department_code, id)) {
    throw new AppError(409, 'Mã khoa đã tồn tại.')
  }

  await pool.execute(
    'UPDATE departments SET department_code = ?, department_name = ?, description = ? WHERE id = ?',
    [department_code, department_name, description ?? null, id],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy khoa/bộ môn.')
  }

  const [[studentRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM students WHERE department_id = ?',
    [id],
  )
  const [[lecturerRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM lecturers WHERE department_id = ?',
    [id],
  )
  if (studentRef.count > 0 || lecturerRef.count > 0) {
    throw new AppError(409, 'Không thể xóa khoa/bộ môn đang có Sinh viên hoặc Giảng viên thuộc về.')
  }

  try {
    await pool.execute('DELETE FROM departments WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa khoa/bộ môn đang có Sinh viên hoặc Giảng viên thuộc về.')
    }
    throw error
  }
}

module.exports = { getAll, getById, create, update, remove, isCodeTaken }
