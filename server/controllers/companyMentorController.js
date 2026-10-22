const companyMentorService = require('../services/companyMentorService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isValidPhone, isValidId } = require('../utils/validators')

const STATUS_VALUES = ['active', 'inactive']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng validate() của CompanyMentorFormModal.jsx — không có input cho user_id trong form,
// nhưng API vẫn chấp nhận/validate nếu có (đúng mục 11 của Phase 2A áp dụng lại cho Phase 2B).
function validatePayload(body) {
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
  if (!isRequired(body.company_id) || !isValidId(body.company_id)) {
    throw new AppError(400, 'Vui lòng chọn doanh nghiệp hợp lệ.')
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }
  if (body.user_id !== undefined && body.user_id !== null && !isValidId(body.user_id)) {
    throw new AppError(400, 'user_id không hợp lệ.')
  }
}

async function list(req, res) {
  const { search, company_id } = req.query
  const data = await companyMentorService.getAll({ search, company_id }, req.user)
  sendSuccess(res, { message: 'Company mentors retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const mentor = await companyMentorService.getByIdForUser(req.params.id, req.user)
  if (!mentor) {
    throw new AppError(404, 'Company mentor not found')
  }
  sendSuccess(res, { message: 'Company mentor retrieved successfully', data: mentor })
}

async function create(req, res) {
  validatePayload(req.body)
  const mentor = await companyMentorService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Company mentor created successfully', data: mentor })
}

async function update(req, res) {
  validateId(req.params.id)
  validatePayload(req.body)
  const { mentor, unassignedInternshipCount } = await companyMentorService.update(req.params.id, req.body)
  const message =
    unassignedInternshipCount > 0
      ? `Company mentor updated successfully. Đã gỡ phân công khỏi ${unassignedInternshipCount} hồ sơ thực tập do đổi doanh nghiệp.`
      : 'Company mentor updated successfully'
  sendSuccess(res, { message, data: mentor })
}

async function remove(req, res) {
  validateId(req.params.id)
  await companyMentorService.remove(req.params.id)
  sendSuccess(res, { message: 'Company mentor deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
