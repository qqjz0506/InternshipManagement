const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const authController = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter')

const router = Router()

router.post('/login', loginLimiter, asyncHandler(authController.login))
router.get('/me', requireAuth, asyncHandler(authController.me))
router.put('/change-password', requireAuth, asyncHandler(authController.changePassword))
router.post('/forgot-password', passwordResetLimiter, asyncHandler(authController.forgotPassword))
router.post('/reset-password', passwordResetLimiter, asyncHandler(authController.resetPassword))
router.put('/email-notifications', requireAuth, asyncHandler(authController.setEmailNotifications))

module.exports = router
