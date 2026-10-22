const statisticsService = require('../services/statisticsService')
const { sendSuccess } = require('../utils/response')

// Filter giống đúng AdminStatisticsPage.jsx (period_id/department_id/company_id) — 'all' ở UI nghĩa
// là không gửi field đó lên API (đã map ở exportApi.js-style, không gửi query param rỗng).
async function getSummary(req, res) {
  const { period_id, department_id, company_id } = req.query
  const data = await statisticsService.getSummary({ period_id, department_id, company_id })
  sendSuccess(res, { message: 'Statistics summary retrieved successfully', data })
}

module.exports = { getSummary }
