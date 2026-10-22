import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (user_id, title, content, type, is_read, created_at) — không
// cần mapper (mismatch check Phase 4E-2). GET đã được backend tự ép user_id = chính mình cho mọi
// role không phải admin, KHÔNG tin query param (IDOR protection từ Phase 3B, re-verify ở 4E-2).
// PUT chỉ chấp nhận đúng { is_read } — user_id/title/content/type immutable, backend tự reject.
// Không có UI tạo/xóa notification nào trong Frontend hiện tại — create/remove export cho đủ REST
// convention (đã tồn tại sẵn ở backend từ Phase 2F), KHÔNG tự dựng Admin UI mới trong phase này.
export function getAll() {
  return apiClient.get('/notifications')
}

export function getById(id) {
  return apiClient.get(`/notifications/${id}`)
}

export function create(payload) {
  return apiClient.post('/notifications', payload)
}

export function update(id, payload) {
  return apiClient.put(`/notifications/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/notifications/${id}`)
}

// Đánh dấu TOÀN BỘ thông báo CỦA CHÍNH MÌNH là đã đọc (1 request bulk) — backend tự ép theo
// currentUser, không nhận id/user_id nào từ client.
export function markAllAsRead() {
  return apiClient.put('/notifications/read-all', {})
}
