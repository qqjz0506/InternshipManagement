import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (company_id, period_id, title, description, requirements, slots,
// status) — không cần mapper. GET đã được backend tự scope theo role (Admin: tất cả, Company Mentor:
// vị trí công ty mình, Student: chỉ vị trí 'open' của đợt chưa đóng).
export function getAll() {
  return apiClient.get('/internship-positions')
}

export function getById(id) {
  return apiClient.get(`/internship-positions/${id}`)
}

export function create(payload) {
  return apiClient.post('/internship-positions', payload)
}

export function update(id, payload) {
  return apiClient.put(`/internship-positions/${id}`, payload)
}
