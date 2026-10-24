// Kiểm tra cấu hình an toàn cho môi trường production — tách thành hàm THUẦN (nhận env, trả về
// danh sách lỗi, KHÔNG tự process.exit) để test được bằng cách gọi trực tiếp với env giả, không cần
// khởi động/giết process thật. server.js gọi assertProductionConfig() và tự quyết định exit.
function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') {
    return []
  }

  const errors = []

  // JWT_SECRET quá ngắn/thiếu = token dễ bị brute-force giải mã chữ ký — 32 ký tự là mức tối thiểu
  // hợp lý cho HS256 (tương đương 256-bit nếu dùng ký tự ngẫu nhiên đủ entropy).
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET phải được set và có tối thiểu 32 ký tự trong môi trường production.')
  }

  // CLIENT_URL dùng làm origin CORS duy nhất (xem app.js) — thiếu thì cors() sẽ chặn TẤT CẢ origin
  // (an toàn nhưng chắc chắn không phải ý định thật, nên coi là lỗi cấu hình cần sửa trước khi chạy).
  if (!env.CLIENT_URL) {
    errors.push('CLIENT_URL phải được set trong môi trường production (dùng làm origin CORS duy nhất).')
  }

  // DEBUG_ERRORS=true lộ message gốc + stack trace của lỗi không lường trước (xem errorHandler.js) —
  // chỉ dành cho debug thủ công trên máy dev, không bao giờ được bật ở production.
  if (env.DEBUG_ERRORS === 'true') {
    errors.push('DEBUG_ERRORS không được bật ("true") trong môi trường production — có thể lộ stack trace/thông tin nội bộ.')
  }

  return errors
}

function assertProductionConfig(env = process.env) {
  const errors = validateProductionConfig(env)
  if (errors.length > 0) {
    throw new Error(`Cấu hình production không an toàn:\n${errors.map((message) => `  - ${message}`).join('\n')}`)
  }
}

module.exports = { validateProductionConfig, assertProductionConfig }
