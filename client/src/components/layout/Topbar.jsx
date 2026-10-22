import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import { ROLE_LABELS, NOTIFICATIONS_PATH_BY_ROLE } from '../../data/mockUsers'
import './Layout.css'

// Badge số thông báo chưa đọc — items tự refresh mỗi 30s khi tab đang mở (NotificationsContext
// pollIntervalMs), nên badge gần-thời-gian-thực mà không cần F5 lại trang.
function Topbar() {
  const { currentUser, logout } = useAuth()
  const { items: notifications, markAllAsRead } = useNotifications()
  const navigate = useNavigate()

  const unreadCount = notifications.filter(
    (notification) => notification.user_id === currentUser?.id && !notification.is_read,
  ).length

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleBellClick() {
    navigate(NOTIFICATIONS_PATH_BY_ROLE[currentUser?.role] ?? '/')
  }

  async function handleQuickMarkAllRead(event) {
    event.stopPropagation()
    if (unreadCount === 0) {
      return
    }
    await markAllAsRead(currentUser.id)
  }

  return (
    <header className="topbar">
      {/* Phase 7B (F-05): bỏ ô tìm kiếm — không có chức năng search thật nào phía sau, giữ nguyên
          div rỗng để không đổi layout (.topbar dùng justify-content: space-between với đúng 2 con). */}
      <div className="topbar-search" />
      <div className="topbar-user">
        <button type="button" className="topbar-notifications" onClick={handleBellClick} title="Xem thông báo">
          Thông báo
          {unreadCount > 0 && <span className="topbar-notifications-badge">{unreadCount}</span>}
        </button>
        {unreadCount > 0 && (
          <button type="button" className="topbar-logout" onClick={handleQuickMarkAllRead}>
            Đánh dấu tất cả đã đọc
          </button>
        )}
        <span className="topbar-user-name">{currentUser?.fullName}</span>
        <span className="topbar-user-role">{ROLE_LABELS[currentUser?.role]}</span>
        <button type="button" className="topbar-logout" onClick={() => navigate('/change-password')}>
          Đổi mật khẩu
        </button>
        <button type="button" className="topbar-logout" onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>
    </header>
  )
}

export default Topbar
