const { pool } = require('../config/database')
const bcrypt = require('bcryptjs')
const { isRequired, isValidEmail, isValidPhone } = require('../utils/validators')
const { generateTemporaryPassword } = require('./userService')
const { readDataRows, parseDateCell, buildTemplateWorkbook } = require('./importHelpers')

const BCRYPT_COST = 10
const GENDER_VALUES = ['Nam', 'Nữ', 'Khác']
const STATUS_VALUES = ['active', 'inactive']

// Thứ tự cột CỐ ĐỊNH — import đọc theo vị trí cột (A, B, C...), không theo tên header (xem
// importHelpers.readDataRows). Đổi thứ tự ở đây PHẢI đổi luôn validateRow()/buildRowInsertValues()
// bên dưới cho khớp.
const COLUMNS = [
  { header: 'Mã sinh viên*', key: 'student_code', width: 16 },
  { header: 'Họ tên*', key: 'full_name', width: 24 },
  { header: 'Giới tính* (Nam/Nữ/Khác)', key: 'gender', width: 22 },
  { header: 'Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY)', key: 'date_of_birth', width: 26 },
  { header: 'Số điện thoại', key: 'phone', width: 16 },
  { header: 'Email*', key: 'email', width: 28 },
  { header: 'Địa chỉ', key: 'address', width: 28 },
  { header: 'Mã khoa*', key: 'department_code', width: 14 },
  { header: 'Ngành', key: 'major', width: 20 },
  { header: 'Lớp', key: 'class', width: 16 },
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
      student_code: '21110099',
      full_name: 'Nguyễn Văn A',
      gender: 'Nam',
      date_of_birth: '2003-05-20',
      phone: '0912345678',
      email: 'nguyenvana@example.com',
      address: '123 Đường ABC, Quận 1, TP.HCM',
      department_code: [...departmentMap.keys()][0] ?? 'CNTT',
      major: 'Công nghệ thông tin',
      class: 'DH21CNTT01',
      status: 'active',
    },
    guideLines: [
      'Các cột có dấu (*) là bắt buộc: Mã sinh viên, Họ tên, Giới tính, Email, Mã khoa.',
      'KHÔNG đổi thứ tự cột, KHÔNG xoá dòng header (dòng 1). Dữ liệu bắt đầu từ dòng 2.',
      'Giới tính chỉ nhận đúng 1 trong 3 giá trị: Nam, Nữ, Khác.',
      'Ngày sinh: ô định dạng ngày của Excel, hoặc chuỗi YYYY-MM-DD, hoặc chuỗi DD/MM/YYYY.',
      'Mã khoa phải khớp đúng 1 mã khoa đang có trong hệ thống (phân biệt hoa/thường).',
      `Danh sách mã khoa hợp lệ hiện tại: ${departmentList}.`,
      'Trạng thái chỉ nhận active hoặc inactive; bỏ trống sẽ tự là active.',
      'Mỗi lần nhập tối đa 1000 dòng dữ liệu. Dòng trống sẽ tự bị bỏ qua.',
      'Mã sinh viên và Email không được trùng với dữ liệu đã có trong hệ thống, cũng không được trùng ngay trong file.',
    ],
  })
}

