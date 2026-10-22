// Trigger tải file từ Blob (dùng cho export .xlsx — mục 22 Phase 5): tạo object URL tạm, click 1
// thẻ <a> ẩn, rồi revoke ngay — không window.open(), không expose token trong URL, không lưu blob
// vào localStorage.
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
