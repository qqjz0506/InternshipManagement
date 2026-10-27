// Test notificationService.notify() KHÔNG chặn request khi gửi email THẬT (mailService.
// shouldSendReal()=true) — SMTP server chậm/treo không được làm chậm response. Vì NODE_ENV=test
// luôn ép shouldSendReal()=false (an toàn, tránh test suite vô tình gọi SMTP thật), test này gán đè
// trực tiếp 2 hàm export của mailService (cùng object module.exports mà notificationService.js
// đang giữ tham chiếu) rồi khôi phục lại ở test.after — không dùng mocking framework nào, chỉ gán
// lại function trên module đã require (cùng kiểu "ghi đè rồi khôi phục" đã dùng cho process.env ở
// server/tests/productionStaticServing.test.js).
const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const mailService = require('../services/mailService')

let server
let tokens
const originalSendMail = mailService.sendMail
const originalShouldSendReal = mailService.shouldSendReal

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentD'])
})

test.after(async () => {
  mailService.sendMail = originalSendMail
  mailService.shouldSendReal = originalShouldSendReal
  await server.close()
})

test('notify(): "gửi email thật" chậm (mock 2s) -> API vẫn trả về nhanh, không chờ gửi xong', async () => {
  let mailResolved = false
  mailService.shouldSendReal = () => true
  mailService.sendMail = () =>
    new Promise((resolve) => {
      setTimeout(() => {
        mailResolved = true
        resolve()
      }, 2000)
    })

  const start = Date.now()
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.studentD.token,
    body: { period_id: 2 },
  })
  const elapsedMs = Date.now() - start

  try {
    assert.equal(create.status, 201)
    assert.ok(elapsedMs < 500, `API phải trả về dưới 500ms (không chờ gửi email thật), thực tế ${elapsedMs}ms`)
    assert.equal(mailResolved, false, 'Lúc response trả về, mock gửi email (2s) CHƯA xong — xác nhận notify() không await')
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/internships/${create.body.data.id}`, { token: tokens.admin.token })
  }
})
