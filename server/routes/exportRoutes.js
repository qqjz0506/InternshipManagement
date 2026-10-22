const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const exportController = require('../controllers/exportController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = Router()

// Không requireRole() riêng — đúng convention GET /internships, GET /evaluations hiện có (mọi role
// đã đăng nhập được gọi, scope tự giới hạn dữ liệu trong service — mục 6/7 Phase 5). Admin thấy toàn
// bộ phạm vi; Student/Lecturer/Company Mentor chỉ thấy đúng phạm vi internship của mình, và với
// evaluations, Student chỉ thấy bản đã công bố (is_published=1) — mirror ĐÚNG scope của
// internshipService.getAll()/evaluationService.getAll(), không tạo luật mới.
router.use(requireAuth)

router.get('/internships.xlsx', asyncHandler(exportController.exportInternships))
router.get('/evaluations.xlsx', asyncHandler(exportController.exportEvaluations))

module.exports = router
