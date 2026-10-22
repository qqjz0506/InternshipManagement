const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

async function getAll({ search, status }) {
  const conditions = []
  const params = []

  if (search) {
    conditions.push('(company_code LIKE ? OR company_name LIKE ? OR tax_code LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM companies ${where} ORDER BY id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id])
  return rows[0] ?? null
}

async function isCodeTaken(code, ignoreId) {
  const params = [code]
  let query = 'SELECT id FROM companies WHERE company_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function isTaxCodeTaken(taxCode, ignoreId) {
  const params = [taxCode]
  let query = 'SELECT id FROM companies WHERE tax_code = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

async function create(payload) {
  const { company_code, company_name, tax_code, address, phone, email, website, representative, status } = payload

  if (await isCodeTaken(company_code)) {
    throw new AppError(409, 'Mã doanh nghiệp đã tồn tại.')
  }
  if (await isTaxCodeTaken(tax_code)) {
    throw new AppError(409, 'Mã số thuế đã tồn tại.')
  }

  const [result] = await pool.execute(
    `INSERT INTO companies (company_code, company_name, tax_code, address, phone, email, website, representative, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      company_code,
      company_name,
      tax_code,
      address ?? null,
      phone ?? null,
      email ?? null,
      website ?? null,
      representative ?? null,
      status ?? 'active',
    ],
  )
  return getById(result.insertId)
}

async function update(id, payload) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy doanh nghiệp.')
  }

  const { company_code, company_name, tax_code, address, phone, email, website, representative, status } = payload

  if (await isCodeTaken(company_code, id)) {
    throw new AppError(409, 'Mã doanh nghiệp đã tồn tại.')
  }
  if (await isTaxCodeTaken(tax_code, id)) {
    throw new AppError(409, 'Mã số thuế đã tồn tại.')
  }

  await pool.execute(
    `UPDATE companies SET
      company_code = ?, company_name = ?, tax_code = ?, address = ?, phone = ?, email = ?, website = ?, representative = ?, status = ?
     WHERE id = ?`,
    [
      company_code,
      company_name,
      tax_code,
      address ?? null,
      phone ?? null,
      email ?? null,
      website ?? null,
      representative ?? null,
      status ?? 'active',
      id,
    ],
  )
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy doanh nghiệp.')
  }

  const [[mentorRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM company_mentors WHERE company_id = ?',
    [id],
  )
  const [[internshipRef]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM internships WHERE company_id = ?',
    [id],
  )
  if (mentorRef.count > 0 || internshipRef.count > 0) {
    throw new AppError(409, 'Không thể xóa doanh nghiệp đang có Người hướng dẫn hoặc Hồ sơ thực tập liên quan.')
  }

  try {
    await pool.execute('DELETE FROM companies WHERE id = ?', [id])
  } catch (error) {
    if (error.errno === 1451) {
      throw new AppError(409, 'Không thể xóa doanh nghiệp đang có Người hướng dẫn hoặc Hồ sơ thực tập liên quan.')
    }
    throw error
  }
}

module.exports = { getAll, getById, create, update, remove, isCodeTaken, isTaxCodeTaken }
