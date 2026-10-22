const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const statisticsController = require('../controllers/statisticsController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Chỉ Admin — AdminStatisticsPage.jsx là trang duy nhất dùng API này (đúng yêu cầu trực tiếp của
// người dùng: "Thêm API GET /api/statistics/summary (admin)").
router.use(requireAuth)

router.get('/summary', requireRole('admin'), asyncHandler(statisticsController.getSummary))

module.exports = router
