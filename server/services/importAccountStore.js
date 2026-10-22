const crypto = require('crypto')

// Lưu TẠM file Excel chứa mật khẩu tạm (plaintext) trong bộ nhớ process — KHÔNG ghi ra đĩa, KHÔNG
// ghi vào DB. Admin phải tải trong vòng TTL, và chỉ tải được ĐÚNG 1 LẦN (pop xoá khỏi store ngay khi
// lấy) — đúng yêu cầu "chỉ trả 1 lần, không lưu plaintext". Nếu Admin không tải kịp, phải nhập lại
// (an toàn hơn giữ mãi mật khẩu tạm trong bộ nhớ).
const TTL_MS = 5 * 60 * 1000

const store = new Map()

function put(buffer) {
  const token = crypto.randomUUID()
  const timer = setTimeout(() => store.delete(token), TTL_MS)
  store.set(token, { buffer, timer })
  return token
}

function pop(token) {
  const entry = store.get(token)
  if (!entry) {
    return null
  }
  clearTimeout(entry.timer)
  store.delete(token)
  return entry.buffer
}

module.exports = { put, pop }
