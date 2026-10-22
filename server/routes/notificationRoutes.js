const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const notificationController = require('../controllers/notificationController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role — nhưng LUÔN bị ép về đúng user_id của chính mình (trừ Admin), không tin query
// param (mục 14 Phase 3B). PUT (mark as read): chủ sở hữu hoặc Admin. POST/DELETE: chỉ Admin
// (không UI nào khác tạo/xóa notification).
router.use(requireAuth)

router.get('/', asyncHandler(notificationController.list))
// '/read-all' phải đăng ký TRƯỚC '/:id' — Express match theo thứ tự đăng ký, nếu đảo ngược thì
// PUT /notifications/read-all sẽ bị '/:id' "nuốt" (hiểu nhầm "read-all" là 1 id).
router.put('/read-all', asyncHandler(notificationController.markAllAsRead))
router.get('/:id', asyncHandler(notificationController.getOne))
router.post('/', requireRole('admin'), asyncHandler(notificationController.create))
router.put('/:id', asyncHandler(notificationController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(notificationController.remove))

module.exports = router
