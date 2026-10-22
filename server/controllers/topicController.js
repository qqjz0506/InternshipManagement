const topicService = require('../services/topicService')
const scopeService = require('../services/scopeService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId } = require('../utils/validators')

const STATUS_VALUES = ['proposed', 'approved', 'rejected']
const LECTURER_ALLOWED_STATUS = ['approved', 'rejected']

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Khớp đúng validate() của TopicFormModal.jsx — suggested_by_student_id/company_id đều optional,
// không ràng buộc loại trừ lẫn nhau (đúng Database Design mục I.4, không tự thêm rule).
function validatePayload(body) {
  if (!isRequired(body.topic_code)) {
    throw new AppError(400, 'Vui lòng nhập mã đề tài.')
  }
  if (!isRequired(body.topic_name)) {
    throw new AppError(400, 'Vui lòng nhập tên đề tài.')
  }
  if (
    body.suggested_by_student_id !== undefined &&
    body.suggested_by_student_id !== null &&
    body.suggested_by_student_id !== '' &&
    !isValidId(body.suggested_by_student_id)
  ) {
    throw new AppError(400, 'suggested_by_student_id không hợp lệ.')
  }
  if (
    body.company_id !== undefined &&
    body.company_id !== null &&
    body.company_id !== '' &&
    !isValidId(body.company_id)
  ) {
    throw new AppError(400, 'company_id không hợp lệ.')
  }
  if (body.status && !STATUS_VALUES.includes(body.status)) {
    throw new AppError(400, `Trạng thái phải là một trong: ${STATUS_VALUES.join(', ')}.`)
  }
}

// Lecturer CHỈ được gửi đúng { status }, giá trị chỉ được approved/rejected (duyệt/từ chối đề tài
// đang ở trạng thái "Đề xuất" — không được tự đặt lại thành 'proposed', đó là trạng thái khởi tạo).
// Field khác (topic_code/topic_name/description/suggested_by_student_id/company_id) bị reject toàn
// bộ request, KHÔNG được silently bỏ qua (mục 5 của yêu cầu fix blocker).
function validateLecturerStatusPayload(body) {
  const disallowedFields = Object.keys(body).filter((field) => field !== 'status')
  if (disallowedFields.length > 0) {
    throw new AppError(403, `Giảng viên không được sửa field: ${disallowedFields.join(', ')}.`)
  }
  if (!isRequired(body.status) || !LECTURER_ALLOWED_STATUS.includes(body.status)) {
    throw new AppError(400, `Giảng viên chỉ được đổi trạng thái thành: ${LECTURER_ALLOWED_STATUS.join(', ')}.`)
  }
}

async function list(req, res) {
  const { search, status } = req.query
  const data = await topicService.getAll({ search, status })
  sendSuccess(res, { message: 'Topics retrieved successfully', data })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const topic = await topicService.getById(req.params.id)
  if (!topic) {
    throw new AppError(404, 'Topic not found')
  }
  sendSuccess(res, { message: 'Topic retrieved successfully', data: topic })
}

// Student tạo đề tài được qua StudentProposeTopicModal.jsx (addTopic trực tiếp) — nhưng chỉ được
// đề xuất CHO CHÍNH MÌNH, không được mạo danh suggested_by_student_id của sinh viên khác (mục 24),
// và không được tự gán company_id/status khác mặc định (đó là việc của Admin/Company).
async function create(req, res) {
  validatePayload(req.body)

  const payload = { ...req.body }
  if (req.user.role === 'student') {
    const ownStudent = await scopeService.getStudentProfile(req.user.id)
    if (!ownStudent) {
      throw new AppError(403, 'Tài khoản chưa được liên kết hồ sơ sinh viên.')
    }
    if (payload.suggested_by_student_id && Number(payload.suggested_by_student_id) !== ownStudent.id) {
      throw new AppError(403, 'Không được đề xuất đề tài dưới danh nghĩa sinh viên khác.')
    }
    payload.suggested_by_student_id = ownStudent.id
    payload.company_id = null
    payload.status = 'proposed'
  }

  const topic = await topicService.create(payload)
  sendSuccess(res, { statusCode: 201, message: 'Topic created successfully', data: topic })
}

async function update(req, res) {
  validateId(req.params.id)
  if (req.user.role === 'lecturer') {
    validateLecturerStatusPayload(req.body)
  } else {
    validatePayload(req.body)
  }
  const topic = await topicService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Topic updated successfully', data: topic })
}

async function remove(req, res) {
  validateId(req.params.id)
  await topicService.remove(req.params.id)
  sendSuccess(res, { message: 'Topic deleted successfully', data: null })
}

module.exports = { list, getOne, create, update, remove }
