// Test tự động cho luật role-aware loading (Phase 6A) — dùng node:test built-in, giống đúng pattern
// đã dùng ở server/services/exportService.test.js (Phase 5). KHÔNG cần React/jsdom/testing-library:
// providerAccess.js là module JS thuần (không JSX), nên chạy thẳng bằng `node --test` được ngay.
//
// Chạy: node --test src/context/providerAccess.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { canLoadUsers, canLoadSettings, canLoadNotifications } from './providerAccess.js'

const ADMIN = { id: 1, role: 'admin' }
const STUDENT = { id: 2, role: 'student' }
const LECTURER = { id: 3, role: 'lecturer' }
const MENTOR = { id: 4, role: 'company_mentor' }

test('canLoadUsers: chỉ true cho admin', () => {
  assert.equal(canLoadUsers(ADMIN), true)
  assert.equal(canLoadUsers(STUDENT), false)
  assert.equal(canLoadUsers(LECTURER), false)
  assert.equal(canLoadUsers(MENTOR), false)
  assert.equal(canLoadUsers(null), false)
  assert.equal(canLoadUsers(undefined), false)
})

test('canLoadSettings: true cho admin + student, false cho lecturer/mentor/chưa đăng nhập', () => {
  assert.equal(canLoadSettings(ADMIN), true)
  assert.equal(canLoadSettings(STUDENT), true)
  assert.equal(canLoadSettings(LECTURER), false)
  assert.equal(canLoadSettings(MENTOR), false)
  assert.equal(canLoadSettings(null), false)
})

// Admin bổ sung sau (thông báo tự động + AdminNotificationsPage.jsx) — trước đó Admin không có
// trang Notifications nào tiêu thụ nên bị loại; giờ có nên admin cũng phải load được.
test('canLoadNotifications: true cho admin/student/lecturer/mentor, false khi chưa đăng nhập', () => {
  assert.equal(canLoadNotifications(ADMIN), true)
  assert.equal(canLoadNotifications(STUDENT), true)
  assert.equal(canLoadNotifications(LECTURER), true)
  assert.equal(canLoadNotifications(MENTOR), true)
  assert.equal(canLoadNotifications(null), false)
})
