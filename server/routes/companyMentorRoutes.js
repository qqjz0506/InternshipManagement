const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const companyMentorController = require('../controllers/companyMentorController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')

const router = Router()

// GET: mọi role (scoping trong service — Company Mentor chỉ thấy chính mình, Student/Lecturer chỉ
// thấy mentor gắn với internship của mình). Ghi: chỉ Admin (CompanyProfilePage.jsx read-only).
router.use(requireAuth)

router.get('/', asyncHandler(companyMentorController.list))
router.get('/:id', asyncHandler(companyMentorController.getOne))
router.post('/', requireRole('admin'), asyncHandler(companyMentorController.create))
router.put('/:id', requireRole('admin'), asyncHandler(companyMentorController.update))
router.delete('/:id', requireRole('admin'), asyncHandler(companyMentorController.remove))

module.exports = router
