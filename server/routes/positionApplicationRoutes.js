const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const applicationController = require('../controllers/positionApplicationController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role đã đăng nhập (scope tự giới hạn trong positionApplicationService.getAll). POST
// (ứng tuyển)/DELETE-equivalent (rút đơn): chỉ Student. accept/reject: Admin hoặc Company Mentor.
router.use(requireAuth)

router.get('/', asyncHandler(applicationController.list))
router.post('/', requireRole('student'), asyncHandler(applicationController.apply))
router.put('/:id/withdraw', requireRole('student'), asyncHandler(applicationController.withdraw))
router.put('/:id/reject', requireRole('admin', 'company_mentor'), asyncHandler(applicationController.reject))
router.put('/:id/accept', requireRole('admin', 'company_mentor'), asyncHandler(applicationController.accept))

module.exports = router
