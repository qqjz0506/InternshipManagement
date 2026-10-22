const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const importController = require('../controllers/importController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')
const { uploadImportFile } = require('../config/importUpload')

const router = Router()

// Toàn bộ nhập danh sách từ Excel chỉ dành cho Admin — kể cả tải file mẫu (không có nhu cầu role khác
// dùng, và mã khoa/định dạng chỉ có ý nghĩa với người thực hiện import).
router.use(requireAuth, requireRole('admin'))

router.get('/templates/students.xlsx', asyncHandler(importController.templateStudents))
router.get('/templates/lecturers.xlsx', asyncHandler(importController.templateLecturers))

router.post('/students/preview', uploadImportFile, asyncHandler(importController.previewStudents))
router.post('/students/commit', uploadImportFile, asyncHandler(importController.commitStudents))
router.post('/lecturers/preview', uploadImportFile, asyncHandler(importController.previewLecturers))
router.post('/lecturers/commit', uploadImportFile, asyncHandler(importController.commitLecturers))

router.get('/accounts-file/:token', asyncHandler(importController.downloadAccountsFile))

module.exports = router
