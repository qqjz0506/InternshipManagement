import { apiClient } from './apiClient'

// GET đã được backend tự scope theo role (Admin: tất cả, Student: đơn của chính mình, Company
// Mentor: đơn vào vị trí công ty mình). create() = ứng tuyển (POST /, field position_id + note).
export function getAll() {
  return apiClient.get('/position-applications')
}

export function create(payload) {
  return apiClient.post('/position-applications', payload)
}

export function withdraw(id) {
  return apiClient.put(`/position-applications/${id}/withdraw`, {})
}

export function reject(id) {
  return apiClient.put(`/position-applications/${id}/reject`, {})
}

export function accept(id) {
  return apiClient.put(`/position-applications/${id}/accept`, {})
}
