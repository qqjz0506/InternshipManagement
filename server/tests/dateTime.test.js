// Test server/utils/dateTime.js — helper "hôm nay" theo múi giờ APP_TIMEZONE (mặc định
// Asia/Ho_Chi_Minh, UTC+7 không đổi theo DST). Phát hiện trong đợt kiểm tra trước bảo vệ: toàn bộ
// nơi dùng `new Date().toISOString().slice(0, 10)` (log_date tương lai, submitted_at, published_at,
// tên file export) đều lấy theo UTC — sai lệch 1 ngày từ 00:00 đến 06:59 giờ Việt Nam mỗi ngày (UTC
// lúc đó vẫn còn là NGÀY HÔM TRƯỚC). Test này verify helper thay thế tính đúng, không cần mock global
// Date cho test đơn vị thuần (truyền `now` tường minh) — có 1 test riêng verify path mock global Date
// (tham số `now` mặc định) cũng hoạt động đúng, vì 4 nơi gọi thực tế (log_date/submitted_at/
// published_at/tên file export) đều gọi `todayDateString()` KHÔNG truyền tham số.
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { todayDateString, getAppTimezone } = require('../utils/dateTime')

test('todayDateString: 01:00 sáng giờ Việt Nam vẫn là NGÀY ĐÓ, không bị lùi về ngày UTC hôm trước', () => {
  // 01:00 ICT ngày 21/10/2026 = 18:00 UTC ngày 20/10/2026 (ICT = UTC+7, không đổi theo DST).
  const oneAmVietnam = new Date('2026-10-20T18:00:00.000Z')
  const buggyUtcDate = oneAmVietnam.toISOString().slice(0, 10) // cách cũ, cho kết quả SAI
  assert.equal(buggyUtcDate, '2026-10-20', 'Xác nhận đúng cách cũ (UTC) sẽ cho ra ngày SAI')
  assert.equal(todayDateString(oneAmVietnam), '2026-10-21', 'Helper mới phải trả đúng ngày theo giờ Việt Nam')
})

test('todayDateString: ranh giới nửa đêm giờ Việt Nam — 23:59 và 00:00 hôm sau phải khác ngày', () => {
  const beforeMidnightVN = new Date('2026-10-20T16:59:00.000Z') // 23:59 VN ngày 20/10
  const afterMidnightVN = new Date('2026-10-20T17:00:00.000Z') // 00:00 VN ngày 21/10
  assert.equal(todayDateString(beforeMidnightVN), '2026-10-20')
  assert.equal(todayDateString(afterMidnightVN), '2026-10-21')
})

test('todayDateString: không truyền `now` -> dùng Date hệ thống hiện tại (mock global clock ở đúng mốc 01:00 VN)', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T18:00:00.000Z') })
  try {
    assert.equal(todayDateString(), '2026-10-21', 'Cả 4 nơi gọi thật (log_date/submitted_at/published_at/export) đều gọi không tham số')
  } finally {
    t.mock.timers.reset()
  }
})

test('getAppTimezone: đọc từ APP_TIMEZONE, mặc định Asia/Ho_Chi_Minh nếu chưa set', () => {
  const original = process.env.APP_TIMEZONE
  try {
    delete process.env.APP_TIMEZONE
    assert.equal(getAppTimezone(), 'Asia/Ho_Chi_Minh')

    process.env.APP_TIMEZONE = 'UTC'
    assert.equal(getAppTimezone(), 'UTC')
    // Đổi timezone qua env phải thực sự đổi kết quả tính "hôm nay" (không hardcode Asia/Ho_Chi_Minh).
    const oneAmVietnam = new Date('2026-10-20T18:00:00.000Z')
    assert.equal(todayDateString(oneAmVietnam), '2026-10-20', 'Với APP_TIMEZONE=UTC phải trả đúng ngày UTC')
  } finally {
    if (original === undefined) {
      delete process.env.APP_TIMEZONE
    } else {
      process.env.APP_TIMEZONE = original
    }
  }
})
