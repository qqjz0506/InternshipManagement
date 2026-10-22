const studentImportService = require('../services/studentImportService')
const lecturerImportService = require('../services/lecturerImportService')
const importAccountStore = require('../services/importAccountStore')
const { sendWorkbook, buildAccountsWorkbook } = require('../services/importHelpers')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { todayDateString } = require('../utils/dateTime')

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// "true"/"1" -> bật, mọi giá trị khác (bao gồm không gửi field) -> tắt. Field gửi qua multipart nên
// LUÔN là string, không phải boolean thật.
function parseCreateAccounts(value) {
  return value === 'true' || value === '1'
}

async function templateStudents(req, res) {
  const workbook = await studentImportService.buildTemplate()
  await sendWorkbook(res, workbook, `mau-nhap-sinh-vien-${todayDateString()}.xlsx`)
}

async function templateLecturers(req, res) {
  const workbook = await lecturerImportService.buildTemplate()
  await sendWorkbook(res, workbook, `mau-nhap-giang-vien-${todayDateString()}.xlsx`)
}

async function previewStudents(req, res) {
  const result = await studentImportService.preview(req.file.buffer)
  sendSuccess(res, { message: 'Xem trước nhập sinh viên thành công', data: result })
}

async function previewLecturers(req, res) {
  const result = await lecturerImportService.preview(req.file.buffer)
  sendSuccess(res, { message: 'Xem trước nhập giảng viên thành công', data: result })
}

// Response LUÔN là JSON (kể cả khi tạo tài khoản thành công) — file Excel chứa mật khẩu tạm được tải
// riêng qua GET /api/imports/accounts-file/:token (xem importAccountStore), KHÔNG trả trực tiếp binary
// từ POST này, để giữ đúng convention apiClient hiện có (POST luôn JSON, GET mới trả blob).
async function commitStudents(req, res) {
  const createAccounts = parseCreateAccounts(req.body.create_accounts)
  const result = await studentImportService.commit(req.file.buffer, { createAccounts })
  await respondCommit(res, result, 'Nhập sinh viên thành công')
}

async function commitLecturers(req, res) {
  const createAccounts = parseCreateAccounts(req.body.create_accounts)
  const result = await lecturerImportService.commit(req.file.buffer, { createAccounts })
  await respondCommit(res, result, 'Nhập giảng viên thành công')
}

async function respondCommit(res, result, successMessage) {
  if (!result.committed) {
    sendSuccess(res, { message: 'Còn dòng dữ liệu không hợp lệ, chưa ghi vào hệ thống', data: result })
    return
  }

  const data = { committed: true, insertedCount: result.insertedCount }
  if (result.accounts.length > 0) {
    const workbook = buildAccountsWorkbook(result.accounts)
    const buffer = await workbook.xlsx.writeBuffer()
    data.accountsFileToken = importAccountStore.put(buffer)
  }
  sendSuccess(res, { message: successMessage, data })
}

async function downloadAccountsFile(req, res) {
  const buffer = importAccountStore.pop(req.params.token)
  if (!buffer) {
    throw new AppError(404, 'Không tìm thấy file tài khoản hoặc file đã được tải trước đó.')
  }
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="tai-khoan-tao-moi-${todayDateString()}.xlsx"`)
  res.end(buffer)
}

module.exports = {
  templateStudents,
  templateLecturers,
  previewStudents,
  previewLecturers,
  commitStudents,
  commitLecturers,
  downloadAccountsFile,
}
