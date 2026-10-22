import { apiClient } from './apiClient'

// Nhập danh sách Sinh viên/Giảng viên từ Excel (Admin) — xem server/routes/importRoutes.js.
// template*(): tải file mẫu (.xlsx) qua getBlob (đã có sẵn, dùng chung pattern với export).
// preview*/commit*(): multipart qua postForm (đã có sẵn) — field "file" + (commit) "create_accounts".
// downloadAccountsFile(): file email+mật khẩu tạm, chỉ tải được ĐÚNG 1 LẦN với đúng token.

export function getStudentsTemplate() {
  return apiClient.getBlob('/imports/templates/students.xlsx')
}

export function getLecturersTemplate() {
  return apiClient.getBlob('/imports/templates/lecturers.xlsx')
}

export function previewStudents(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.postForm('/imports/students/preview', formData)
}

export function previewLecturers(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.postForm('/imports/lecturers/preview', formData)
}

export function commitStudents(file, createAccounts) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('create_accounts', createAccounts ? 'true' : 'false')
  return apiClient.postForm('/imports/students/commit', formData)
}

export function commitLecturers(file, createAccounts) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('create_accounts', createAccounts ? 'true' : 'false')
  return apiClient.postForm('/imports/lecturers/commit', formData)
}

export function downloadAccountsFile(token) {
  return apiClient.getBlob(`/imports/accounts-file/${token}`)
}
