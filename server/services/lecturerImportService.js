const { pool } = require('../config/database')
const bcrypt = require('bcryptjs')
const { isRequired, isValidEmail, isValidPhone } = require('../utils/validators')
const { generateTemporaryPassword } = require('./userService')
const { readDataRows, buildTemplateWorkbook } = require('./importHelpers')

const BCRYPT_COST = 10
const STATUS_VALUES = ['active', 'inactive']

// Thứ tự cột CỐ ĐỊNH — xem ghi chú tương tự ở studentImportService.js.
const COLUMNS = [
  { header: 'Mã giảng viên*', key: 'lecturer_code', width: 16 },
  { header: 'Họ tên*', key: 'full_name', width: 24 },
  { header: 'Email*', key: 'email', width: 28 },
  { header: 'Số điện thoại', key: 'phone', width: 16 },
  { header: 'Mã khoa*', key: 'department_code', width: 14 },
  { header: 'Học hàm / Học vị', key: 'position', width: 24 },
  { header: 'Trạng thái (active/inactive, bỏ trống = active)', key: 'status', width: 20 },
]

async function getDepartmentCodeMap() {
  const [rows] = await pool.execute('SELECT id, department_code FROM departments')
  return new Map(rows.map((row) => [row.department_code, row.id]))
}

async function buildTemplate() {
  const departmentMap = await getDepartmentCodeMap()
  const departmentList = [...departmentMap.keys()].join(', ') || '(chưa có khoa nào trong hệ thống)'

  return buildTemplateWorkbook({
    columns: COLUMNS,
    exampleRow: {
      lecturer_code: 'GV0099',
      full_name: 'Trần Thị B',
      email: 'tranthib@example.com',
      phone: '0987654321',
      department_code: [...departmentMap.keys()][0] ?? 'CNTT',
      position: 'Thạc sĩ',
      status: 'active',
    },
    guideLines: [
      'Các cột có dấu (*) là bắt buộc: Mã giảng viên, Họ tên, Email, Mã khoa.',
      'KHÔNG đổi thứ tự cột, KHÔNG xoá dòng header (dòng 1). Dữ liệu bắt đầu từ dòng 2.',
      'Mã khoa phải khớp đúng 1 mã khoa đang có trong hệ thống (phân biệt hoa/thường).',
      `Danh sách mã khoa hợp lệ hiện tại: ${departmentList}.`,
      'Trạng thái chỉ nhận active hoặc inactive; bỏ trống sẽ tự là active.',
      'Mỗi lần nhập tối đa 1000 dòng dữ liệu. Dòng trống sẽ tự bị bỏ qua.',
      'Mã giảng viên và Email không được trùng với dữ liệu đã có trong hệ thống, cũng không được trùng ngay trong file.',
    ],
  })
}

