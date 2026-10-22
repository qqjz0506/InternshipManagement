const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const topicController = require('../controllers/topicController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Ngân hàng đề tài — mọi role đọc được. Tạo mới: Admin (toàn quyền) hoặc Student (chỉ đề xuất cho
// chính mình — xem topicController.create). Sửa: Admin (toàn quyền) hoặc Lecturer (CHỈ được đổi
// `status` thành approved/rejected cho đề tài thuộc đúng scope hướng dẫn của mình — xem
// topicService.update, mục "Lecturer Topic Approval" trong docs/API_PHASE_4B_4.md). Xóa: chỉ Admin.
router.use(requireAuth)

router.get('/', asyncHandler(topicController.list))
router.get('/:id', asyncHandler(topicController.getOne))
router.post('/', requireRole('admin', 'student'), asyncHandler(topicController.create))
router.put('/:id', requireRole('admin', 'lecturer'), asyncHandler(topicController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(topicController.remove))

module.exports = router
