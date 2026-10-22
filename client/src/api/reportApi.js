import { apiClient } from './apiClient'

// Upload file thật (server/config/upload.js, multer): create() nhận FormData (field "internship_id",
// "report_type", "file") — KHÔNG còn field_name text thuần do client tự nhập. update() nhận plain
// object (status/reviewer_comment/company_comment — Lecturer/Company/Admin) HOẶC FormData (Student
// nộp lại kèm file mới, field "file") — tự rẽ nhánh theo kiểu payload, Context/factory không cần biết.
export function getAll() {
  return apiClient.get('/reports')
}

export function getById(id) {
  return apiClient.get(`/reports/${id}`)
}

export function create(formData) {
  return apiClient.postForm('/reports', formData)
}

export function update(id, payload) {
  if (payload instanceof FormData) {
    return apiClient.putForm(`/reports/${id}`, payload)
  }
  return apiClient.put(`/reports/${id}`, payload)
}

export function remove(id) {
  return apiClient.delete(`/reports/${id}`)
}

// Tải file báo cáo thật — scope giống GET /reports/:id (403 nếu không thuộc phạm vi), 404 nếu báo
// cáo chưa có file đính kèm (seed cũ). Trả { blob, filename } giống exportApi.getBlob.
export function downloadFile(id) {
  return apiClient.getBlob(`/reports/${id}/download`)
}
