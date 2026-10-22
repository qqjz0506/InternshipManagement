const ExcelJS = require('exceljs')
const { pool } = require('../config/database')
const scopeService = require('./scopeService')
const evaluationService = require('./evaluationService')

// Nhãn hiển thị cho report Excel — thuần presentation, KHÔNG phải business rule mới (đồng bộ đúng
// nhãn tiếng Việt đã dùng ở client/src/utils/internshipStatus.js STATUS_META, chỉ nhân bản chuỗi
// hiển thị, không nhân bản/đổi business logic transition nào — logic đó vẫn chỉ ở
// server/utils/internshipStatus.js ALLOWED_TRANSITIONS, không đụng tới ở đây).
const INTERNSHIP_STATUS_LABEL = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang thực tập',
  completed: 'Hoàn thành',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}

const EVALUATOR_ROLE_LABEL = {
  lecturer: 'Giảng viên',
  company: 'Người hướng dẫn doanh nghiệp',
}

function toYesNo(value) {
  return value ? 'Đã công bố' : 'Chưa công bố'
}

// Scope + filter chung cho Internship/Evaluation export — mirror ĐÚNG logic scoping đã có sẵn ở
// internshipService.getAll()/evaluationService.getAll() (Phase 3B), KHÔNG tạo luật authorization
// mới. Scope luôn áp dụng TRƯỚC, filter (period/department/company) chỉ AND thêm vào sau — không có
// param nào có thể mở rộng ra ngoài scope của currentUser (mục 15 Phase 5).
async function buildInternshipScopeCondition(currentUser) {
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    return { clause: 'i.student_id = ?', param: own?.id ?? 0 }
  }
  if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    return { clause: 'i.lecturer_id = ?', param: own?.id ?? 0 }
  }
  if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    return { clause: 'i.company_mentor_id = ?', param: own?.id ?? 0 }
  }
  return null
}

function applyAdminFilters(conditions, params, { period_id, department_id, company_id }) {
  if (period_id) {
    conditions.push('i.period_id = ?')
    params.push(period_id)
  }
  if (department_id) {
    conditions.push('s.department_id = ?')
    params.push(department_id)
  }
  if (company_id) {
    conditions.push('i.company_id = ?')
    params.push(company_id)
  }
}

// Internship export: explicit columns, JOIN thay vì N+1 query (mục 29), parameterized (mục 28).
// Sort mặc định: theo đợt (period_code) rồi mã sinh viên (mục 30).
async function queryInternships(filters, currentUser) {
  const conditions = []
  const params = []

  const scope = await buildInternshipScopeCondition(currentUser)
  if (scope) {
    conditions.push(scope.clause)
    params.push(scope.param)
  }
  applyAdminFilters(conditions, params, filters)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(
    `SELECT
      s.student_code, s.full_name AS student_name, s.email AS student_email,
      s.class AS student_class, s.major AS student_major,
      d.department_name,
      c.company_code, c.company_name, c.address AS company_address,
      cm.full_name AS mentor_name, cm.email AS mentor_email,
      l.full_name AS lecturer_name, l.email AS lecturer_email,
      t.topic_code, t.topic_name,
      p.period_code, p.period_name, p.start_date AS period_start_date, p.end_date AS period_end_date,
      i.status, i.progress, i.start_date, i.end_date, i.created_at, i.updated_at,
      (SELECT r.is_late FROM reports r WHERE r.internship_id = i.id AND r.report_type = 'final'
       ORDER BY r.id DESC LIMIT 1) AS final_report_late
    FROM internships i
    JOIN students s ON s.id = i.student_id
    JOIN departments d ON d.id = s.department_id
    JOIN internship_periods p ON p.id = i.period_id
    LEFT JOIN companies c ON c.id = i.company_id
    LEFT JOIN company_mentors cm ON cm.id = i.company_mentor_id
    LEFT JOIN lecturers l ON l.id = i.lecturer_id
    LEFT JOIN topics t ON t.id = i.topic_id
    ${where}
    ORDER BY p.period_code, s.student_code`,
    params,
  )
  return rows
}

