const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const DIST_DIR = path.join(__dirname, '..', '..', 'client', 'dist')
const INDEX_PATH = path.join(DIST_DIR, 'index.html')
const APP_PATH = require.resolve('../app')

let server
let baseUrl
let createdDist = false
const originalNodeEnv = process.env.NODE_ENV

// Chỉ test logic "app.js tự phục vụ client/dist khi NODE_ENV=production" — KHÔNG phụ thuộc việc
// `cd client && npm run build` đã chạy trước đó hay chưa trong CHÍNH lần `npm test` này (thứ tự các
// bước kiểm tra theo quy ước không đảm bảo client build trước server test): nếu client/dist chưa có
// sẵn, tự tạo 1 index.html tối giản để test, rồi XÓA LẠI đúng những gì mình tạo ra (không đụng build
// thật nếu đã tồn tại từ trước).
test.before(() => {
  if (!fs.existsSync(INDEX_PATH)) {
    fs.mkdirSync(DIST_DIR, { recursive: true })
    fs.writeFileSync(INDEX_PATH, '<!doctype html><html><body>spa-fallback-test</body></html>')
    createdDist = true
  }

  // app.js đọc process.env.NODE_ENV NGAY LÚC require (không phải lúc gọi lại sau) — phải set trước,
  // xóa cache, rồi require lại để lấy đúng instance đã build với NODE_ENV='production'.
  process.env.NODE_ENV = 'production'
  delete require.cache[APP_PATH]
  const prodApp = require('../app')

  return new Promise((resolve, reject) => {
    server = prodApp.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
    server.on('error', reject)
  })
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
  process.env.NODE_ENV = originalNodeEnv
  delete require.cache[APP_PATH]
  require('../app') // nạp lại đúng bản NODE_ENV cũ cho các test file khác chạy SAU trong cùng process

  if (createdDist) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true })
  }
})

test('production: route client-side bất kỳ (không phải /api) -> trả về index.html (SPA fallback)', async () => {
  const res = await fetch(`${baseUrl}/admin/dashboard`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/html/)
})

test('production: /api/* không khớp route nào -> vẫn 404 JSON như cũ (fallback KHÔNG "ăn" mất)', async () => {
  const res = await fetch(`${baseUrl}/api/khong-ton-tai-abc123`)
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.success, false)
})

test('production: /api/health vẫn hoạt động bình thường (route API thật không bị static/fallback che)', async () => {
  const res = await fetch(`${baseUrl}/api/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
})
