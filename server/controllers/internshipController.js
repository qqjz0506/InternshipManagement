const internshipService = require('../services/internshipService')
const evaluationService = require('../services/evaluationService')
const documentService = require('../services/documentService')
const studentService = require('../services/studentService')
const companyService = require('../services/companyService')
const departmentService = require('../services/departmentService')
const internshipPeriodService = require('../services/internshipPeriodService')
const settingsService = require('../services/settingsService')
const AppError = require('../utils/AppError')
const { sendSuccess } = require('../utils/response')
const { isRequired, isValidId, isValidDate } = require('../utils/validators')

const PDF_CONTENT_TYPE = 'application/pdf'

async function loadDocumentContext(internship) {
  const student = await studentService.getById(internship.student_id)
  const [department, company, period, settings] = await Promise.all([
    departmentService.getById(student.department_id),
    internship.company_id ? companyService.getById(internship.company_id) : null,
    internshipPeriodService.getById(internship.period_id),
    settingsService.get(),
  ])
  return { student, department, company, period, settings }
}

function sendPdf(res, doc, filename) {
  res.setHeader('Content-Type', PDF_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  doc.pipe(res)
  doc.end()
}

// Giấy giới thiệu: chỉ xuất được khi hồ sơ đã 'approved' trở lên (approved/in_progress/completed) VÀ
// đã có company_id — scope giống GET /internships/:id (getByIdForUser), Student chỉ tải của chính mình.
const INTRODUCTION_LETTER_STATUSES = ['approved', 'in_progress', 'completed']

async function getIntroductionLetter(req, res) {
  validateId(req.params.id)
  const internship = await internshipService.getByIdForUser(req.params.id, req.user)
  if (!internship) {
    throw new AppError(404, 'Internship not found')
  }
  if (!INTRODUCTION_LETTER_STATUSES.includes(internship.status) || !internship.company_id) {
    throw new AppError(409, 'Chỉ xuất được giấy giới thiệu khi hồ sơ thực tập đã được duyệt và đã có doanh nghiệp.')
  }

  const { student, department, company, period, settings } = await loadDocumentContext(internship)
  const doc = documentService.buildIntroductionLetterPdf({ internship, student, department, company, period, settings })
  sendPdf(res, doc, `giay-gioi-thieu-${student.student_code}.pdf`)
}

// Phiếu kết quả: chỉ xuất được khi hồ sơ đã 'completed' — tại thời điểm đó, final_score/
// final_classification ĐÃ CHỐT và 2 đánh giá ĐÃ CÔNG BỐ (bất biến 16F, không thể đảo ngược), nên
// không cần kiểm tra is_published riêng cho Student ở đây — "completed" ĐÃ BAO HÀM "đã công bố".
async function getResultSheet(req, res) {
  validateId(req.params.id)
  const internship = await internshipService.getByIdForUser(req.params.id, req.user)
  if (!internship) {
    throw new AppError(404, 'Internship not found')
  }
  if (internship.status !== 'completed') {
    throw new AppError(409, 'Chỉ xuất được phiếu kết quả khi hồ sơ thực tập đã hoàn thành (completed).')
  }

  const { student, department, company, period, settings } = await loadDocumentContext(internship)
  const [finalResult, { lecturer: lecturerEval, company: companyEval }] = await Promise.all([
    evaluationService.computeFinalResult(req.params.id),
    evaluationService.getPublishedPair(req.params.id),
  ])
  const doc = documentService.buildResultSheetPdf({
    internship, student, department, company, period, lecturerEval, companyEval, finalResult, settings,
  })
  sendPdf(res, doc, `phieu-ket-qua-${student.student_code}.pdf`)
}

function validateId(id) {
  if (!isValidId(id)) {
    throw new AppError(400, 'ID không hợp lệ.')
  }
}

// Format cơ bản cho các field FK/date/progress OPTIONAL — dùng chung cho CREATE và UPDATE.
// Business rule thật (FK có tồn tại không, company/mentor consistency, status transition, progress
// lock, range 0-100) nằm ở service; đây chỉ chặn sai kiểu dữ liệu rõ ràng trước khi tới service.
function validateOptionalFields(body) {
  ;['company_id', 'lecturer_id', 'topic_id', 'company_mentor_id'].forEach((field) => {
    if (field in body && body[field] !== null && body[field] !== '' && !isValidId(body[field])) {
      throw new AppError(400, `${field} không hợp lệ.`)
    }
  })
  ;['start_date', 'end_date'].forEach((field) => {
    if (field in body && body[field] !== null && body[field] !== '' && !isValidDate(body[field])) {
      throw new AppError(400, `${field} không hợp lệ.`)
    }
  })
  if ('status' in body && typeof body.status !== 'string') {
    throw new AppError(400, 'status không hợp lệ.')
  }
  if ('progress' in body && body.progress !== null && body.progress !== '' && Number.isNaN(Number(body.progress))) {
    throw new AppError(400, 'progress không hợp lệ.')
  }
}

// CREATE: đúng InternshipCreateModal.jsx (Admin) / StudentInternshipRegisterModal.jsx (Student) —
// cả 2 flow gửi CÙNG 1 shape tối thiểu (student_id + period_id bắt buộc). Các field khác optional
// nhưng PHẢI validate nếu có gửi — không silently ignore giá trị sai (sửa theo review Phase 2D).
// role==='student': student_id không bắt buộc trong body nữa — service tự ép về đúng hồ sơ của
// chính mình (mục 24 Phase 3B), nên chỉ validate format nếu THỰC SỰ có gửi.
function validateCreatePayload(body, role) {
  if (role === 'student') {
    if (body.student_id !== undefined && !isValidId(body.student_id)) {
      throw new AppError(400, 'student_id không hợp lệ.')
    }
  } else if (!isRequired(body.student_id) || !isValidId(body.student_id)) {
    throw new AppError(400, 'Vui lòng chọn sinh viên hợp lệ.')
  }
  if (!isRequired(body.period_id) || !isValidId(body.period_id)) {
    throw new AppError(400, 'Vui lòng chọn đợt thực tập hợp lệ.')
  }
  validateOptionalFields(body)
}

// UPDATE: chỉ kiểm tra format cơ bản của field nào THỰC SỰ có trong body (partial) — business rule
// nằm ở service.
function validateUpdatePayload(body) {
  validateOptionalFields(body)
}

async function list(req, res) {
  const { search, status, period_id, company_id, lecturer_id, page, pageSize } = req.query
  const { rows, pagination } = await internshipService.getAll(
    { search, status, period_id, company_id, lecturer_id, page, pageSize },
    req.user,
  )
  sendSuccess(res, { message: 'Internships retrieved successfully', data: rows, meta: pagination ?? undefined })
}

async function getOne(req, res) {
  validateId(req.params.id)
  const internship = await internshipService.getByIdForUser(req.params.id, req.user)
  if (!internship) {
    throw new AppError(404, 'Internship not found')
  }
  sendSuccess(res, { message: 'Internship retrieved successfully', data: internship })
}

async function create(req, res) {
  validateCreatePayload(req.body, req.user.role)
  const internship = await internshipService.create(req.body, req.user)
  sendSuccess(res, { statusCode: 201, message: 'Internship created successfully', data: internship })
}

async function update(req, res) {
  validateId(req.params.id)
  validateUpdatePayload(req.body)
  const internship = await internshipService.update(req.params.id, req.body, req.user)
  sendSuccess(res, { message: 'Internship updated successfully', data: internship })
}

async function remove(req, res) {
  validateId(req.params.id)
  await internshipService.remove(req.params.id)
  sendSuccess(res, { message: 'Internship deleted successfully', data: null })
}

// Điểm tổng kết thực tập — dùng chung scope check với GET /:id (getByIdForUser), nên mọi role chỉ
// xem được final-result của internship mình có quyền xem. data: null khi chưa đủ 2 đánh giá công bố
// (data-availability gate, không phải permission riêng — xem evaluationService.computeFinalResult).
async function getFinalResult(req, res) {
  validateId(req.params.id)
  const internship = await internshipService.getByIdForUser(req.params.id, req.user)
  if (!internship) {
    throw new AppError(404, 'Internship not found')
  }
  const result = await evaluationService.computeFinalResult(req.params.id)
  sendSuccess(res, { message: 'Final result retrieved successfully', data: result })
}

module.exports = { list, getOne, create, update, remove, getFinalResult, getIntroductionLetter, getResultSheet }
