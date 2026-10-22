const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const internshipLogController = require('../controllers/internshipLogController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role (scope theo Internship cha — service tự lọc). POST/DELETE: Admin + Student (tự ghi/
// xóa log của chính mình). PUT: mọi role đã đăng nhập — field được sửa phụ thuộc role, enforce trong
// service (Student: nội dung; Lecturer: lecturer_comment+status; Company Mentor: company_comment).
router.use(requireAuth)

router.get('/', asyncHandler(internshipLogController.list))
router.get('/:id', asyncHandler(internshipLogController.getOne))
router.post('/', requireRole('admin', 'student'), asyncHandler(internshipLogController.create))
router.put('/:id', asyncHandler(internshipLogController.update))
router.delete('/:id', requireRole('admin', 'student'), asyncHandler(internshipLogController.remove))

module.exports = router
