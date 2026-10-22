const fs = require('fs')
const { OUTBOX_PATH } = require('../../services/mailService')

// Đọc toàn bộ outbox hiện có (có thể chưa tồn tại nếu chưa file test nào gửi email) — trả về mảng
// entry đã parse, dùng để so sánh "trước/sau" 1 hành động (đếm dòng trước, slice phần mới sau).
function readOutboxEntries() {
  if (!fs.existsSync(OUTBOX_PATH)) {
    return []
  }
  const content = fs.readFileSync(OUTBOX_PATH, 'utf8')
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
}

module.exports = { readOutboxEntries }
