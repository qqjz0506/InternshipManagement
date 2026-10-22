const internshipLogService = require('../services/internshipLogService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId, isValidDate } = require('../utils/validators')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng validate() của LogFormModal.jsx: log_date/title/content bắt buộc.
function validateCreatePayload(body) {
  if (!isRequired(body.internship_id) || !isValidId(body.internship_id)) {
    throw new AppError(400, 'Vui lòng chọn hồ sơ thực tập hợp lệ.')
  }
  if (!isRequired(body.log_date) || !isValidDate(body.log_date)) {
    throw new AppError(400, 'Vui lòng chọn ngày hợp lệ.')
  }
  if (!isRequired(body.title)) {
    throw new AppError(400, 'Vui lòng nhập tiêu đề.')
  }
  if (!isRequired(body.content)) {
    throw new AppError(400, 'Vui lòng nhập nội dung công việc.')
  }
  if (body.progress !== undefined && body.progress !== null && body.progress !== '' && Number.isNaN(Number(body.progress))) {
    throw new AppError(400, 'progress không hợp lệ.')
  }
}

function validateUpdatePayload(body) {
  if ('log_date' in body && !isValidDate(body.log_date)) {
    throw new AppError(400, 'log_date không hợp lệ.')
  }
  if ('progress' in body && body.progress !== null && body.progress !== '' && Number.isNaN(Number(body.progress))) {
    throw new AppError(400, 'progress không hợp lệ.')
  }
  if ('status' in body && typeof body.status !== 'string') {
    throw new AppError(400, 'status không hợp lệ.')
  }
}

async function list(req, res) {
  const { internship_id, page, pageSize } = req.query
  const { rows, pagination } = await internshipLogService.getAll({ internship_id, page, pageSize }, req.user)
  sendSuccess(res, { message: 'Internship logs retrieved successfully', data: rows, meta: pagination ?? undefined })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const log = await internshipLogService.getByIdForUser(req.params.id, req.user)
  if (!log) {
    throw new AppError(404, 'Internship log not found')
  }
  sendSuccess(res, { message: 'Internship log retrieved successfully', data: log })
}

async function create(req, res) {
  validateCreatePayload(req.body)
  const log = await internshipLogService.create(req.body, req.user)
  sendSuccess(res, { statusCode: 201, message: 'Internship log created successfully', data: log })
}

async function update(req, res) {
  validateId(req.params.id)
  validateUpdatePayload(req.body)
  const log = await internshipLogService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Internship log updated successfully', data: log })
}

async function remove(req, res) {
  validateId(req.params.id)
  await internshipLogService.remove(req.params.id, req.user)
  sendSuccess(res, { message: 'Internship log deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
