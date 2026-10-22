const multer = require('multer')
const AppError = require('../utils/AppError')

// Nhập danh sách Sinh viên/Giảng viên từ Excel — upload riêng, KHÔNG dùng chung config/upload.js
// (dành cho báo cáo .pdf/.doc/.docx, 10MB). Giới hạn ở đây nhỏ hơn nhiều (2MB) vì chỉ chứa dữ liệu
// text, không phải tài liệu đính kèm.
const ALLOWED_EXTENSIONS = ['.xlsx']
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Một số trình duyệt/OS gửi mimetype generic cho .xlsx — vẫn chấp nhận nếu đúng phần mở rộng
  // (fileFilter check CẢ 2, nhưng để lọt mimetype generic này tránh false-negative vô lý).
  'application/octet-stream',
]
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new AppError(400, 'Chỉ chấp nhận file .xlsx.'))
    return
  }
  cb(null, true)
}

// Lưu ở memory (không ghi ra đĩa) — file chỉ cần đọc bằng exceljs 1 lần rồi bỏ, không cần lưu lâu dài
// như report (không có nhu cầu tải lại file gốc đã nhập sau này).
const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
  defParamCharset: 'utf8',
})

function uploadImportFile(req, res, next) {
  multerUpload.single('file')(req, res, (err) => {
    if (!err) {
      if (!req.file) {
        next(new AppError(400, 'Vui lòng chọn file .xlsx để nhập.'))
        return
      }
      next()
      return
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File vượt quá dung lượng cho phép (tối đa 2MB).'))
      return
    }
    next(err)
  })
}

module.exports = { uploadImportFile, MAX_FILE_SIZE }
