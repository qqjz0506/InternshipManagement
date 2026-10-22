const studentService = require('../services/studentService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isValidPhone, isValidId } = require('../utils/validators')

const GENDER_VALUES = ['Nam', 'Nữ', 'Khác']
const STATUS_VALUES = ['active', 'inactive']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

function validatePayload(body) {
  if (!isRequired(body.student_code)) {
    throw new AppError(400, 'Vui lòng nhập mã sinh viên.')
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
  if (body.gender && !GENDER_VALUES.includes(body.gender)) {
    throw new AppError(400, `Giới tính phải là một trong: ${GENDER_VALUES.join(', ')}.`)
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }
  if (body.user_id !== undefined && body.user_id !== null && !isValidId(body.user_id)) {
    throw new AppError(400, 'user_id không hợp lệ.')
  }
}

// Student tự sửa chỉ gửi tập field liên hệ (StudentProfilePage.jsx) — không bắt buộc student_code/
// department_id như form Admin. Validate format cho đúng field thực sự có mặt.
function validateSelfEditPayload(body) {
  if ('email' in body) {
    if (!isRequired(body.email)) {
      throw new AppError(400, 'Vui lòng nhập email.')
    }
    if (!isValidEmail(body.email)) {
      throw new AppError(400, 'Email không hợp lệ.')
    }
  }
  if ('phone' in body && body.phone && !isValidPhone(body.phone)) {
    throw new AppError(400, 'Số điện thoại không hợp lệ.')
  }
  if ('gender' in body && body.gender && !GENDER_VALUES.includes(body.gender)) {
    throw new AppError(400, `Giới tính phải là một trong: ${GENDER_VALUES.join(', ')}.`)
  }
}

// page/pageSize optional — không truyền page -> trả toàn bộ (hành vi cũ, data là array thuần).
// Có page -> data là array của ĐÚNG 1 trang, kèm { total, page, pageSize } ở top-level response.
async function list(req, res) {
  const { search, department_id, status, page, pageSize } = req.query
  const { rows, pagination } = await studentService.getAll({ search, department_id, status, page, pageSize }, req.user)
  sendSuccess(res, { message: 'Students retrieved successfully', data: rows, meta: pagination ?? undefined })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const student = await studentService.getByIdForUser(req.params.id, req.user)
  if (!student) {
    throw new AppError(404, 'Student not found')
  }
  sendSuccess(res, { message: 'Student retrieved successfully', data: student })
}

async function create(req, res) {
  validatePayload(req.body)
  const student = await studentService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Student created successfully', data: student })
}

async function update(req, res) {
  validateId(req.params.id)
  if (req.user.role === 'student') {
    validateSelfEditPayload(req.body)
  } else {
    validatePayload(req.body)
  }
  const student = await studentService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Student updated successfully', data: student })
}

async function remove(req, res) {
  validateId(req.params.id)
  await studentService.remove(req.params.id)
  sendSuccess(res, { message: 'Student deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
