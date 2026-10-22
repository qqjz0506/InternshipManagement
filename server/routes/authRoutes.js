const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const authController = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')
const { loginLimiter } = require('../middleware/rateLimiter')

const router = Router()

router.post('/login', loginLimiter, asyncHandler(authController.login))
router.get('/me', requireAuth, asyncHandler(authController.me))
router.put('/change-password', requireAuth, asyncHandler(authController.changePassword))

module.exports = router
