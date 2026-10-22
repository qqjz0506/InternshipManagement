const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const evaluationController = require('../controllers/evaluationController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role (Student chỉ thấy published của chính mình; Lecturer/Company Mentor chỉ thấy đúng
// evaluator_role + internship mình phụ trách — service enforce). POST/PUT: Admin/Lecturer/Company
// Mentor (Student không có UI tạo/sửa đánh giá). DELETE: chỉ Admin.
router.use(requireAuth)

router.get('/', asyncHandler(evaluationController.list))
router.get('/:id', asyncHandler(evaluationController.getOne))
router.post('/', requireRole('admin', 'lecturer', 'company_mentor'), asyncHandler(evaluationController.create))
router.put('/:id', requireRole('admin', 'lecturer', 'company_mentor'), asyncHandler(evaluationController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(evaluationController.remove))

module.exports = router
