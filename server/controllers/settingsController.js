const settingsService = require('../services/settingsService')
const { sendSuccess } = require('../utils/response')

async function get(req, res) {
  const settings = await settingsService.get()
  sendSuccess(res, { message: 'Settings retrieved successfully', data: settings })
}

async function update(req, res) {
  const settings = await settingsService.update(req.body)
  sendSuccess(res, { message: 'Settings updated successfully', data: settings })
}

module.exports = { get, update }
