const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const companyController = require('../controllers/companyController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// Doanh nghiệp — Student cần đọc toàn bộ danh sách để chọn/đề xuất (StudentProposeCompanyModal),
// nên GET mở cho mọi role đã đăng nhập. Chỉ Admin được ghi.
router.use(requireAuth)

router.get('/', asyncHandler(companyController.list))
router.get('/:id', asyncHandler(companyController.getOne))
router.post('/', requireRole('admin'), asyncHandler(companyController.create))
router.put('/:id', requireRole('admin'), asyncHandler(companyController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(companyController.remove))

module.exports = router
