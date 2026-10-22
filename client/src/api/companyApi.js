import { apiClient } from './apiClient'

// Field names khớp 1-1 với backend (company_code, company_name, tax_code, address, phone, email,
// website, representative, status) — không cần mapper (mismatch check 4B-3). GET mở cho mọi role
// đã đăng nhập (Student cần đọc để tự đề xuất doanh nghiệp) — không scope ở backend, không tự lọc
// thêm ở frontend.
export function getAll() {
  return apiClient.get('/companies')
}

export function getById(id) {
  return apiClient.get(`/companies/${id}`)
}

export function create(payload) {
  return apiClient.post('/companies', payload)
}

export function update(id, payload) {
  return apiClient.put(`/companies/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/companies/${id}`)
}
