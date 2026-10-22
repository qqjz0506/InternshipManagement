const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { SEED_ACCOUNTS } = require('./helpers/auth')

let server

test.before(async () => {
  server = await startTestServer()
})

test.after(async () => {
  await server.close()
})

test('A1. Valid login returns token + safe user object (no password/password_hash)', async () => {
  const { status, body } = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: SEED_ACCOUNTS.admin,
  })
  assert.equal(status, 200)
  assert.ok(body.data.accessToken, 'accessToken phải tồn tại')
  assert.equal(body.data.user.role, 'admin')
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes('password_hash'), 'response không được chứa password_hash')
  assert.ok(!('password' in body.data.user), 'response user object không được chứa password')
})

test('A2. Wrong password -> 401', async () => {
  const { status } = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: SEED_ACCOUNTS.admin.email, password: 'wrong-password-xyz' },
  })
  assert.equal(status, 401)
})

test('A3. Unknown email -> 401', async () => {
  const { status } = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'does-not-exist@example.com', password: 'whatever123' },
  })
  assert.equal(status, 401)
})

test('A4. Missing credentials -> 400', async () => {
  const { status } = await apiRequest(server.baseUrl, 'POST', '/auth/login', { body: {} })
  assert.equal(status, 400)
})

test('A5. GET /auth/me: valid token 200, invalid token 401, no token 401', async () => {
  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', { body: SEED_ACCOUNTS.admin })
  const token = login.body.data.accessToken

  const valid = await apiRequest(server.baseUrl, 'GET', '/auth/me', { token })
  assert.equal(valid.status, 200)
  assert.equal(valid.body.data.role, 'admin')
  assert.ok(!('password_hash' in valid.body.data))

  const invalid = await apiRequest(server.baseUrl, 'GET', '/auth/me', { token: 'garbage.token.here' })
  assert.equal(invalid.status, 401)

  const noToken = await apiRequest(server.baseUrl, 'GET', '/auth/me', {})
  assert.equal(noToken.status, 401)
})
