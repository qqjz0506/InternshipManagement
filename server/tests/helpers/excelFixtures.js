const ExcelJS = require('exceljs')

// Dựng buffer .xlsx cho test import — PHẢI đúng thứ tự cột như COLUMNS ở
// server/services/studentImportService.js / lecturerImportService.js (import đọc theo vị trí cột,
// không theo tên header). rows: mảng mảng giá trị theo đúng thứ tự cột; truyền string | Date | ''/null.
async function buildImportBuffer(headerRow, rows) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dữ liệu')
  sheet.addRow(headerRow)
  rows.forEach((row) => sheet.addRow(row))
  return workbook.xlsx.writeBuffer()
}

const STUDENT_HEADER = [
  'Mã sinh viên*',
  'Họ tên*',
  'Giới tính*',
  'Ngày sinh',
  'Số điện thoại',
  'Email*',
  'Địa chỉ',
  'Mã khoa*',
  'Ngành',
  'Lớp',
  'Trạng thái',
]

const LECTURER_HEADER = ['Mã giảng viên*', 'Họ tên*', 'Email*', 'Số điện thoại', 'Mã khoa*', 'Học hàm / Học vị', 'Trạng thái']

function buildStudentImportBuffer(rows) {
  return buildImportBuffer(STUDENT_HEADER, rows)
}

function buildLecturerImportBuffer(rows) {
  return buildImportBuffer(LECTURER_HEADER, rows)
}

function buildImportFormData(buffer, fields = {}) {
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => formData.append(key, String(value)))
  formData.append(
    'file',
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'import.xlsx',
  )
  return formData
}

module.exports = { buildStudentImportBuffer, buildLecturerImportBuffer, buildImportFormData }
