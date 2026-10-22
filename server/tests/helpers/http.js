// Wrapper fetch() mỏng — KHÔNG tự nuốt lỗi parse JSON: mọi response của API này luôn trả JSON
// (sendSuccess/errorHandler đều dùng res.json), nên nếu parse thất bại đó LÀ một lỗi thật, phải
// ném ra để test fail rõ ràng, không che giấu (mục 19/20 Phase 6B — không swallow error).
async function apiRequest(baseUrl, method, path, { token, body } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  // headers: thêm để test kiểm tra response header (vd. helmet) — field mới, không phá vỡ test cũ
  // chỉ destructure { status, body }.
  return { status: res.status, body: json, headers: Object.fromEntries(res.headers.entries()) }
}

// Multipart/form-data — dùng cho test upload file thật (POST/PUT /reports với field "file"). KHÔNG
// set Content-Type tay (fetch tự thêm đúng boundary khi body là FormData — set tay sẽ làm hỏng boundary).
async function apiRequestMultipart(baseUrl, method, path, { token, formData } = {}) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: formData })
  const json = await res.json()
  return { status: res.status, body: json, headers: Object.fromEntries(res.headers.entries()) }
}

module.exports = { apiRequest, apiRequestMultipart }
