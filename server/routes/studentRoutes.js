const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const studentController = require('../controllers/studentController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role đã đăng nhập (data-level scoping nằm trong studentController/studentService —
// Admin thấy tất cả, Student chỉ thấy chính mình, Lecturer/Company Mentor chỉ thấy SV mình phụ trách).
// POST/DELETE: chỉ Admin. PUT: Admin (toàn quyền) hoặc Student (tự sửa field liên hệ của chính mình).
router.use(requireAuth)

router.get('/', asyncHandler(studentController.list))
router.get('/:id', asyncHandler(studentController.getOne))
router.post('/', requireRole('admin'), asyncHandler(studentController.create))
router.put('/:id', requireRole('admin', 'student'), asyncHandler(studentController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(studentController.remove))

module.exports = router
