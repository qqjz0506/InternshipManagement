const exportService = require('../services/exportService')
const AppError = require('../utils/AppError')
const { isValidId } = require('../utils/validators')
const { todayDateString } = require('../utils/dateTime')

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Filter tối giản, đúng 3 filter THỰC SỰ tồn tại ở AdminStatisticsPage.jsx (period/department/company)
// — không tự thêm filter mới (mục 14 Phase 5). Áp dụng chung cho mọi role (scope luôn chặn trước ở
// service — mục 15), dù hiện tại chỉ Admin UI mới thực sự gửi các query này.
function parseFilters(query) {
  ;['period_id', 'department_id', 'company_id'].forEach((field) => {
    if (query[field] !== undefined && !isValidId(query[field])) {
      throw new AppError(400, `${field} không hợp lệ.`)
    }
  })
  return {
    period_id: query.period_id,
    department_id: query.department_id,
    company_id: query.company_id,
  }
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

async function exportInternships(req, res) {
  const filters = parseFilters(req.query)
  const workbook = await exportService.buildInternshipWorkbook(filters, req.user)
  await sendWorkbook(res, workbook, `internship-information-${todayDateString()}.xlsx`)
}

async function exportEvaluations(req, res) {
  const filters = parseFilters(req.query)
  const workbook = await exportService.buildEvaluationWorkbook(filters, req.user)
  await sendWorkbook(res, workbook, `evaluations-${todayDateString()}.xlsx`)
}

module.exports = { exportInternships, exportEvaluations }
