const { pool } = require('../config/database')

function getHealth(req, res) {
  res.json({ success: true, message: 'Backend is running' })
}

async function getDbHealth(req, res) {
  try {
    await pool.query('SELECT 1')
    res.json({ success: true, message: 'Database connection is working' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection failed', error: error.message })
  }
}

module.exports = { getHealth, getDbHealth }