// Evaluation export: scope mirror ĐÚNG evaluationService.getAll() — Student CHỈ thấy is_published=1
// của chính mình (mục 11 Phase 5, KHÔNG được để lọt unpublished), Lecturer/Mentor chỉ đúng
// evaluator_role tương ứng + internship mình phụ trách. Filter period/department/company (nếu có)
// áp dụng qua internship/student đã JOIN sẵn, SAU scope.
async function queryEvaluations(filters, currentUser) {
  const conditions = []
  const params = []

  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    conditions.push('i.student_id = ?', 'e.is_published = 1')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    conditions.push('i.lecturer_id = ?', "e.evaluator_role = 'lecturer'")
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    conditions.push('i.company_mentor_id = ?', "e.evaluator_role = 'company'")
    params.push(own?.id ?? 0)
  }
  applyAdminFilters(conditions, params, filters)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(
    `SELECT
      e.internship_id,
      s.student_code, s.full_name AS student_name,
      c.company_name, t.topic_name, p.period_code, p.period_name,
      e.evaluator_role,
      CASE e.evaluator_role WHEN 'lecturer' THEN l.full_name WHEN 'company' THEN cm.full_name END AS evaluator_name,
      e.attitude_score, e.skill_score, e.progress_score, e.discipline_score, e.overall_score,
      e.comment, e.is_published, e.published_at, e.created_at
    FROM evaluations e
    JOIN internships i ON i.id = e.internship_id
    JOIN students s ON s.id = i.student_id
    JOIN internship_periods p ON p.id = i.period_id
    LEFT JOIN companies c ON c.id = i.company_id
    LEFT JOIN lecturers l ON l.id = i.lecturer_id
    LEFT JOIN company_mentors cm ON cm.id = i.company_mentor_id
    LEFT JOIN topics t ON t.id = i.topic_id
    ${where}
    ORDER BY s.student_code, e.evaluator_role`,
    params,
  )
  return rows
}

function addSheetHeader(sheet, columns) {
  sheet.columns = columns
  sheet.getRow(1).font = { bold: true }
}

// Trả về workbook ExcelJS (chưa serialize) — controller tự quyết định cách gửi response (mục 27:
// service không biết gì về HTTP). Luôn trả workbook hợp lệ kể cả 0 dòng dữ liệu (mục 16, Option A).
async function buildInternshipWorkbook(filters, currentUser) {
  const rows = await queryInternships(filters, currentUser)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Thông tin thực tập')
  addSheetHeader(sheet, [
    { header: 'Mã sinh viên', key: 'student_code', width: 14 },
    { header: 'Họ tên sinh viên', key: 'student_name', width: 24 },
    { header: 'Email sinh viên', key: 'student_email', width: 26 },
    { header: 'Lớp', key: 'student_class', width: 14 },
    { header: 'Ngành', key: 'student_major', width: 20 },
    { header: 'Khoa/Bộ môn', key: 'department_name', width: 22 },
    { header: 'Mã doanh nghiệp', key: 'company_code', width: 16 },
    { header: 'Doanh nghiệp', key: 'company_name', width: 26 },
    { header: 'Địa chỉ doanh nghiệp', key: 'company_address', width: 28 },
    { header: 'Người hướng dẫn DN', key: 'mentor_name', width: 22 },
    { header: 'Email người hướng dẫn', key: 'mentor_email', width: 26 },
    { header: 'Giảng viên hướng dẫn', key: 'lecturer_name', width: 22 },
    { header: 'Email giảng viên', key: 'lecturer_email', width: 26 },
    { header: 'Mã đề tài', key: 'topic_code', width: 14 },
    { header: 'Đề tài', key: 'topic_name', width: 30 },
    { header: 'Mã đợt', key: 'period_code', width: 14 },
    { header: 'Đợt thực tập', key: 'period_name', width: 24 },
    { header: 'Ngày bắt đầu đợt', key: 'period_start_date', width: 16 },
    { header: 'Ngày kết thúc đợt', key: 'period_end_date', width: 16 },
    { header: 'Trạng thái', key: 'status_label', width: 16 },
    { header: 'Tiến độ (%)', key: 'progress', width: 12 },
    { header: 'Ngày bắt đầu TT', key: 'start_date', width: 16 },
    { header: 'Ngày kết thúc TT', key: 'end_date', width: 16 },
    // Thêm ở CUỐI (không chèn giữa) — tránh xô lệch index cột cũ mà exportService.test.js đang assert
    // cứng, đúng tiền lệ đã làm khi thêm cột điểm tổng kết (Mục 16C README).
    { header: 'Báo cáo tổng kết nộp trễ', key: 'final_report_late_label', width: 20 },
  ])

  rows.forEach((row) => {
    const label = row.final_report_late === null ? '—' : row.final_report_late ? 'Có' : 'Không'
    sheet.addRow({ ...row, status_label: INTERNSHIP_STATUS_LABEL[row.status] ?? row.status, final_report_late_label: label })
  })

  return workbook
}

