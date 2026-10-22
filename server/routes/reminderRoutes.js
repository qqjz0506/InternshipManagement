const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const reminderController = require('../controllers/reminderController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = Router()

// Mọi role đã đăng nhập đều gọi được — scope tự giới hạn trong reminderService.getOverview() theo
// đúng role (Student: chính mình; Lecturer/Company Mentor: SV mình phụ trách; Admin: tổng hợp toàn
// đợt) — cùng convention GET /internships, GET /exports hiện có (không requireRole riêng).
router.use(requireAuth)

router.get('/overview', asyncHandler(reminderController.overview))

module.exports = router
