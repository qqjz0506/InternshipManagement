// Test tự động TỐI THIỂU cho export module — dùng node:test built-in (Node 24, không cài thêm
// Jest/Mocha/Supertest, đúng chỉ đạo mục 44 Phase 5: "không biến phase này thành migration sang
// testing framework"). Chạy trực tiếp trên DB thật (giống toàn bộ cách test thủ công trong dự án từ
// trước tới nay) — không mock, dùng đúng dữ liệu seed hiện có, KHÔNG mutate gì (export chỉ SELECT).
//
// Chạy: node --test server/services/exportService.test.js  (cần backend .env + MySQL seed sẵn)
//
// Đây là test TỰ ĐỘNG cho đúng phần lõi (scope + cấu trúc workbook) — KHÔNG thay thế cho test HTTP
// thủ công qua curl đã thực hiện riêng (auth/role-gate ở route-level, headers HTTP, download thật từ
// trình duyệt) — những phần đó vẫn là MANUAL, ghi rõ trong docs/API_PHASE_5.md.
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { pool } = require('../config/database')
const exportService = require('./exportService')

// User seed cố định, không tạo/xóa dữ liệu test nào (mục 48: export read-only).
const ADMIN = { id: 1, role: 'admin' }
const STUDENT_A = { id: 2, role: 'student' } // -> students.id = 1 (Nguyễn Minh Anh, 21110001)
const LECTURER_A = { id: 3, role: 'lecturer' } // -> lecturers.id = 1 (Trần Quốc Bảo)

function sheetRows(workbook, name) {
  const sheet = workbook.getWorksheet(name)
  const rows = []
  for (let i = 2; i <= sheet.rowCount; i++) {
    rows.push(sheet.getRow(i).values)
  }
  return rows
}

test('internship export: Admin sees all 12 seed internships with correct header', async () => {
  const workbook = await exportService.buildInternshipWorkbook({}, ADMIN)
  const sheet = workbook.getWorksheet('Thông tin thực tập')
  assert.ok(sheet, 'sheet "Thông tin thực tập" phải tồn tại')
  const headerValues = sheet.getRow(1).values.slice(1)
  assert.equal(headerValues[0], 'Mã sinh viên')
  assert.equal(headerValues[1], 'Họ tên sinh viên')
  assert.equal(sheet.rowCount - 1, 12, 'Admin phải thấy đúng 12 internship seed')
})

test('internship export: Student chỉ thấy đúng hồ sơ của chính mình', async () => {
  const workbook = await exportService.buildInternshipWorkbook({}, STUDENT_A)
  const rows = sheetRows(workbook, 'Thông tin thực tập')
  assert.equal(rows.length, 1, 'Student chỉ được thấy đúng 1 hồ sơ (của chính mình)')
  assert.equal(rows[0][1], '21110001', 'Phải đúng mã sinh viên của chính Student A')
})

test('internship export: filter scope-intersected trả rỗng (không leak) nếu không khớp scope', async () => {
  const workbook = await exportService.buildInternshipWorkbook({ department_id: 999 }, STUDENT_A)
  const rows = sheetRows(workbook, 'Thông tin thực tập')
  assert.equal(rows.length, 0, 'Filter không khớp scope của Student phải trả rỗng, không throw, không leak')
})

test('evaluation export: Student KHÔNG được thấy evaluation chưa công bố (kể cả của chính mình)', async () => {
  // Student A (students.id=1) có evaluation published=1 -> phải thấy đúng 1 dòng.
  const workbook = await exportService.buildEvaluationWorkbook({}, STUDENT_A)
  const sheet = workbook.getWorksheet('Đánh giá')
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i).values
    const publishedLabelColumnIndex = 15 // "Trạng thái công bố" — cột thứ 15 (1-based trong values)
    assert.equal(
      row[publishedLabelColumnIndex],
      'Đã công bố',
      'Mọi dòng Student thấy được đều phải là evaluation đã công bố',
    )
  }
})

test('evaluation export: Lecturer chỉ thấy evaluation evaluator_role=lecturer thuộc internship mình phụ trách', async () => {
  const workbook = await exportService.buildEvaluationWorkbook({}, LECTURER_A)
  const sheet = workbook.getWorksheet('Đánh giá')
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i).values
    const evaluatorRoleLabelIndex = 7 // "Loại người đánh giá"
    assert.equal(row[evaluatorRoleLabelIndex], 'Giảng viên')
  }
})

test('workbook roundtrip: buffer ghi ra phải đọc lại được bằng ExcelJS (file integrity)', async () => {
  const ExcelJS = require('exceljs')
  const workbook = await exportService.buildInternshipWorkbook({}, ADMIN)
  const buffer = await workbook.xlsx.writeBuffer()
  assert.ok(buffer.length > 0, 'buffer không được rỗng')

  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(buffer)
  const sheet = reopened.getWorksheet('Thông tin thực tập')
  assert.ok(sheet, 'workbook reopen phải còn đúng sheet')
  assert.equal(sheet.rowCount - 1, 12)
})

test('evaluation export: cột Điểm tổng kết thực tập + Xếp loại — đúng theo evaluationService.computeFinalResult, bỏ trống khi chưa đủ 2 đánh giá công bố', async () => {
  const evaluationService = require('./evaluationService')

  // Ground truth độc lập (không đoán): internship id=1 chỉ có đánh giá lecturer công bố (chưa đủ 2)
  // -> phải để trống; internship id=9 có đủ 2 đánh giá công bố -> phải khớp computeFinalResult(9).
  const [[internship1]] = await pool.query(
    `SELECT s.student_code FROM internships i JOIN students s ON s.id = i.student_id WHERE i.id = 1`,
  )
  const [[internship9]] = await pool.query(
    `SELECT s.student_code FROM internships i JOIN students s ON s.id = i.student_id WHERE i.id = 9`,
  )
  const expected9 = await evaluationService.computeFinalResult(9)
  assert.ok(expected9, 'internship 9 (seed) phải có đủ 2 đánh giá công bố để test này có ý nghĩa')

  const workbook = await exportService.buildEvaluationWorkbook({}, ADMIN)
  const sheet = workbook.getWorksheet('Đánh giá')
  const headerValues = sheet.getRow(1).values
  assert.equal(headerValues[17], 'Điểm tổng kết thực tập')
  assert.equal(headerValues[18], 'Xếp loại')

  const finalScoreColumnIndex = 17
  const classificationColumnIndex = 18
  const studentCodeColumnIndex = 1

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i).values
    if (row[studentCodeColumnIndex] === internship1.student_code) {
      // ExcelJS: cell giá trị null -> row.values bỏ qua index đó (sparse array) -> đọc lại thành undefined.
      assert.equal(row[finalScoreColumnIndex], undefined, 'internship 1 chưa đủ 2 đánh giá công bố -> phải để trống')
      assert.equal(row[classificationColumnIndex], undefined)
    }
    if (row[studentCodeColumnIndex] === internship9.student_code) {
      assert.equal(row[finalScoreColumnIndex], expected9.finalScore)
      assert.equal(row[classificationColumnIndex], expected9.classification)
    }
  }
})

test.after(async () => {
  await pool.end()
})
