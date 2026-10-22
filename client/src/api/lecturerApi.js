import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (lecturer_code, full_name, email, phone, department_id,
// position, status, user_id) — không cần mapper (mismatch check 4B-2). GET đã được backend tự
// scope theo role (Admin: tất cả, Lecturer: chính mình, Student/Company Mentor: GV mình liên quan).
export function getAll() {
  return apiClient.get('/lecturers')
}

export function getById(id) {
  return apiClient.get(`/lecturers/${id}`)
}

export function create(payload) {
  return apiClient.post('/lecturers', payload)
}

export function update(id, payload) {
  return apiClient.put(`/lecturers/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/lecturers/${id}`)
}
