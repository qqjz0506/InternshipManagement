// Escape 5 ký tự HTML đặc biệt — dùng khi dựng HTML tay (template string) cho email, KHÔNG có
// framework templating nào tự escape ở đó. Áp dụng cho MỌI giá trị động chèn vào HTML (title/
// content/tên hệ thống...) — dữ liệu này có thể bắt nguồn từ input người dùng (ví dụ tiêu đề vị trí
// thực tập do Company Mentor tự đặt, không qua sanitize) nên phải coi là KHÔNG tin cậy, dù không
// hiển thị trực tiếp trên web (React tự escape khi render) — email client (Gmail, Outlook...) render
// HTML thẳng, không có lớp bảo vệ nào khác ở đó.
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { escapeHtml }
