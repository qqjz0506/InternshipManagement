import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CHANGE_PASSWORD_PATH = '/change-password'

// allowedRoles: mảng role được phép vào nhóm route này (RBAC ở mục 11)
function ProtectedRoute({ allowedRoles }) {
  const { currentUser, isInitializing } = useAuth()
  const location = useLocation()

  // Đang khôi phục session từ token (GET /api/auth/me) lúc F5 — chờ xong rồi mới quyết định
  // redirect, tránh văng về /login dù token còn hợp lệ (mục 15 Phase 3A).
  if (isInitializing) {
    return null
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Đang dùng mật khẩu TẠM do Admin reset (users.must_change_password=1) — chặn MỌI route khác,
  // chỉ cho vào trang đổi mật khẩu (trừ chính route đó, tránh redirect loop).
  if (currentUser.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
