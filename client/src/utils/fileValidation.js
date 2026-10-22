// Khớp đúng rule backend (server/config/upload.js) — validate client-side chỉ để UX nhanh hơn
// (phản hồi ngay, không cần chờ round-trip), backend vẫn là nguồn sự thật (mimetype/extension/
// dung lượng được kiểm tra lại đầy đủ ở server, không tin riêng validate phía client).
export const ALLOWED_REPORT_EXTENSIONS = ['.pdf', '.doc', '.docx']
export const MAX_REPORT_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateReportFile(file) {
  if (!file) {
    return 'Vui lòng chọn file báo cáo.'
  }
  const ext = `.${file.name.split('.').pop().toLowerCase()}`
  if (!ALLOWED_REPORT_EXTENSIONS.includes(ext)) {
    return 'Chỉ chấp nhận file .pdf, .doc, .docx.'
  }
  if (file.size > MAX_REPORT_FILE_SIZE) {
    return 'File vượt quá dung lượng cho phép (tối đa 10MB).'
  }
  return null
}

export function formatFileSize(bytes) {
  if (!bytes) {
    return '0 B'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
