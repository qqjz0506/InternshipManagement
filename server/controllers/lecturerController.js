const lecturerService = require('../services/lecturerService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isValidPhone, isValidId } = require('../utils/validators')

const STATUS_VALUES = ['active', 'inactive']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

function validatePayload(body) {
  if (!isRequired(body.lecturer_code)) {
    throw new AppError(400, 'Vui lòng nhập mã giảng viên.')
  }
  if (!isRequired(body.full_name)) {
    throw new AppError(400, 'Vui lòng nhập họ tên.')
  }
  if (!isRequired(body.email)) {
    throw new AppError(400, 'Vui lòng nhập email.')
  }
  if (!isValidEmail(body.email)) {
    throw new AppError(400, 'Email không hợp lệ.')
  }
  if (body.phone && !isValidPhone(body.phone)) {
    throw new AppError(400, 'Số điện thoại không hợp lệ.')
  }
  if (!isRequired(body.department_id) || !isValidId(body.department_id)) {
    throw new AppError(400, 'Vui lòng chọn khoa hợp lệ.')
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }
  if (body.user_id !== undefined && body.user_id !== null && !isValidId(body.user_id)) {
    throw new AppError(400, 'user_id không hợp lệ.')
  }
}

async function list(req, res) {
  const { search, department_id, status } = req.query
  const data = await lecturerService.getAll({ search, department_id, status }, req.user)
  sendSuccess(res, { message: 'Lecturers retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const lecturer = await lecturerService.getByIdForUser(req.params.id, req.user)
  if (!lecturer) {
    throw new AppError(404, 'Lecturer not found')
  }
  sendSuccess(res, { message: 'Lecturer retrieved successfully', data: lecturer })
}

async function create(req, res) {
  validatePayload(req.body)
  const lecturer = await lecturerService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Lecturer created successfully', data: lecturer })
}

async function update(req, res) {
  validateId(req.params.id)
  validatePayload(req.body)
  const lecturer = await lecturerService.update(req.params.id, req.body)
  sendSuccess(res, { message: 'Lecturer updated successfully', data: lecturer })
}

async function remove(req, res) {
  validateId(req.params.id)
  await lecturerService.remove(req.params.id)
  sendSuccess(res, { message: 'Lecturer deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
