const path = require('path')
const fs = require('fs')
const reportService = require('../services/reportService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')
const { UPLOAD_DIR, deleteStoredFile } = require('../config/upload')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng ReportFormModal.jsx: report_type bắt buộc + file đính kèm bắt buộc (field "file", xem
// uploadReportFile ở reportRoutes.js). file_name KHÔNG còn là field client tự nhập — luôn lấy từ
// req.file.originalname (gắn vào payload bên dưới), isRequired ở đây chỉ còn là an toàn hình thức.
function validateCreatePayload(body) {
  if (!isRequired(body.internship_id) || !isValidId(body.internship_id)) {
    throw new AppError(400, 'Vui lòng chọn hồ sơ thực tập hợp lệ.')
  }
  if (!isRequired(body.report_type)) {
    throw new AppError(400, 'Vui lòng chọn loại báo cáo.')
  }
  if (!isRequired(body.file_name)) {
    throw new AppError(400, 'Vui lòng nhập tên file báo cáo.')
  }
}

function validateUpdatePayload(body) {
  if ('status' in body && typeof body.status !== 'string') {
    throw new AppError(400, 'status không hợp lệ.')
  }
}

// Gắn 4 field file-derived (nếu multer đã nhận được file hợp lệ) LÊN TRÊN body gốc — body gốc (text
// field khác, nếu có, ví dụ submitted_at khi test field-injection) vẫn được giữ nguyên để service
// tiếp tục reject đúng như trước (KHÔNG whitelist cứng field — tránh silently drop field lạ).
function buildPayloadWithFile(req) {
  const payload = { ...req.body }
  if (req.file) {
    payload.file_name = req.file.originalname
    payload.stored_file_name = req.file.filename
    payload.file_size = req.file.size
    payload.mime_type = req.file.mimetype
  }
  return payload
}

async function list(req, res) {
  const { internship_id, status, search, lecturer_id, company_id, period_id, page, pageSize } = req.query
  const { rows, pagination } = await reportService.getAll(
    { internship_id, status, search, lecturer_id, company_id, period_id, page, pageSize },
    req.user,
  )
  sendSuccess(res, { message: 'Reports retrieved successfully', data: rows, meta: pagination ?? undefined })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const report = await reportService.getByIdForUser(req.params.id, req.user)
  if (!report) {
    throw new AppError(404, 'Report not found')
  }
  sendSuccess(res, { message: 'Report retrieved successfully', data: report })
}

// Nếu validate/business rule fail SAU KHI multer đã lưu file tạm (req.file tồn tại), phải xóa file
// đó — không để lại file mồ côi trên đĩa cho 1 report không bao giờ được tạo/update thành công.
async function create(req, res) {
  try {
    if (!req.file) {
      throw new AppError(400, 'Vui lòng chọn file báo cáo (.pdf, .doc, .docx).')
    }
    const payload = buildPayloadWithFile(req)
    validateCreatePayload(payload)
    const report = await reportService.create(payload, req.user)
    sendSuccess(res, { statusCode: 201, message: 'Report created successfully', data: report })
  } catch (error) {
    if (req.file) {
      await deleteStoredFile(req.file.filename)
    }
    throw error
  }
}

async function update(req, res) {
  validateId(req.params.id)
  try {
    const payload = buildPayloadWithFile(req)
    validateUpdatePayload(payload)
    const report = await reportService.update(req.params.id, payload, req.user)
    sendSuccess(res, { message: 'Report updated successfully', data: report })
  } catch (error) {
    if (req.file) {
      await deleteStoredFile(req.file.filename)
    }
    throw error
  }
}

async function remove(req, res) {
  validateId(req.params.id)
  await reportService.remove(req.params.id)
  sendSuccess(res, { message: 'Report deleted successfully', data: null })
}

// Tải file báo cáo — scope giống getByIdForUser (assertOwnInternshipById), KHÔNG serve thư mục
// uploads dạng static ở đâu khác. Content-Disposition dùng file_name (tên gốc, có thể tiếng Việt) —
// res.download() (Express, qua package `content-disposition`) tự encode đúng RFC 5987/UTF-8.
async function download(req, res) {
  validateId(req.params.id)
  const report = await reportService.getByIdForUser(req.params.id, req.user)
  if (!report) {
    throw new AppError(404, 'Report not found')
  }
  if (!report.stored_file_name) {
    throw new AppError(404, 'Báo cáo này chưa có file đính kèm.')
  }
  const absolutePath = path.join(UPLOAD_DIR, report.stored_file_name)
  if (!fs.existsSync(absolutePath)) {
    throw new AppError(404, 'File không còn tồn tại trên server.')
  }
  res.download(absolutePath, report.file_name)
}

module.exports = { list, getOne, create, update, remove, download }
