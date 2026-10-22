class AppError extends Error {
  // code: mã lỗi machine-readable TÙY CHỌN (ví dụ "MUST_CHANGE_PASSWORD") — dùng khi client cần phân
  // biệt CHÍNH XÁC loại lỗi 403/400 để tự quyết định hành động (ví dụ tự điều hướng), thay vì chỉ dựa
  // vào statusCode (không đủ để phân biệt nhiều loại 403 khác nhau) hoặc so khớp message tiếng Việt
  // (dễ vỡ nếu đổi câu chữ). Phần lớn AppError KHÔNG cần code — chỉ thêm khi thực sự có nhu cầu này.
  constructor(statusCode, message, code) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

module.exports = AppError
