const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const positionController = require('../controllers/internshipPositionController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role đã đăng nhập (scope tự giới hạn trong internshipPositionService.getAll — Student
// chỉ thấy vị trí 'open', Company Mentor chỉ thấy vị trí công ty mình). POST/PUT: Admin hoặc Company
// Mentor (chỉ công ty mình, enforce ở service — mục IDOR).
router.use(requireAuth)

router.get('/', asyncHandler(positionController.list))
router.get('/:id', asyncHandler(positionController.getOne))
router.post('/', requireRole('admin', 'company_mentor'), asyncHandler(positionController.create))
router.put('/:id', requireRole('admin', 'company_mentor'), asyncHandler(positionController.update))

module.exports = router
