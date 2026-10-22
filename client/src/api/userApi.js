import { apiClient } from './apiClient'

// Response GET/POST/PUT của backend đã là camelCase {id, fullName, email, role} (authService.
// toSafeUser() map full_name -> fullName ở phía server) — KHÔNG cần mapper chiều đọc.
//
// Mapper CHỈ cần cho chiều GHI (request body): backend dùng snake_case (full_name, profile_id,
// khớp convention toàn bộ API khác), còn AdminAccountsPage/AccountFormModal hiện tại (từ thời mock)
// dùng camelCase (fullName, linkedProfileId). Map ở đây — API boundary — đúng pattern đã dùng cho
// Settings (Phase 4E-3), không đổi convention backend chỉ để khớp 1 Context mock sắp bị thay thế.
//
// profile_id (backend) tương ứng linkedProfileId (frontend) — LÀ ID của students.id/lecturers.id/
// company_mentors.id, KHÔNG PHẢI users.id (2 domain ID khác nhau, xem AdminAccountsPage mục 11 Phase
// 4F-2) — mapper ở đây chỉ đổi TÊN field, không đổi giá trị, nên không có rủi ro nhầm lẫn domain ID
// miễn là AdminAccountsPage tiếp tục truyền đúng profile.id (không phải user.id) vào linkedProfileId.

export function getUsers() {
  return apiClient.get('/users')
}

export function getUser(id) {
  return apiClient.get(`/users/${id}`)
}

export function createUser({ fullName, email, password, role, linkedProfileId }) {
  const payload = { full_name: fullName, email, password, role }
  if (linkedProfileId !== undefined && linkedProfileId !== null && linkedProfileId !== '') {
    payload.profile_id = Number(linkedProfileId)
  }
  return apiClient.post('/users', payload)
}

// Chỉ full_name/email/password có thể đổi (role/profile immutable — backend reject cứng nếu gửi).
// password CHỈ được đưa vào payload khi Admin thực sự nhập mật khẩu mới — không có mật khẩu cũ để
// gửi lại (backend không bao giờ trả password/password_hash), rỗng nghĩa là giữ nguyên.
export function updateUser(id, { fullName, email, password }) {
  const payload = {}
  if (fullName !== undefined) {
    payload.full_name = fullName
  }
  if (email !== undefined) {
    payload.email = email
  }
  if (password) {
    payload.password = password
  }
  return apiClient.put(`/users/${id}`, payload)
}

// Trả { user, temporaryPassword } — temporaryPassword CHỈ xuất hiện đúng 1 lần trong response này,
// không lưu lại ở đâu khác trên client (không localStorage, không state lâu dài ngoài hiển thị tạm).
export function resetUserPassword(id) {
  return apiClient.put(`/users/${id}/reset-password`, {})
}

export function setUserStatus(id, status) {
  return apiClient.put(`/users/${id}/status`, { status })
}
