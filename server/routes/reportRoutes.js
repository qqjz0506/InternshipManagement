const { Router } = require('express')
const asyncHandler = require('../utils/asyncHandler')
const reportController = require('../controllers/reportController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/authorizationMiddleware')
const { uploadReportFile } = require('../config/upload')

const router = Router()

// GET: mọi role (scope theo Internship cha). GET /:id/download: tải file thật, cùng scope với GET
// /:id (xem reportController.download) — đăng ký TRƯỚC '/:id' không quan trọng ở đây vì khác pattern
// (/:id/download có 2 segment, /:id có 1), Express phân biệt được, không bị '/:id' "nuốt".
// POST: Admin + Student (tự nộp cho hồ sơ của mình) — multipart/form-data, field "file" bắt buộc.
// PUT: Admin/Lecturer/Company Mentor theo field riêng (service enforce). Student CÓ PUT (rule: nộp
// lại báo cáo của chính mình khi đang 'rejected', bắt buộc kèm file mới) — mọi ràng buộc khác enforce
// ở reportService.update(). uploadReportFile tự no-op (next() êm) nếu request không phải multipart,
// nên gắn an toàn vào PUT dùng chung bởi cả role gửi JSON (Lecturer/Company/Admin).
// DELETE: chỉ Admin (không UI nào khác cho phép xóa) — xóa kèm file vật lý.
router.use(requireAuth)

router.get('/', asyncHandler(reportController.list))
router.get('/:id/download', asyncHandler(reportController.download))
router.get('/:id', asyncHandler(reportController.getOne))
router.post('/', requireRole('admin', 'student'), uploadReportFile, asyncHandler(reportController.create))
router.put(
  '/:id',
  requireRole('admin', 'lecturer', 'company_mentor', 'student'),
  uploadReportFile,
  asyncHandler(reportController.update),
)
router.delete('/:id', requireRole('admin'), asyncHandler(reportController.remove))

module.exports = router
