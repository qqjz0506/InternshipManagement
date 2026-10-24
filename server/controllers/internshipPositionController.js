const positionService = require('../services/internshipPositionService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// company_id: Company Mentor không bắt buộc gửi (service tự ép company_id của chính mình), Admin
// BẮT BUỘC chọn (không có "công ty của mình" để tự suy ra).
function validateCreatePayload(body, currentUser) {
  if (!isRequired(body.title)) {
    throw new AppError(400, 'Vui lòng nhập tên vị trí thực tập.')
  }
  if (!isRequired(body.period_id) || !isValidId(body.period_id)) {
    throw new AppError(400, 'Vui lòng chọn đợt thực tập hợp lệ.')
  }
  if (currentUser.role === 'admin') {
    if (!isRequired(body.company_id) || !isValidId(body.company_id)) {
      throw new AppError(400, 'Vui lòng chọn doanh nghiệp hợp lệ.')
    }
  } else if (body.company_id !== undefined && body.company_id !== null && !isValidId(body.company_id)) {
    throw new AppError(400, 'company_id không hợp lệ.')
  }
  if (!isRequired(body.slots)) {
    throw new AppError(400, 'Vui lòng nhập số lượng vị trí (slots).')
  }
}

async function list(req, res) {
  const { search, period_id, company_id, status } = req.query
  const data = await positionService.getAll({ search, period_id, company_id, status }, req.user)
  sendSuccess(res, { message: 'Internship positions retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const position = await positionService.getById(req.params.id)
  if (!position) {
    throw new AppError(404, 'Internship position not found')
  }
  sendSuccess(res, { message: 'Internship position retrieved successfully', data: position })
}

async function create(req, res) {
  validateCreatePayload(req.body, req.user)
  const position = await positionService.create(req.body, req.user)
  sendSuccess(res, { statusCode: 201, message: 'Internship position created successfully', data: position })
}

async function update(req, res) {
  validateId(req.params.id)
  const position = await positionService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Internship position updated successfully', data: position })
}

module.exports = { list, getOne, create, update }
