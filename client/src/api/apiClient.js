// Nơi duy nhất quản lý: base URL, JSON request/response, Authorization header, HTTP error
// parsing. Mọi Context/API module khác (authApi.js, và các API module ở Phase 4B→4E) đều phải
// gọi qua đây — không tự viết fetch riêng (mục 4 Phase 4A).

export const TOKEN_STORAGE_KEY = 'itm_access_token'

// Mặc định '/api' (đường dẫn TƯƠNG ĐỐI, cùng origin) — đúng cho bản production thật (server/app.js
// tự phục vụ client/dist + API trên CÙNG 1 server/origin, xem README Mục 16M). Dev override qua
// client/.env (VITE_API_BASE_URL=http://localhost:5000/api, 2 server riêng cổng 5173/5000).
// Tách thành hàm thuần nhận `env` để test được dưới Node thường — import.meta.env chỉ tồn tại khi
// chạy qua Vite (dev/build), dưới `node --test` nó luôn là undefined (?. tránh crash khi đó).
export function resolveApiBaseUrl(env) {
  return env?.VITE_API_BASE_URL || '/api'
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env)

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

// Đăng ký 1 callback được gọi NGAY khi bất kỳ response lỗi nào mang code "MUST_CHANGE_PASSWORD"
// (server: requireAuth chặn mọi route trừ /auth/me và /auth/change-password khi
// users.must_change_password=1 — xem server/middleware/authMiddleware.js). apiClient KHÔNG tự
// import AuthContext/react-router (tránh circular dependency, đúng convention đã ghi ở UnauthorizedError
// phía trên) — AuthContext tự đăng ký callback này lúc mount để cập nhật currentUser.mustChangePassword,
// ProtectedRoute.jsx đã có sẵn logic redirect dựa trên field đó (không cần thêm logic điều hướng ở đây).
let mustChangePasswordListener = null
export function onMustChangePassword(callback) {
  mustChangePasswordListener = callback
}
function notifyIfMustChangePassword(code) {
  if (code === 'MUST_CHANGE_PASSWORD' && mustChangePasswordListener) {
    mustChangePasswordListener()
  }
}

// Lỗi chuẩn hoá cho mọi request — đủ { status, message, data } để UI quyết định hiển thị gì
// (mục 7). Không dùng Error trần để tránh UI phải tự đoán hình dạng lỗi.
export class ApiError extends Error {
  constructor(status, message, data, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code = code
  }
}

// Tách riêng để AuthContext có thể bắt bằng instanceof và tự quyết định clear session —
// apiClient KHÔNG tự ý gọi logout/AuthContext để tránh circular dependency (mục 8).
export class UnauthorizedError extends ApiError {
  constructor(message, data, code) {
    super(401, message, data, code)
    this.name = 'UnauthorizedError'
  }
}

async function parseBody(response) {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    // Response không phải JSON hợp lệ (vd. HTML lỗi từ proxy/server down) — không throw ở đây,
    // để request() quyết định dựa trên response.ok.
    return null
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.', null)
  }

  const parsed = await parseBody(response)
  const success = parsed && typeof parsed === 'object' ? parsed.success : undefined
  const message = parsed?.message

  if (!response.ok || success === false) {
    notifyIfMustChangePassword(parsed?.code)
    const fallbackMessage = `Yêu cầu thất bại (HTTP ${response.status}).`
    if (response.status === 401) {
      throw new UnauthorizedError(message || fallbackMessage, parsed?.data, parsed?.code)
    }
    throw new ApiError(response.status, message || fallbackMessage, parsed?.data, parsed?.code)
  }

  return parsed?.data
}

// Gửi multipart/form-data (upload file báo cáo thật) — KHÔNG set Content-Type tay, browser tự thêm
// đúng boundary khi body là FormData (set tay sẽ làm hỏng boundary, server không parse được).
async function requestForm(path, { method = 'POST', formData, auth = true } = {}) {
  const headers = {}
  if (auth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: formData })
  } catch {
    throw new ApiError(0, 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.', null)
  }

  const parsed = await parseBody(response)
  const success = parsed && typeof parsed === 'object' ? parsed.success : undefined
  const message = parsed?.message

  if (!response.ok || success === false) {
    notifyIfMustChangePassword(parsed?.code)
    const fallbackMessage = `Yêu cầu thất bại (HTTP ${response.status}).`
    if (response.status === 401) {
      throw new UnauthorizedError(message || fallbackMessage, parsed?.data, parsed?.code)
    }
    throw new ApiError(response.status, message || fallbackMessage, parsed?.data, parsed?.code)
  }

  return parsed?.data
}

// Download file nhị phân (export .xlsx) — khác hẳn request() JSON ở trên: không JSON.parse body
// thành công, trả về Blob + filename (đọc từ Content-Disposition). Nếu HTTP lỗi, backend vẫn trả
// JSON (đúng error contract chung) — phải parse để lấy message thật, KHÔNG được tải nhầm JSON lỗi
// thành file .xlsx hỏng (mục 21/23 Phase 5).
async function requestBlob(path) {
  const headers = {}
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers })
  } catch {
    throw new ApiError(0, 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.', null)
  }

  if (!response.ok) {
    const parsed = await parseBody(response)
    const message = parsed?.message
    notifyIfMustChangePassword(parsed?.code)
    const fallbackMessage = `Yêu cầu thất bại (HTTP ${response.status}).`
    if (response.status === 401) {
      throw new UnauthorizedError(message || fallbackMessage, parsed?.data, parsed?.code)
    }
    throw new ApiError(response.status, message || fallbackMessage, parsed?.data, parsed?.code)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  return { blob, filename: match ? match[1] : null }
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  getBlob: (path) => requestBlob(path),
  postForm: (path, formData, options) => requestForm(path, { ...options, method: 'POST', formData }),
  putForm: (path, formData, options) => requestForm(path, { ...options, method: 'PUT', formData }),
}
