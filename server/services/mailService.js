const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

// server/logs/ — KHÔNG commit vào git (xem .gitignore), tự tạo lại ở đây nếu chưa có.
const OUTBOX_PATH = path.join(__dirname, '..', 'logs', 'mail-outbox.log')

let cachedTransporter = null

// Chỉ gửi email THẬT khi MAIL_ENABLED='true' VÀ không phải NODE_ENV=test — test suite KHÔNG được
// gọi SMTP thật (chậm, không deterministic, phụ thuộc mạng/tài khoản ngoài). Đọc lại mỗi lần gọi
// (không cache ra module scope) để test đổi process.env.MAIL_ENABLED giữa các case được.
function shouldSendReal() {
  return process.env.MAIL_ENABLED === 'true' && process.env.NODE_ENV !== 'test'
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return cachedTransporter
}

// Ghi 1 dòng JSON vào server/logs/mail-outbox.log — dùng khi demo/test (không gửi SMTP thật), để
// Admin/tester vẫn "nhận" được nội dung email (vd. link reset mật khẩu) mà không cần SMTP server
// thật. GHI ĐỒNG BỘ (appendFileSync) dù sendMail() không bị await ở notificationService.notify() —
// để file đã có dữ liệu NGAY khi notify() gọi xong (test đọc được liền, không cần sleep/poll).
function writeToOutbox(entry) {
  try {
    fs.mkdirSync(path.dirname(OUTBOX_PATH), { recursive: true })
    fs.appendFileSync(OUTBOX_PATH, `${JSON.stringify(entry)}\n`)
  } catch (error) {
    console.error('mailService: ghi outbox thất bại (không làm fail nghiệp vụ chính):', error)
  }
}

// sendMail() không được throw ra ngoài — lỗi gửi mail (SMTP sai cấu hình, mất mạng...) chỉ log, đúng
// nguyên tắc "thông báo tự động không có retry/hàng đợi" đã áp dụng cho notificationService.notify().
// Trả về Promise để caller có thể fire-and-forget (không await) nhất quán — nhưng nhánh outbox ghi
// ĐỒNG BỘ bên trong trước khi resolve, nên dữ liệu đã nằm trên đĩa dù caller không await.
function sendMail({ to, subject, html, text }) {
  const entry = { to, subject, html, text, sentAt: new Date().toISOString() }

  if (!shouldSendReal()) {
    writeToOutbox(entry)
    return Promise.resolve()
  }

  return getTransporter()
    .sendMail({ from: process.env.MAIL_FROM, to, subject, html, text })
    .catch((error) => {
      console.error('mailService: gửi email thất bại (không làm fail nghiệp vụ chính):', error)
    })
}

module.exports = { sendMail, OUTBOX_PATH }
