const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const internshipController = require('../controllers/internshipController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role (scoping trong service — Admin thấy tất cả, Student/Lecturer/Company Mentor chỉ
// thấy đúng phạm vi của mình qua student_id/lecturer_id/company_mentor_id).
// POST: Admin hoặc Student (tự đăng ký, student_id luôn bị ép về chính mình).
// PUT: Admin (toàn quyền) hoặc Student (chỉ hồ sơ của mình, field/status hạn chế — xem service).
// DELETE: chỉ Admin (không UI nào khác cho phép xóa, và có status-gate riêng).
router.use(requireAuth)

router.get('/', asyncHandler(internshipController.list))
router.get('/:id', asyncHandler(internshipController.getOne))
router.get('/:id/final-result', asyncHandler(internshipController.getFinalResult))
router.post('/', requireRole('admin', 'student'), asyncHandler(internshipController.create))
router.put('/:id', requireRole('admin', 'student'), asyncHandler(internshipController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(internshipController.remove))

module.exports = router