// Validate 1 dòng — mirror ĐÚNG rule của studentController.validatePayload (mục bắt buộc/email/phone/
// department_id) + bổ sung 2 rule CHỈ áp dụng cho import: (1) gender bắt buộc (DB NOT NULL, form Admin
// đơn lẻ không ép vì có default ở DB... thực ra KHÔNG có default, nhưng giữ nguyên hành vi cũ ở đó,
// không sửa ở đây — chỉ siết riêng cho luồng import để tránh insert lỗi), (2) trùng mã/email trong
// DB VÀ trong file (DB không có UNIQUE constraint cho email nên phải tự kiểm ở application-level).
function validateRow(row, { departmentMap, existingCodes, existingEmails, seenCodes, seenEmails }) {
  const errors = []
  const [student_code, full_name, gender, date_of_birth, phone, email, address, department_code, major, className, status] =
    row.cells.map((cell) => String(cell ?? '').trim())

  const normalizedEmail = email.toLowerCase()

  if (!isRequired(student_code)) {
    errors.push({ column: 'Mã sinh viên', message: 'Vui lòng nhập mã sinh viên.' })
  } else if (seenCodes.has(student_code)) {
    errors.push({ column: 'Mã sinh viên', message: 'Mã sinh viên bị trùng trong file.' })
  } else if (existingCodes.has(student_code)) {
    errors.push({ column: 'Mã sinh viên', message: 'Mã sinh viên đã tồn tại trong hệ thống.' })
  }

  if (!isRequired(full_name)) {
    errors.push({ column: 'Họ tên', message: 'Vui lòng nhập họ tên.' })
  }

  if (!isRequired(gender)) {
    errors.push({ column: 'Giới tính', message: 'Vui lòng nhập giới tính.' })
  } else if (!GENDER_VALUES.includes(gender)) {
    errors.push({ column: 'Giới tính', message: `Giới tính phải là một trong: ${GENDER_VALUES.join(', ')}.` })
  }

  let parsedDate = null
  if (isRequired(date_of_birth)) {
    parsedDate = parseDateCell(row.cells[3])
    if (parsedDate === false) {
      errors.push({ column: 'Ngày sinh', message: 'Ngày sinh không hợp lệ.' })
    }
  }

  if (isRequired(phone) && !isValidPhone(phone)) {
    errors.push({ column: 'Số điện thoại', message: 'Số điện thoại không hợp lệ.' })
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

  if (isRequired(student_code)) {
    seenCodes.add(student_code)
  }
  if (isRequired(email)) {
    seenEmails.add(normalizedEmail)
  }

  return {
    errors,
    data: {
      student_code,
      full_name,
      gender,
      date_of_birth: parsedDate,
      phone: phone || null,
      email: normalizedEmail,
      address: address || null,
      department_id: departmentId,
      major: major || null,
      class: className || null,
      status: status || 'active',
    },
  }
}

async function parseAndValidate(buffer) {
  const rows = await readDataRows(buffer, COLUMNS.length)
  const departmentMap = await getDepartmentCodeMap()

  const [existingRows] = await pool.execute('SELECT student_code, email FROM students')
  const existingCodes = new Set(existingRows.map((row) => row.student_code))
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

// Commit KHÔNG tin kết quả preview — validate lại từ đầu (chống lệch dữ liệu giữa 2 lần gọi, vd. 1
// Admin khác vừa nhập trùng mã trong lúc Admin này đang xem preview). Chỉ ghi khi KHÔNG còn dòng lỗi,
// toàn bộ (student + user + link, nếu có) trong CÙNG 1 transaction.
//
// Còn dòng lỗi KHÔNG phải exception (đây là kết quả nghiệp vụ dự kiến, không phải lỗi hệ thống) —
// trả về { committed: false, ... } để controller quyết định response, không throw AppError (AppError
// qua errorHandler chỉ mang message, không mang được danh sách invalidRows có cấu trúc).
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
        `INSERT INTO students (student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.student_code,
          data.full_name,
          data.gender,
          data.date_of_birth,
          data.phone,
          data.email,
          data.address,
          data.department_id,
          data.major,
          data.class,
          data.status,
        ],
      )
      const studentId = result.insertId

      if (createAccounts) {
        const temporaryPassword = generateTemporaryPassword()
        const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST)
        const [userResult] = await connection.execute(
          'INSERT INTO users (full_name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)',
          [data.full_name, data.email, passwordHash, 'student'],
        )
        await connection.execute('UPDATE students SET user_id = ? WHERE id = ?', [userResult.insertId, studentId])
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
