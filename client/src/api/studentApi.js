import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (student_code, full_name, gender, date_of_birth, phone, email,
// address, department_id, major, class, status, user_id) — không cần mapper (mismatch check 4B-2).
// GET đã được backend tự scope theo role (Admin: tất cả, Student: chính mình, Lecturer/Company
// Mentor: SV mình phụ trách) — apiClient chỉ cần gọi thẳng, không tự thêm logic scope ở frontend.
export function getAll() {
  return apiClient.get('/students')
}

export function getById(id) {
  return apiClient.get(`/students/${id}`)
}

export function create(payload) {
  return apiClient.post('/students', payload)
}

export function update(id, payload) {
  return apiClient.put(`/students/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/students/${id}`)
}
