const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const internshipPeriodController = require('../controllers/internshipPeriodController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Dữ liệu tham chiếu (Đợt thực tập) — Student cần đọc để đăng ký, chỉ Admin được ghi.
router.use(requireAuth)

router.get('/', asyncHandler(internshipPeriodController.list))
router.get('/:id', asyncHandler(internshipPeriodController.getOne))
router.post('/', requireRole('admin'), asyncHandler(internshipPeriodController.create))
router.put('/:id', requireRole('admin'), asyncHandler(internshipPeriodController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(internshipPeriodController.remove))

module.exports = router
