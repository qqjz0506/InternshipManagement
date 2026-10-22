const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const AppError = require('../utils/AppError')

// server/uploads/reports/ — KHÔNG commit vào git (xem .gitignore), tự tạo lại ở đây nếu chưa có
// (không dựa vào .gitkeep/git để giữ thư mục rỗng).
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'reports')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Tên file trên đĩa LUÔN là crypto.randomUUID() + đúng phần mở rộng — KHÔNG BAO GIỜ dùng
  // originalname để đặt tên/đường dẫn file thật (path traversal, ký tự đặc biệt, trùng tên). Tên gốc
  // CHỈ lưu riêng ở reports.file_name để hiển thị, không liên quan gì tới đường dẫn vật lý.
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

// Kiểm tra CẢ phần mở rộng VÀ mimetype — 1 trong 2 sai cũng reject (mimetype client gửi có thể giả
// mạo, nhưng vẫn kiểm tra cả 2 cho chắc, không chỉ dựa vào đúng 1 tín hiệu).
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new AppError(400, 'Chỉ chấp nhận file .pdf, .doc, .docx.'))
    return
  }
  cb(null, true)
}

// defParamCharset: 'utf8' — busboy (dùng trong multer) mặc định decode filename/field name multipart
// bằng latin1 (đúng chuẩn RFC 7578 cũ, nhưng hầu hết trình duyệt hiện đại gửi UTF-8 thật) — không set
// sẽ làm tên file tiếng Việt có dấu bị mojibake (ví dụ "Báo cáo..." thành "BÃ¡o cÃ¡o...") khi lưu vào
// `reports.file_name`. Không ảnh hưởng tên file TRÊN ĐĨA (luôn là `crypto.randomUUID()`, xem filename
// ở trên) — chỉ ảnh hưởng `file.originalname` mà multer đọc được.
const multerUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE }, defParamCharset: 'utf8' })

// Wrap middleware thật của multer để chuẩn hóa MỌI lỗi (sai định dạng từ fileFilter, vượt dung
// lượng từ limits.fileSize...) thành đúng 1 AppError 400 tiếng Việt nhất quán với convention lỗi
// toàn dự án. Multer tự `next()` êm (bỏ qua, không đụng gì tới req.body/req.file) nếu request KHÔNG
// phải multipart/form-data — nên gắn middleware này an toàn vào route PUT dùng chung bởi nhiều role
// (Lecturer/Company/Admin gửi JSON thường để duyệt/nhận xét, chỉ Student resubmit mới gửi multipart).
function uploadReportFile(req, res, next) {
  multerUpload.single('file')(req, res, (err) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File vượt quá dung lượng cho phép (tối đa 10MB).'))
      return
    }
    next(err)
  })
}

// Xóa file trên đĩa — dùng khi: (1) validate/business rule fail SAU KHI multer đã lưu file tạm,
// (2) nộp lại báo cáo thay file cũ bằng file mới, (3) xóa report thì xóa luôn file đính kèm. Lỗi
// (vd. file đã bị xóa trước đó — ENOENT) chỉ log, không throw — không để lỗi dọn file làm fail
// nghiệp vụ chính đã/đang xử lý.
async function deleteStoredFile(storedFileName) {
  if (!storedFileName) {
    return
  }
  const absolutePath = path.join(UPLOAD_DIR, storedFileName)
  try {
    await fs.promises.unlink(absolutePath)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('deleteStoredFile() thất bại:', error)
    }
  }
}

module.exports = { UPLOAD_DIR, uploadReportFile, deleteStoredFile, ALLOWED_EXTENSIONS, MAX_FILE_SIZE }
