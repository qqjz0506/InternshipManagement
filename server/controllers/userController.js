const userService = require('../services/userService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidEmail, isValidId } = require('../utils/validators')

const ROLE_VALUES = ['admin', 'student', 'lecturer', 'company_mentor']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// profile_id: tên field nội bộ backend (snake_case, khớp convention toàn bộ API hiện có) — tương ứng
// với "linkedProfileId" ở AdminAccountsPage.jsx hiện tại (mock). Mapping camelCase ↔ snake_case (nếu
// cần) sẽ nằm ở API boundary phía frontend khi migrate (Phase 4F-2), đúng pattern đã dùng ở Settings
// (Phase 4E-3) — không đổi convention snake_case của backend chỉ để khớp 1 Context mock sắp bị thay thế.
function validateCreatePayload(body) {
  if (!isRequired(body.full_name)) {
    throw new AppError(400, 'Vui lòng nhập họ tên.')
  }
  if (!isRequired(body.email)) {
    throw new AppError(400, 'Vui lòng nhập email.')
  }
  if (!isValidEmail(body.email)) {
    throw new AppError(400, 'Email không hợp lệ.')
  }
  if (!isRequired(body.password)) {
    throw new AppError(400, 'Vui lòng nhập mật khẩu.')
  }
  if (!isRequired(body.role) || !ROLE_VALUES.includes(body.role)) {
    throw new AppError(400, `Vai trò phải là một trong: ${ROLE_VALUES.join(', ')}.`)
  }
  if (body.profile_id !== undefined && body.profile_id !== null && !isValidId(body.profile_id)) {
    throw new AppError(400, 'profile_id không hợp lệ.')
  }
}

function validateUpdatePayload(body) {
  if (body.full_name !== undefined && !isRequired(body.full_name)) {
    throw new AppError(400, 'Họ tên không được để trống.')
  }
  if (body.email !== undefined) {
    if (!isRequired(body.email)) {
      throw new AppError(400, 'Email không được để trống.')
    }
    if (!isValidEmail(body.email)) {
      throw new AppError(400, 'Email không hợp lệ.')
    }
  }
  if (body.password !== undefined && !isRequired(body.password)) {
    throw new AppError(400, 'Mật khẩu không được để trống.')
  }
}

async function list(req, res) {
  const { search, role } = req.query
  const data = await userService.getAll({ search, role })
  sendSuccess(res, { message: 'Users retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const user = await userService.getById(req.params.id)
  if (!user) {
    throw new AppError(404, 'User not found')
  }
  sendSuccess(res, { message: 'User retrieved successfully', data: user })
}

async function create(req, res) {
  validateCreatePayload(req.body)
  const user = await userService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: user })
}

async function update(req, res) {
  validateId(req.params.id)
  validateUpdatePayload(req.body)
  const user = await userService.update(req.params.id, req.body)
  sendSuccess(res, { message: 'User updated successfully', data: user })
}

async function resetPassword(req, res) {
  validateId(req.params.id)
  const result = await userService.resetPassword(req.params.id)
  sendSuccess(res, { message: 'Đặt lại mật khẩu thành công', data: result })
}

function validateStatusPayload(body) {
  if (!isRequired(body.status)) {
    throw new AppError(400, 'Vui lòng chọn trạng thái.')
  }
}

async function setStatus(req, res) {
  validateId(req.params.id)
  validateStatusPayload(req.body)
  const user = await userService.setStatus(req.params.id, req.body.status, req.user)
  sendSuccess(res, { message: 'Cập nhật trạng thái tài khoản thành công', data: user })
}

module.exports = { list, getOne, create, update, resetPassword, setStatus }