// Mirror ĐÚNG rule của lecturerController.validatePayload + 2 rule riêng cho import (trùng mã/email
// trong DB VÀ trong file) — xem giải thích đầy đủ ở studentImportService.validateRow.
function validateRow(row, { departmentMap, existingCodes, existingEmails, seenCodes, seenEmails }) {
  const errors = []
  const [lecturer_code, full_name, email, phone, department_code, position, status] = row.cells.map((cell) =>
    String(cell ?? '').trim(),
  )

  const normalizedEmail = email.toLowerCase()

  if (!isRequired(lecturer_code)) {
    errors.push({ column: 'Mã giảng viên', message: 'Vui lòng nhập mã giảng viên.' })
  } else if (seenCodes.has(lecturer_code)) {
    errors.push({ column: 'Mã giảng viên', message: 'Mã giảng viên bị trùng trong file.' })
  } else if (existingCodes.has(lecturer_code)) {
    errors.push({ column: 'Mã giảng viên', message: 'Mã giảng viên đã tồn tại trong hệ thống.' })
  }

  if (!isRequired(full_name)) {
    errors.push({ column: 'Họ tên', message: 'Vui lòng nhập họ tên.' })
  }

  if (!isRequired(email)) {
    errors.push({ column: 'Email', message: 'Vui lòng nhập email.' })
  } else if (!isValidEmail(email)) {
    errors.push({ column: 'Email', message: 'Email không hợp lệ.' })
  } else if (seenEmails.has(normalizedEmail)) {
    errors.push({ column: 'Email', message: 'Email bị trùng trong file.' })
  } else if (existingEmails.has(normalizedEmail)) {
    errors.push({ column: 'Email', message: 'Email đã tồn tại trong hệ thống.' })
  }

  if (isRequired(phone) && !isValidPhone(phone)) {
    errors.push({ column: 'Số điện thoại', message: 'Số điện thoại không hợp lệ.' })
  }

  let departmentId = null
  if (!isRequired(department_code)) {
    errors.push({ column: 'Mã khoa', message: 'Vui lòng nhập mã khoa.' })
  } else {
    departmentId = departmentMap.get(department_code) ?? null
    if (!departmentId) {
      errors.push({ column: 'Mã khoa', message: `Mã khoa "${department_code}" không tồn tại.` })
    }
  }

  if (isRequired(status) && !STATUS_VALUES.includes(status)) {
    errors.push({ column: 'Trạng thái', message: `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.` })
  }

  if (isRequired(lecturer_code)) {
    seenCodes.add(lecturer_code)
  }
  if (isRequired(email)) {
    seenEmails.add(normalizedEmail)
  }

  return {
    errors,
    data: {
      lecturer_code,
      full_name,
      email: normalizedEmail,
      phone: phone || null,
      department_id: departmentId,
      position: position || null,
      status: status || 'active',
    },
  }
}

async function parseAndValidate(buffer) {
  const rows = await readDataRows(buffer, COLUMNS.length)
  const departmentMap = await getDepartmentCodeMap()

  const [existingRows] = await pool.execute('SELECT lecturer_code, email FROM lecturers')
  const existingCodes = new Set(existingRows.map((row) => row.lecturer_code))
  const existingEmails = new Set(existingRows.map((row) => row.email.toLowerCase()))
  const seenCodes = new Set()
  const seenEmails = new Set()

  const validRows = []
  const invalidRows = []

  rows.forEach((row) => {
    const { errors, data } = validateRow(row, { departmentMap, existingCodes, existingEmails, seenCodes, seenEmails })
    if (errors.length > 0) {
      invalidRows.push({ row: row.rowNumber, errors })
    } else {
      validRows.push({ row: row.rowNumber, ...data })
    }
  })

  return { totalRows: rows.length, validRows, invalidRows }
}

async function preview(buffer) {
  return parseAndValidate(buffer)
}

async function commit(buffer, { createAccounts }) {
  const { totalRows, validRows, invalidRows } = await parseAndValidate(buffer)
  if (invalidRows.length > 0) {
    return { committed: false, totalRows, invalidRows }
  }

  const connection = await pool.getConnection()
  const accounts = []
  try {
    await connection.beginTransaction()

    for (const data of validRows) {
      const [result] = await connection.execute(
        `INSERT INTO lecturers (lecturer_code, full_name, email, phone, department_id, position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.lecturer_code, data.full_name, data.email, data.phone, data.department_id, data.position, data.status],
      )
      const lecturerId = result.insertId

      if (createAccounts) {
        const temporaryPassword = generateTemporaryPassword()
        const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST)
        const [userResult] = await connection.execute(
          'INSERT INTO users (full_name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)',
          [data.full_name, data.email, passwordHash, 'lecturer'],
        )
        await connection.execute('UPDATE lecturers SET user_id = ? WHERE id = ?', [userResult.insertId, lecturerId])
        accounts.push({ email: data.email, temporary_password: temporaryPassword })
      }
    }

    await connection.commit()
    return { committed: true, insertedCount: validRows.length, accounts }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = { buildTemplate, preview, commit }
