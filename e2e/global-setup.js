const path = require('path')
const { execFileSync } = require('child_process')

// Luôn chạy test:e2e trên DB TEST SẠCH (schema.sql + seed.sql, giống tests/helpers/testServer.js
// cho backend test) — gọi lại đúng script đã có (server/db/testSetup.js) thay vì tự viết logic
// tạo DB riêng cho e2e.
module.exports = async function globalSetup() {
  const serverDir = path.join(__dirname, '..', 'server')
  execFileSync('node', ['db/testSetup.js'], { cwd: serverDir, stdio: 'inherit' })
}
