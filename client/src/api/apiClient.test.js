// Test server/client/src/api/apiClient.js — resolveApiBaseUrl(). Chạy dưới node:test thường (không
// qua Vite), nên import.meta.env luôn là undefined — đây CHÍNH LÀ tình huống cần test (production
// build nếu không set VITE_API_BASE_URL phải rơi về '/api', KHÔNG phải absolute localhost:5000 cũ).
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiBaseUrl } from './apiClient.js'

test('resolveApiBaseUrl: không có VITE_API_BASE_URL (production build mặc định) -> "/api" (tương đối, cùng origin)', () => {
  assert.equal(resolveApiBaseUrl(undefined), '/api')
  assert.equal(resolveApiBaseUrl({}), '/api')
})

test('resolveApiBaseUrl: có VITE_API_BASE_URL (dev, client/.env) -> dùng đúng giá trị đó', () => {
  assert.equal(resolveApiBaseUrl({ VITE_API_BASE_URL: 'http://localhost:5000/api' }), 'http://localhost:5000/api')
})

test('apiClient.js chạy dưới Node thường (import.meta.env luôn undefined ngoài Vite) không crash khi import', () => {
  // Nếu dòng "const API_BASE_URL = ..." ở apiClient.js không dùng optional chaining, import module này
  // sẽ throw TypeError ngay tại đây (đã verify thực tế trước khi sửa) — import ở đầu file không
  // crash là bằng chứng đủ, không cần assert thêm.
  assert.ok(true)
})
