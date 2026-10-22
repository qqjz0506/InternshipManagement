import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (user_id, company_id, full_name, email, phone, position,
// status) — không cần mapper (mismatch check 4B-3). GET đã được backend tự scope theo role (Admin:
// tất cả, Company Mentor: chính mình, Student/Lecturer: mentor liên quan qua internships).
//
// LƯU Ý: PUT khi đổi company_id sẽ kích hoạt transaction backend (gỡ company_mentor_id khỏi mọi
// Internship đang dùng mentor này) — KHÔNG được tự lặp lại logic này ở frontend (mục 11 Phase 4B-3).
// Response data trả về chỉ là mentor đã cập nhật (message chứa thêm số lượng hồ sơ bị gỡ, không
// expose qua return value ở đây vì apiClient chỉ trả `data`).
export function getAll() {
  return apiClient.get('/company-mentors')
}

export function getById(id) {
  return apiClient.get(`/company-mentors/${id}`)
}

export function create(payload) {
  return apiClient.post('/company-mentors', payload)
}

export function update(id, payload) {
  return apiClient.put(`/company-mentors/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/company-mentors/${id}`)
}
