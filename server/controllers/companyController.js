const companyService = require('../services/companyService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isValidPhone, isValidId } = require('../utils/validators')

const STATUS_VALUES = ['active', 'inactive']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng validate() của CompanyFormModal.jsx: company_code/company_name/tax_code/address
// đều required; email/phone chỉ validate format khi có nhập (không bắt buộc).
function validatePayload(body) {
  if (!isRequired(body.company_code)) {
    throw new AppError(400, 'Vui lòng nhập mã doanh nghiệp.')
  }
  if (!isRequired(body.company_name)) {
    throw new AppError(400, 'Vui lòng nhập tên doanh nghiệp.')
  }
  if (!isRequired(body.tax_code)) {
    throw new AppError(400, 'Vui lòng nhập mã số thuế.')
  }
  if (!isRequired(body.address)) {
    throw new AppError(400, 'Vui lòng nhập địa chỉ.')
  }
  if (body.email && !isValidEmail(body.email)) {
    throw new AppError(400, 'Email không hợp lệ.')
  }
  if (body.phone && !isValidPhone(body.phone)) {
    throw new AppError(400, 'Số điện thoại không hợp lệ.')
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }
}

async function list(req, res) {
  const { search, status } = req.query
  const data = await companyService.getAll({ search, status })
  sendSuccess(res, { message: 'Companies retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const company = await companyService.getById(req.params.id)
  if (!company) {
    throw new AppError(404, 'Company not found')
  }
  sendSuccess(res, { message: 'Company retrieved successfully', data: company })
}

async function create(req, res) {
  validatePayload(req.body)
  const company = await companyService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Company created successfully', data: company })
}

async function update(req, res) {
  validateId(req.params.id)
  validatePayload(req.body)
  const company = await companyService.update(req.params.id, req.body)
  sendSuccess(res, { message: 'Company updated successfully', data: company })
}

async function remove(req, res) {
  validateId(req.params.id)
  await companyService.remove(req.params.id)
  sendSuccess(res, { message: 'Company deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
