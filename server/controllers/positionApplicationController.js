const applicationService = require('../services/positionApplicationService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

async function list(req, res) {
  const { position_id, status } = req.query
  const data = await applicationService.getAll({ position_id, status }, req.user)
  sendSuccess(res, { message: 'Position applications retrieved successfully', data })
}

async function apply(req, res) {
  if (!isRequired(req.body.position_id) || !isValidId(req.body.position_id)) {
    throw new AppError(400, 'Vui lòng chọn vị trí thực tập hợp lệ.')
  }
  const application = await applicationService.apply(req.body.position_id, req.body.note, req.user)
  sendSuccess(res, { statusCode: 201, message: 'Applied successfully', data: application })
}

async function withdraw(req, res) {
  validateId(req.params.id)
  const application = await applicationService.withdraw(req.params.id, req.user)
  sendSuccess(res, { message: 'Application withdrawn successfully', data: application })
}

async function reject(req, res) {
  validateId(req.params.id)
  const application = await applicationService.reject(req.params.id, req.user)
  sendSuccess(res, { message: 'Application rejected successfully', data: application })
}

async function accept(req, res) {
  validateId(req.params.id)
  const application = await applicationService.accept(req.params.id, req.user)
  sendSuccess(res, { message: 'Application accepted successfully', data: application })
}

module.exports = { list, apply, withdraw, reject, accept }