async function buildEvaluationWorkbook(filters, currentUser) {
  const rows = await queryEvaluations(filters, currentUser)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Đánh giá')
  addSheetHeader(sheet, [
    { header: 'Mã sinh viên', key: 'student_code', width: 14 },
    { header: 'Họ tên sinh viên', key: 'student_name', width: 24 },
    { header: 'Doanh nghiệp', key: 'company_name', width: 26 },
    { header: 'Đề tài', key: 'topic_name', width: 30 },
    { header: 'Mã đợt', key: 'period_code', width: 14 },
    { header: 'Đợt thực tập', key: 'period_name', width: 24 },
    { header: 'Loại người đánh giá', key: 'evaluator_role_label', width: 22 },
    { header: 'Người đánh giá', key: 'evaluator_name', width: 22 },
    { header: 'Điểm thái độ', key: 'attitude_score', width: 12 },
    { header: 'Điểm kỹ năng', key: 'skill_score', width: 12 },
    { header: 'Điểm tiến độ', key: 'progress_score', width: 12 },
    { header: 'Điểm kỷ luật', key: 'discipline_score', width: 12 },
    { header: 'Điểm tổng (đánh giá này)', key: 'overall_score', width: 14 },
    { header: 'Nhận xét', key: 'comment', width: 40 },
    { header: 'Trạng thái công bố', key: 'published_label', width: 16 },
    { header: 'Ngày công bố', key: 'published_at', width: 16 },
    { header: 'Điểm tổng kết thực tập', key: 'final_score', width: 16 },
    { header: 'Xếp loại', key: 'classification', width: 14 },
  ])

  // Điểm tổng kết thực tập: tính bulk theo internship_id (tránh N+1 — mục 29), chỉ internship có ĐỦ
  // 2 đánh giá công bố mới có trong Map, còn lại coi là chưa có (để trống ô, không phải lỗi).
  const internshipIds = [...new Set(rows.map((row) => row.internship_id))]
  const finalResults = await evaluationService.computeFinalResultsBulk(internshipIds)

  rows.forEach((row) => {
    const finalResult = finalResults.get(row.internship_id)
    sheet.addRow({
      ...row,
      evaluator_role_label: EVALUATOR_ROLE_LABEL[row.evaluator_role] ?? row.evaluator_role,
      published_label: toYesNo(row.is_published),
      final_score: finalResult?.finalScore ?? null,
      classification: finalResult?.classification ?? null,
    })
  })

  return workbook
}

module.exports = { buildInternshipWorkbook, buildEvaluationWorkbook }
