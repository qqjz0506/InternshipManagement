const ExcelJS = require('exceljs')
const AppError = require('../utils/AppError')
const { isValidDate } = require('../utils/validators')

// Giới hạn 1000 dòng dữ liệu/lần nhập (không tính dòng trống, không tính header) — áp dụng chung
// cho Sinh viên và Giảng viên.
const ROW_LIMIT = 1000

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

function cellToText(value) {
  if (value === null || value === undefined) {
    return ''
  }
  // exceljs trả object { richText: [...] } cho cell rich-text, hoặc { text, hyperlink } cho hyperlink
  // — chỉ xảy ra nếu người dùng tự định dạng lại file mẫu, vẫn cố lấy phần text thô thay vì crash.
  if (typeof value === 'object' && !(value instanceof Date)) {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
    if (typeof value.text === 'string') {
      return value.text
    }
    return ''
  }
  return value
}

// Đọc sheet dữ liệu (luôn là worksheet đầu tiên của file — đúng thiết kế file mẫu: sheet 1 "Dữ liệu",
// sheet 2 "Hướng dẫn" chỉ để đọc, không parse). Bỏ qua dòng 1 (header) và các dòng trống (TẤT CẢ cột
// đều rỗng sau khi trim). Trả về danh sách { rowNumber, cells } với cells đã cellToText() nhưng CHƯA
// trim/validate — việc đó thuộc về từng import service (business rule riêng theo entity).
async function readDataRows(buffer, columnCount) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new AppError(400, 'File Excel không có sheet dữ liệu.')
  }

  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return // header
    }
    const cells = []
    for (let col = 1; col <= columnCount; col += 1) {
      cells.push(cellToText(row.getCell(col).value))
    }
    const isBlank = cells.every((cell) => String(cell ?? '').trim() === '')
    if (isBlank) {
      return
    }
    rows.push({ rowNumber, cells })
  })

  if (rows.length > ROW_LIMIT) {
    throw new AppError(400, `File vượt quá giới hạn ${ROW_LIMIT} dòng/lần nhập (hiện có ${rows.length} dòng).`)
  }

  return rows
}

// Đọc 1 ô ngày, chấp nhận: Date object thật (Excel date cell), chuỗi "YYYY-MM-DD", chuỗi "DD/MM/YYYY".
// Excel lưu date-only dưới dạng UTC 00:00 — PHẢI đọc bằng getUTC*() để không bị lệch ngày do timezone
// máy chủ (vd. UTC 2026-01-01T00:00:00Z đọc bằng getDate() ở múi giờ UTC+7 sẽ RA 2026-01-01 đúng, nhưng
// ở múi giờ âm sẽ ra 2025-12-31 — dùng UTC getters tránh phụ thuộc TZ máy chủ).
// Trả về chuỗi "YYYY-MM-DD" hoặc null (ô trống). Trả về false nếu giá trị có nhưng không parse được
// (caller tự quyết định thông báo lỗi theo field).
function parseDateCell(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (value instanceof Date) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (isValidDate(text)) {
    return text
  }
  const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    const candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    if (isValidDate(candidate)) {
      return candidate
    }
  }
  return false
}

function addGuideSheet(workbook, lines) {
  const sheet = workbook.addWorksheet('Hướng dẫn')
  sheet.columns = [{ header: 'Hướng dẫn nhập liệu', key: 'line', width: 100 }]
  sheet.getRow(1).font = { bold: true }
  lines.forEach((line) => sheet.addRow({ line }))
}

// Workbook mẫu: sheet "Dữ liệu" (header bắt buộc đúng thứ tự cột, kèm 1 dòng ví dụ ở dòng 2) + sheet
// "Hướng dẫn" (quy tắc nhập liệu bằng tiếng Việt). Admin PHẢI giữ đúng thứ tự cột khi điền dữ liệu —
// import đọc theo VỊ TRÍ cột, không theo tên header (xem readDataRows).
function buildTemplateWorkbook({ columns, exampleRow, guideLines }) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dữ liệu')
  sheet.columns = columns
  sheet.getRow(1).font = { bold: true }
  sheet.addRow(exampleRow)
  addGuideSheet(workbook, guideLines)
  return workbook
}

// Workbook kết quả tạo tài khoản — CHỈ tồn tại trong bộ nhớ, trả về đúng 1 lần cho Admin tải (xem
// server/services/importAccountStore.js), không lưu mật khẩu tạm ở đâu khác (DB chỉ lưu password_hash).
function buildAccountsWorkbook(accounts) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Tài khoản')
  sheet.columns = [
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Mật khẩu tạm', key: 'temporary_password', width: 20 },
  ]
  sheet.getRow(1).font = { bold: true }
  accounts.forEach((account) => sheet.addRow(account))
  return workbook
}

module.exports = {
  ROW_LIMIT,
  sendWorkbook,
  readDataRows,
  parseDateCell,
  buildTemplateWorkbook,
  buildAccountsWorkbook,
}
