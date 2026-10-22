// Dựng FormData cho test upload báo cáo — dùng Blob/FormData built-in của Node (global từ Node 18+,
// không cần require thêm package nào). content chỉ cần đủ để multer/fileFilter xử lý được, KHÔNG
// cần là PDF/DOCX thật hợp lệ về mặt nội dung (dự án không parse nội dung file, chỉ validate
// extension + mimetype khai báo).
function buildReportFormData(
  fields = {},
  { filename = 'test-report.pdf', content = '%PDF-1.4 fake test content for automated test', mimeType = 'application/pdf', includeFile = true } = {},
) {
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  if (includeFile) {
    formData.append('file', new Blob([content], { type: mimeType }), filename)
  }
  return formData
}

module.exports = { buildReportFormData }
