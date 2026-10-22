const { pool } = require('../config/database')

const INTERNSHIP_STATUSES = ['pending', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled']

function zeroStatusCounts() {
  return Object.fromEntries(INTERNSHIP_STATUSES.map((status) => [status, 0]))
}

// Điều kiện scope chung cho mọi breakdown (period/company/department) — ĐÚNG filter đang áp dụng ở
// AdminStatisticsPage.jsx (period_id/department_id/company_id, 'all' nghĩa là không áp). department
// lọc qua JOIN students (department_id không có trực tiếp trên internships).
function buildInternshipFilter({ period_id, department_id, company_id }) {
  const conditions = []
  const params = []
  if (period_id) {
    conditions.push('i.period_id = ?')
    params.push(Number(period_id))
  }
  if (company_id) {
    conditions.push('i.company_id = ?')
    params.push(Number(company_id))
  }
  if (department_id) {
    conditions.push('s.department_id = ?')
    params.push(Number(department_id))
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

function toNumber(value) {
  return Number(value ?? 0)
}

function average(numbers) {
  const valid = numbers.filter((n) => n !== null && n !== undefined)
  if (valid.length === 0) return null
  const sum = valid.reduce((total, value) => total + Number(value), 0)
  return Math.round((sum / valid.length) * 10) / 10
}

// KPI tổng quan + phân bố theo trạng thái — 1 câu SQL GROUP BY duy nhất (SUM(status=x) thay cho
// GROUP BY status riêng, tránh phải pivot kết quả nhiều dòng thành object ở JS).
async function getKpiAndStatusBreakdown(filters) {
  const { where, params } = buildInternshipFilter(filters)
  const [[row]] = await pool.query(
    `SELECT
      COUNT(DISTINCT i.id) AS total_internships,
      COUNT(DISTINCT i.company_id) AS companies_in_scope,
      COUNT(DISTINCT i.lecturer_id) AS lecturers_in_scope,
      ${INTERNSHIP_STATUSES.map((status) => `SUM(i.status = '${status}') AS status_${status}`).join(', ')}
    FROM internships i
    JOIN students s ON s.id = i.student_id
    ${where}`,
    params,
  )

  const byStatus = zeroStatusCounts()
  INTERNSHIP_STATUSES.forEach((status) => {
    byStatus[status] = toNumber(row[`status_${status}`])
  })

  return {
    totalInternships: toNumber(row.total_internships),
    companiesInScope: toNumber(row.companies_in_scope),
    lecturersInScope: toNumber(row.lecturers_in_scope),
    byStatus,
  }
}

// totalStudents trong KPI chỉ lọc theo department_id (KHÔNG theo period/company — đúng
// AdminStatisticsPage.jsx: scopedStudents chỉ phụ thuộc departmentFilter).
async function getTotalStudents({ department_id }) {
  const params = []
  let where = ''
  if (department_id) {
    where = 'WHERE department_id = ?'
    params.push(Number(department_id))
  }
  const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM students ${where}`, params)
  return toNumber(row.total)
}

// Theo khoa/bộ môn: total_students là tổng THẬT của khoa (không bị ảnh hưởng bởi filter period/
// company/department — đúng gốc client), còn registered/in_progress/completed lọc theo filter hiện
// tại. 2 câu GROUP BY riêng rồi merge theo id (department không match filter -> giữ 0, không bị rớt
// khỏi danh sách — đúng hành vi "luôn hiển thị đủ khoa" của trang gốc).
async function getByDepartment(filters) {
  const [totals] = await pool.query(`
    SELECT d.id, d.department_name, COUNT(s.id) AS total_students
    FROM departments d LEFT JOIN students s ON s.department_id = d.id
    GROUP BY d.id, d.department_name
    ORDER BY d.id
  `)

  const { where, params } = buildInternshipFilter(filters)
  const [scoped] = await pool.query(
    `SELECT s.department_id AS department_id,
      COUNT(DISTINCT i.id) AS registered,
      SUM(i.status = 'in_progress') AS in_progress,
      SUM(i.status = 'completed') AS completed
    FROM internships i JOIN students s ON s.id = i.student_id
    ${where}
    GROUP BY s.department_id`,
    params,
  )
  const scopedById = new Map(scoped.map((row) => [row.department_id, row]))

  return totals.map((dept) => {
    const match = scopedById.get(dept.id)
    return {
      id: dept.id,
      department_name: dept.department_name,
      total_students: toNumber(dept.total_students),
      registered: toNumber(match?.registered),
      in_progress: toNumber(match?.in_progress),
      completed: toNumber(match?.completed),
    }
  })
}

// Theo đợt thực tập: luôn trả đủ mọi đợt (kể cả 0 hồ sơ khớp filter) — mirror đúng `periods.map(...)`
// gốc, KHÔNG dùng INNER JOIN (sẽ làm rớt đợt không khớp filter).
async function getByPeriod(filters) {
  const [periods] = await pool.query('SELECT id, period_name FROM internship_periods ORDER BY id')

  const { where, params } = buildInternshipFilter(filters)
  const [scoped] = await pool.query(
    `SELECT i.period_id,
      COUNT(DISTINCT i.id) AS total,
      ${INTERNSHIP_STATUSES.map((status) => `SUM(i.status = '${status}') AS status_${status}`).join(', ')}
    FROM internships i JOIN students s ON s.id = i.student_id
    ${where}
    GROUP BY i.period_id`,
    params,
  )
  const scopedById = new Map(scoped.map((row) => [row.period_id, row]))

  return periods.map((period) => {
    const match = scopedById.get(period.id)
    const statusCounts = zeroStatusCounts()
    INTERNSHIP_STATUSES.forEach((status) => {
      statusCounts[status] = toNumber(match?.[`status_${status}`])
    })
    return {
      id: period.id,
      period_name: period.period_name,
      total: toNumber(match?.total),
      ...statusCounts,
    }
  })
}

// Theo doanh nghiệp: mentor_count KHÔNG bị ảnh hưởng bởi filter (đúng gốc: `mentors.filter(company_id)`
// tính trên toàn bộ mentors, không qua scopedInternships). student_count/in_progress/completed lọc
// theo filter hiện tại.
async function getByCompany(filters) {
  const [companies] = await pool.query(`
    SELECT c.id, c.company_name, COUNT(cm.id) AS mentor_count
    FROM companies c LEFT JOIN company_mentors cm ON cm.company_id = c.id
    GROUP BY c.id, c.company_name
    ORDER BY c.id
  `)

  const { where, params } = buildInternshipFilter(filters)
  const [scoped] = await pool.query(
    `SELECT i.company_id,
      COUNT(DISTINCT i.id) AS student_count,
      SUM(i.status = 'in_progress') AS in_progress,
      SUM(i.status = 'completed') AS completed
    FROM internships i JOIN students s ON s.id = i.student_id
    ${where}
    GROUP BY i.company_id`,
    params,
  )
  const scopedById = new Map(scoped.map((row) => [row.company_id, row]))

  const rows = companies.map((company) => {
    const match = scopedById.get(company.id)
    return {
      id: company.id,
      company_name: company.company_name,
      mentor_count: toNumber(company.mentor_count),
      student_count: toNumber(match?.student_count),
      in_progress: toNumber(match?.in_progress),
      completed: toNumber(match?.completed),
    }
  })
  return rows.sort((a, b) => b.student_count - a.student_count)
}

async function getReportStats(filters) {
  const { where, params } = buildInternshipFilter(filters)
  const [[row]] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(r.status = 'draft') AS status_draft,
      SUM(r.status = 'submitted') AS status_submitted,
      SUM(r.status = 'approved') AS status_approved,
      SUM(r.status = 'rejected') AS status_rejected,
      SUM(r.reviewer_comment IS NOT NULL OR r.company_comment IS NOT NULL) AS with_feedback
    FROM reports r JOIN internships i ON i.id = r.internship_id JOIN students s ON s.id = i.student_id
    ${where}`,
    params,
  )
  return {
    total: toNumber(row.total),
    byStatus: {
      draft: toNumber(row.status_draft),
      submitted: toNumber(row.status_submitted),
      approved: toNumber(row.status_approved),
      rejected: toNumber(row.status_rejected),
    },
    withFeedback: toNumber(row.with_feedback),
  }
}

async function getEvaluationStats(filters) {
  const { where, params } = buildInternshipFilter(filters)
  const [rows] = await pool.query(
    `SELECT e.evaluator_role, e.overall_score, e.is_published
    FROM evaluations e JOIN internships i ON i.id = e.internship_id JOIN students s ON s.id = i.student_id
    ${where}`,
    params,
  )
  const lecturerRows = rows.filter((r) => r.evaluator_role === 'lecturer')
  const companyRows = rows.filter((r) => r.evaluator_role === 'company')
  return {
    total: rows.length,
    lecturerCount: lecturerRows.length,
    companyCount: companyRows.length,
    publishedCount: rows.filter((r) => r.is_published).length,
    lecturerAverage: average(lecturerRows.map((r) => r.overall_score)),
    companyAverage: average(companyRows.map((r) => r.overall_score)),
  }
}

// Tổng hợp toàn bộ thống kê cho AdminStatisticsPage.jsx — 1 hàm duy nhất, mỗi breakdown 1-2 câu SQL
// GROUP BY (không tính aggregate ở JS như bản cũ chạy trên toàn bộ dữ liệu đã load qua Context).
async function getSummary(filters) {
  const [kpiAndStatus, totalStudents, byDepartment, byPeriod, byCompany, reports, evaluations] = await Promise.all([
    getKpiAndStatusBreakdown(filters),
    getTotalStudents(filters),
    getByDepartment(filters),
    getByPeriod(filters),
    getByCompany(filters),
    getReportStats(filters),
    getEvaluationStats(filters),
  ])

  return {
    kpi: {
      totalStudents,
      totalInternships: kpiAndStatus.totalInternships,
      companiesInScope: kpiAndStatus.companiesInScope,
      lecturersInScope: kpiAndStatus.lecturersInScope,
      totalReports: reports.total,
      totalEvaluations: evaluations.total,
      ...kpiAndStatus.byStatus,
    },
    byStatus: kpiAndStatus.byStatus,
    byDepartment,
    byPeriod,
    byCompany,
    reports,
    evaluations,
  }
}

module.exports = { getSummary }
