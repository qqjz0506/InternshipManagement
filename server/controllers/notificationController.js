const notificationService = require('../services/notificationService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

function validateCreatePayload(body) {
  if (!isRequired(body.user_id) || !isValidId(body.user_id)) {
    throw new AppError(400, 'Vui lòng chọn user hợp lệ.')
  }
  if (!isRequired(body.title)) {
    throw new AppError(400, 'Vui lòng nhập tiêu đề.')
  }
  if (!isRequired(body.type)) {
    throw new AppError(400, 'Vui lòng chọn type.')
  }
}

async function list(req, res) {
  const { user_id } = req.query
  const data = await notificationService.getAll({ user_id }, req.user)
  sendSuccess(res, { message: 'Notifications retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const notification = await notificationService.getByIdForUser(req.params.id, req.user)
  if (!notification) {
    throw new AppError(404, 'Notification not found')
  }
  sendSuccess(res, { message: 'Notification retrieved successfully', data: notification })
}

async function create(req, res) {
  validateCreatePayload(req.body)
  const notification = await notificationService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Notification created successfully', data: notification })
}

async function update(req, res) {
  validateId(req.params.id)
  const notification = await notificationService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Notification updated successfully', data: notification })
}

async function markAllAsRead(req, res) {
  await notificationService.markAllAsRead(req.user)
  sendSuccess(res, { message: 'Đã đánh dấu tất cả thông báo là đã đọc', data: null })
}

async function remove(req, res) {
  validateId(req.params.id)
  await notificationService.remove(req.params.id)
  sendSuccess(res, { message: 'Notification deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove, markAllAsRead }
