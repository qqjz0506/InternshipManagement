import { apiClient } from './apiClient'

// Field names đã khớp 1-1 với backend (department_code, department_name, description) — không cần
// mapper (mismatch check Phase 4B-1, mục 4). Danh sách nhỏ, frontend vẫn filter client-side như
// trước (mục 18), nên getAll() không truyền query search/filter.
export function getAll() {
  return apiClient.get('/departments')
}

export function getById(id) {
  return apiClient.get(`/departments/${id}`)
}

export function create(payload) {
  return apiClient.post('/departments', payload)
}

export function update(id, payload) {
  return apiClient.put(`/departments/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/departments/${id}`)
}
