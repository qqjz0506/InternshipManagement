const reminderService = require('../services/reminderService')
const { sendSuccess } = require('../utils/response')

async function overview(req, res) {
  const data = await reminderService.getOverview(req.user)
  sendSuccess(res, { message: 'Lấy tổng hợp việc cần làm thành công', data })
}

module.exports = { overview }
