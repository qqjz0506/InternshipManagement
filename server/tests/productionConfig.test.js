const test = require('node:test')
const assert = require('node:assert/strict')
const { validateProductionConfig, assertProductionConfig } = require('../config/productionChecks')

const VALID_ENV = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(32),
  CLIENT_URL: 'https://example.com',
  DEBUG_ERRORS: '',
}

test('validateProductionConfig: không phải production -> luôn [] dù thiếu gì', () => {
  assert.deepEqual(validateProductionConfig({ NODE_ENV: 'development' }), [])
  assert.deepEqual(validateProductionConfig({ NODE_ENV: 'test' }), [])
  assert.deepEqual(validateProductionConfig({}), [])
})

test('validateProductionConfig: production + đủ cấu hình hợp lệ -> []', () => {
  assert.deepEqual(validateProductionConfig(VALID_ENV), [])
})

test('validateProductionConfig: thiếu JWT_SECRET -> có lỗi', () => {
  const errors = validateProductionConfig({ ...VALID_ENV, JWT_SECRET: undefined })
  assert.ok(errors.some((message) => message.includes('JWT_SECRET')))
})

test('validateProductionConfig: JWT_SECRET ngắn hơn 32 ký tự -> có lỗi', () => {
  const errors = validateProductionConfig({ ...VALID_ENV, JWT_SECRET: 'a'.repeat(31) })
  assert.ok(errors.some((message) => message.includes('JWT_SECRET')))
})

test('validateProductionConfig: JWT_SECRET đúng 32 ký tự -> không lỗi JWT_SECRET', () => {
  const errors = validateProductionConfig({ ...VALID_ENV, JWT_SECRET: 'a'.repeat(32) })
  assert.ok(!errors.some((message) => message.includes('JWT_SECRET')))
})

test('validateProductionConfig: thiếu CLIENT_URL -> có lỗi', () => {
  const errors = validateProductionConfig({ ...VALID_ENV, CLIENT_URL: undefined })
  assert.ok(errors.some((message) => message.includes('CLIENT_URL')))
})

test('validateProductionConfig: DEBUG_ERRORS=true -> có lỗi', () => {
  const errors = validateProductionConfig({ ...VALID_ENV, DEBUG_ERRORS: 'true' })
  assert.ok(errors.some((message) => message.includes('DEBUG_ERRORS')))
})

test('validateProductionConfig: thiếu đồng thời cả 3 -> đủ 3 lỗi', () => {
  const errors = validateProductionConfig({ NODE_ENV: 'production', DEBUG_ERRORS: 'true' })
  assert.equal(errors.length, 3)
})

test('assertProductionConfig: hợp lệ -> không throw', () => {
  assert.doesNotThrow(() => assertProductionConfig(VALID_ENV))
})

test('assertProductionConfig: không hợp lệ -> throw kèm message liệt kê lỗi', () => {
  assert.throws(
    () => assertProductionConfig({ NODE_ENV: 'production' }),
    (error) => error.message.includes('JWT_SECRET') && error.message.includes('CLIENT_URL'),
  )
})
