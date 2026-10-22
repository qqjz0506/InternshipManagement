import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (topic_code, topic_name, description, suggested_by_student_id,
// company_id, status) — không cần mapper (mismatch check 4B-4). GET mở cho mọi role đã đăng nhập.
// POST: Admin (toàn quyền) hoặc Student (chỉ đề xuất cho chính mình — backend tự ép
// suggested_by_student_id/company_id/status, không tin giá trị client gửi). PUT/DELETE: chỉ Admin.
export function getAll() {
  return apiClient.get('/topics')
}

export function getById(id) {
  return apiClient.get(`/topics/${id}`)
}

export function create(payload) {
  return apiClient.post('/topics', payload)
}

export function update(id, payload) {
  return apiClient.put(`/topics/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/topics/${id}`)
}
