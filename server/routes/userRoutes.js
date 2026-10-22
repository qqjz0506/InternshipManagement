const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const userController = require('../controllers/userController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Admin-only tuyệt đối, không ngoại lệ (đã chốt Phase 4F-1 mục 0/5) — không có GET /me riêng,
// /api/auth/me vẫn là nguồn duy nhất cho tài khoản đang đăng nhập.
router.use(requireAuth, requireRole('admin'))

router.get('/', asyncHandler(userController.list))
router.get('/:id', asyncHandler(userController.getOne))
router.post('/', asyncHandler(userController.create))
router.put('/:id', asyncHandler(userController.update))
router.put('/:id/reset-password', asyncHandler(userController.resetPassword))
router.put('/:id/status', asyncHandler(userController.setStatus))

module.exports = router
