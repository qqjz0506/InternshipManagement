import { apiClient } from './apiClient'

// Field names đã khớp 1-1 với backend (period_code, period_name, start_date, end_date, status,
// description) — không cần mapper (mismatch check Phase 4B-1, mục 4). Frontend vẫn filter/lọc
// status client-side trên state đã load (mục 18), nên getAll() không truyền query.
export function getAll() {
  return apiClient.get('/internship-periods')
}

export function getById(id) {
  return apiClient.get(`/internship-periods/${id}`)
}

export function create(payload) {
  return apiClient.post('/internship-periods', payload)
}

export function update(id, payload) {
  return apiClient.put(`/internship-periods/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/internship-periods/${id}`)
}
