import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (student_id, period_id, company_id, company_mentor_id,
// lecturer_id, topic_id, start_date, end_date, status, progress) — không cần mapper (mismatch check
// Phase 4C). GET đã được backend tự scope theo role (Admin: tất cả, Student/Lecturer/Company
// Mentor: đúng phạm vi của mình). PUT là PARTIAL update ở backend (merge, không phải full-replace —
// khác các entity trước đó) — Context/API module chỉ cần forward đúng payload, không cần gửi full
// object.
export function getAll() {
  return apiClient.get('/internships')
}

export function getById(id) {
  return apiClient.get(`/internships/${id}`)
}

export function create(payload) {
  return apiClient.post('/internships', payload)
}

export function update(id, payload) {
  return apiClient.put(`/internships/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/internships/${id}`)
}

// Điểm tổng kết thực tập — data=null khi chưa đủ 2 đánh giá (lecturer+company) công bố (data-
// availability gate, không phải permission riêng). Field trả về: { finalScore, classification }.
export function getFinalResult(id) {
  return apiClient.get(`/internships/${id}/final-result`)
}

// Giấy tờ PDF (Mục 16L README) — getBlob() đã có sẵn (dùng chung pattern với export .xlsx/tải báo
// cáo), không JSON nên không qua request() thường. 409 khi hồ sơ chưa đủ điều kiện (chưa duyệt/chưa
// có company cho giấy giới thiệu; chưa completed cho phiếu kết quả) — scope 403 giống GET /:id.
export function getIntroductionLetter(id) {
  return apiClient.getBlob(`/internships/${id}/documents/introduction-letter.pdf`)
}

export function getResultSheet(id) {
  return apiClient.getBlob(`/internships/${id}/documents/result-sheet.pdf`)
}
