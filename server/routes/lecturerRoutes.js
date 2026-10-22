const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const lecturerController = require('../controllers/lecturerController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role (data-level scoping trong service — Lecturer chỉ thấy chính mình, Student/Company
// Mentor chỉ thấy lecturer gắn với internship của mình). Ghi: chỉ Admin — Lecturer KHÔNG có quyền tự
// sửa profile (LecturerProfilePage.jsx là read-only, không tạo PUT self-edit mà Frontend chưa có).
router.use(requireAuth)

router.get('/', asyncHandler(lecturerController.list))
router.get('/:id', asyncHandler(lecturerController.getOne))
router.post('/', requireRole('admin'), asyncHandler(lecturerController.create))
router.put('/:id', requireRole('admin'), asyncHandler(lecturerController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(lecturerController.remove))

module.exports = router
