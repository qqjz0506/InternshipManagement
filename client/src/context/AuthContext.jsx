import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, login as loginRequest } from '../api/authApi'
import { clearToken, getToken, onMustChangePassword, setToken } from '../api/apiClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  // Đang khôi phục session từ token lưu sẵn (gọi GET /api/auth/me) — ProtectedRoute/RootRedirect
  // phải chờ cờ này false rồi mới quyết định redirect, tránh văng về /login khi F5 dù token còn hợp lệ.
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setIsInitializing(false)
      return
    }

    getMe()
      .then((user) => setCurrentUser(user))
      .catch(() => clearToken())
      .finally(() => setIsInitializing(false))
  }, [])

  // Bất kỳ API call nào (ở BẤT KỲ Context/trang nào) nhận lại code "MUST_CHANGE_PASSWORD" từ server
  // (requireAuth chặn — xem server/middleware/authMiddleware.js) đều phải cập nhật ngay
  // currentUser.mustChangePassword, để ProtectedRoute.jsx (đã có sẵn logic redirect dựa trên field
  // này) tự chuyển sang /change-password ở lần render kế tiếp — không cần tự điều hướng ở đây.
  useEffect(() => {
    onMustChangePassword(() => {
      setCurrentUser((prev) => (prev ? { ...prev, mustChangePassword: true } : prev))
    })
  }, [])

  async function login(email, password) {
    let data
    try {
      data = await loginRequest(email, password)
    } catch (error) {
      return { success: false, message: error.message }
    }

    setToken(data.accessToken)
    setCurrentUser(data.user)
    return { success: true, user: data.user }
  }

  function logout() {
    clearToken()
    setCurrentUser(null)
  }

  // Gọi lại GET /api/auth/me để đồng bộ currentUser với DB — dùng sau khi đổi mật khẩu thành công
  // (mustChangePassword chuyển false phía server) để ProtectedRoute hết chặn mà không cần F5/đăng
  // nhập lại.
  async function refreshCurrentUser() {
    const user = await getMe()
    setCurrentUser(user)
    return user
  }

  return (
    <AuthContext.Provider value={{ currentUser, isInitializing, login, logout, refreshCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider')
  }
  return context
}
