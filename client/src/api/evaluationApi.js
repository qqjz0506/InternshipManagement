import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (internship_id, evaluator_role, attitude_score, skill_score,
// progress_score, discipline_score, overall_score, comment, is_published, published_at) — không cần
// mapper (mismatch check Phase 4E-1). KHÔNG có evaluator_id — evaluator được suy ra từ Internship
// (lecturer_id/company_mentor_id) qua evaluator_role, đúng model hiện tại, không tự thêm field nào.
// GET đã được backend tự scope theo role. PUT là PARTIAL update (giống Internship/Log/Report) —
// internship_id/evaluator_role immutable khi update (backend tự reject nếu có mặt trong payload).
export function getAll() {
  return apiClient.get('/evaluations')
}

export function getById(id) {
  return apiClient.get(`/evaluations/${id}`)
}

export function create(payload) {
  return apiClient.post('/evaluations', payload)
}

export function update(id, payload) {
  return apiClient.put(`/evaluations/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/evaluations/${id}`)
}
