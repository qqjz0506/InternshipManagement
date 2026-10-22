const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const settingsController = require('../controllers/settingsController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role đã đăng nhập (Student cần đọc allowStudentRegistration/defaultInternshipPeriodId
// để render luồng đăng ký — StudentInternshipPage.jsx). PUT: chỉ Admin.
router.use(requireAuth)

router.get('/', asyncHandler(settingsController.get))
router.put('/', requireRole('admin'), asyncHandler(settingsController.update))

module.exports = router
