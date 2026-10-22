const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const departmentController = require('../controllers/departmentController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Dữ liệu tham chiếu (Khoa/Bộ môn) — mọi role đã đăng nhập đều cần đọc được (Student chọn khoa khi
// xem hồ sơ, v.v.), chỉ Admin được ghi.
router.use(requireAuth)

router.get('/', asyncHandler(departmentController.list))
router.get('/:id', asyncHandler(departmentController.getOne))
router.post('/', requireRole('admin'), asyncHandler(departmentController.create))
router.put('/:id', requireRole('admin'), asyncHandler(departmentController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(departmentController.remove))

module.exports = router
