const internshipPeriodService = require('../services/internshipPeriodService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId, isValidDate } = require('../utils/validators')

const STATUS_VALUES = ['upcoming', 'ongoing', 'closed']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng validate() của PeriodFormModal.jsx.
function validatePayload(body) {
  if (!isRequired(body.period_code)) {
    throw new AppError(400, 'Vui lòng nhập mã đợt thực tập.')
  }
  if (!isRequired(body.period_name)) {
    throw new AppError(400, 'Vui lòng nhập tên đợt thực tập.')
  }
  if (!isRequired(body.start_date)) {
    throw new AppError(400, 'Vui lòng chọn ngày bắt đầu.')
  }
  if (!isValidDate(body.start_date)) {
    throw new AppError(400, 'Ngày bắt đầu không hợp lệ.')
  }
  if (!isRequired(body.end_date)) {
    throw new AppError(400, 'Vui lòng chọn ngày kết thúc.')
  }
  if (!isValidDate(body.end_date)) {
    throw new AppError(400, 'Ngày kết thúc không hợp lệ.')
  }
  if (body.start_date > body.end_date) {
    throw new AppError(400, 'Ngày kết thúc phải sau ngày bắt đầu.')
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }

  // 3 field nhắc việc (Mục 16J README) — đều optional, có DEFAULT ở DB nếu không gửi.
  if (body.log_frequency_days !== undefined && body.log_frequency_days !== null && body.log_frequency_days !== '') {
    const num = Number(body.log_frequency_days)
    if (!Number.isInteger(num) || num <= 0) {
      throw new AppError(400, 'Số ngày giữa 2 lần ghi nhật ký phải là số nguyên dương.')
    }
  }
  ;['final_report_deadline', 'evaluation_deadline'].forEach((field) => {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return
    }
    if (!isValidDate(body[field])) {
      throw new AppError(400, `${field === 'final_report_deadline' ? 'Hạn nộp báo cáo tổng kết' : 'Hạn hoàn tất đánh giá'} không hợp lệ.`)
    }
    if (isRequired(body.start_date) && body[field] < body.start_date) {
      throw new AppError(
        400,
        `${field === 'final_report_deadline' ? 'Hạn nộp báo cáo tổng kết' : 'Hạn hoàn tất đánh giá'} phải nằm trong hoặc sau ngày bắt đầu đợt.`,
      )
    }
  })
}

async function list(req, res) {
  const { search, status } = req.query
  const data = await internshipPeriodService.getAll({ search, status })
  sendSuccess(res, { message: 'Internship periods retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const period = await internshipPeriodService.getById(req.params.id)
  if (!period) {
    throw new AppError(404, 'Internship period not found')
  }
  sendSuccess(res, { message: 'Internship period retrieved successfully', data: period })
}

async function create(req, res) {
  validatePayload(req.body)
  const period = await internshipPeriodService.create(req.body)
  sendSuccess(res, { statusCode: 201, message: 'Internship period created successfully', data: period })
}

async function update(req, res) {
  validateId(req.params.id)
  validatePayload(req.body)
  const period = await internshipPeriodService.update(req.params.id, req.body)
  sendSuccess(res, { message: 'Internship period updated successfully', data: period })
}

async function remove(req, res) {
  validateId(req.params.id)
  await internshipPeriodService.remove(req.params.id)
  sendSuccess(res, { message: 'Internship period deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
