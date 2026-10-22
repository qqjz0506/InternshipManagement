const AppError = require('../utils/AppError')

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Không tìm thấy route.', error: `${req.method} ${req.originalUrl}` })
}

// Phase 7A (F-03): mặc định PHẢI an toàn kể cả khi chưa set biến môi trường nào — không dựa vào
// NODE_ENV==='production' (dễ quên set, và môi trường dev/demo local không bao giờ set biến này,
// nên trước đây stack trace LUÔN bị lộ trên máy dev). Debug chỉ bật khi có cờ tường minh
// DEBUG_ERRORS=true trong .env — không bật theo bất kỳ giá trị mặc định nào.
//
// Message hiển thị cho client: nếu là AppError (lỗi nghiệp vụ có chủ đích — validate, 401/403/404/
// 409...) thì giữ NGUYÊN message hiện có (đây là message tiếng Việt do chính code viết, frontend đã
// phụ thuộc vào đúng các message này — không đổi). Nếu là lỗi KHÔNG lường trước (bug/exception thật,
// luôn là 500) thì KHÔNG lộ message gốc (có thể chứa chi tiết SQL/driver nội bộ) trừ khi
// DEBUG_ERRORS=true — client chỉ thấy thông báo chung, log đầy đủ vẫn được ghi ở server qua
// console.error (không log password/JWT/secret — console.error(err) ở đây không đi qua bất kỳ field
// nào trong số đó, AppError/exception thông thường không mang theo credential).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err)

  const debugEnabled = process.env.DEBUG_ERRORS === 'true'
  const isKnownError = err instanceof AppError
  const statusCode = err.statusCode || 500
  const message = isKnownError || debugEnabled ? err.message : 'Đã xảy ra lỗi máy chủ.'

  res.status(statusCode).json({
    success: false,
    message,
    code: isKnownError ? err.code : undefined,
    error: debugEnabled ? err.stack : undefined,
  })
}

module.exports = { notFoundHandler, errorHandler }
