const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

// Đọc mỗi lần gọi (không cache ở module scope) — cho phép test đổi process.env.APP_TIMEZONE giữa các
// test case mà không phải reload module.
function getAppTimezone() {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
}

// "Hôm nay" (YYYY-MM-DD) theo múi giờ APP_TIMEZONE — helper DUY NHẤT dùng chung cho mọi nơi cần
// "ngày hôm nay" ở business logic (log_date không được ở tương lai, submitted_at, published_at,
// tên file export...). THAY cho `new Date().toISOString().slice(0, 10)` (lấy theo UTC) — bug thật:
// từ 00:00 đến 06:59 giờ Việt Nam (UTC+7, không đổi theo DST), UTC vẫn còn là NGÀY HÔM TRƯỚC, nên
// cách cũ trả sai ngày đúng trong dải giờ đó mỗi ngày. `now` nhận vào để test dễ mock 1 thời điểm cụ
// thể (không cần mock global Date cho test đơn vị thuần, xem dateTime.test.js).
function todayDateString(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

module.exports = { getAppTimezone, todayDateString, DEFAULT_TIMEZONE }
