const departmentService = require('../services/departmentService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

function validatePayload(body) {
  if (!isRequired(body.department_code)) {
    throw new AppError(400, 'Vui lòng nhập mã khoa.')
  }
  if (!isRequired(body.department_name)) {
    throw new AppError(400, 'Vui lòng nhập tên khoa.')
  }
}

async function list(req, res) {
  const { search } = req.query
  const data = await departmentService.getAll({ search })
  sendSuccess(res, { message: 'Departments retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const department = await departmentService.getById(req.params.id)
  if (!department) {
    throw new AppError(404, 'Department not found')
  }
  sendSuccess(res, { message: 'Department retrieved successfully', data: department })
}

async function create(req, res) {
  validatePayload(req.body)
  const { department_code, department_name, description } = req.body
  const department = await departmentService.create({ department_code, department_name, description })
  sendSuccess(res, { statusCode: 201, message: 'Department created successfully', data: department })
}

async function update(req, res) {
  validateId(req.params.id)
  validatePayload(req.body)
  const { department_code, department_name, description } = req.body
  const department = await departmentService.update(req.params.id, { department_code, department_name, description })
  sendSuccess(res, { message: 'Department updated successfully', data: department })
}

async function remove(req, res) {
  validateId(req.params.id)
  await departmentService.remove(req.params.id)
  sendSuccess(res, { message: 'Department deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
