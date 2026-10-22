import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (internship_id, log_date, title, content, result, difficulties,
// next_plan, note, progress, attachment, lecturer_comment, company_comment, status) — không cần
// mapper (mismatch check Phase 4D-1). GET đã được backend tự scope theo role qua Internship cha
// (Admin: tất cả, Student/Lecturer/Company Mentor: đúng phạm vi của mình). PUT là PARTIAL update ở
// backend (giống Internship, khác Department/Student/.../Topic) — forward đúng payload, không tự
// gộp full object.
export function getAll() {
  return apiClient.get('/internship-logs')
}

export function getById(id) {
  return apiClient.get(`/internship-logs/${id}`)
}

export function create(payload) {
  return apiClient.post('/internship-logs', payload)
}

export function update(id, payload) {
  return apiClient.put(`/internship-logs/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/internship-logs/${id}`)
}
