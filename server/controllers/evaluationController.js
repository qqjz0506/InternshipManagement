const evaluationService = require('../services/evaluationService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

const SCORE_FIELDS = ['attitude_score', 'skill_score', 'progress_score', 'discipline_score', 'overall_score']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// evaluator_role bắt buộc với Admin (không có cách suy ra), nhưng OPTIONAL với Lecturer/Company
// Mentor — service tự ép đúng theo role tài khoản (mục 24 Phase 3B), gửi kèm giá trị khác sẽ bị từ chối.
function validateCreatePayload(body, role) {
  if (!isRequired(body.internship_id) || !isValidId(body.internship_id)) {
    throw new AppError(400, 'Vui lòng chọn hồ sơ thực tập hợp lệ.')
  }
  if (role === 'admin' && !isRequired(body.evaluator_role)) {
    throw new AppError(400, 'Vui lòng chọn evaluator_role.')
  }
  SCORE_FIELDS.forEach((field) => {
    if (body[field] !== undefined && Number.isNaN(Number(body[field]))) {
      throw new AppError(400, `${field} không hợp lệ.`)
    }
  })
}

function validateUpdatePayload(body) {
  SCORE_FIELDS.forEach((field) => {
    if (field in body && Number.isNaN(Number(body[field]))) {
      throw new AppError(400, `${field} không hợp lệ.`)
    }
  })
}

async function list(req, res) {
  const { internship_id, evaluator_role, is_published } = req.query
  const data = await evaluationService.getAll({ internship_id, evaluator_role, is_published }, req.user)
  sendSuccess(res, { message: 'Evaluations retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const evaluation = await evaluationService.getByIdForUser(req.params.id, req.user)
  if (!evaluation) {
    throw new AppError(404, 'Evaluation not found')
  }
  sendSuccess(res, { message: 'Evaluation retrieved successfully', data: evaluation })
}

async function create(req, res) {
  validateCreatePayload(req.body, req.user.role)
  const evaluation = await evaluationService.create(req.body, req.user)
  sendSuccess(res, { statusCode: 201, message: 'Evaluation created successfully', data: evaluation })
}

async function update(req, res) {
  validateId(req.params.id)
  validateUpdatePayload(req.body)
  const evaluation = await evaluationService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Evaluation updated successfully', data: evaluation })
}

async function remove(req, res) {
  validateId(req.params.id)
  await evaluationService.remove(req.params.id)
  sendSuccess(res, { message: 'Evaluation deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
