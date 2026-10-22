import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import '../../components/common/ListPage.css'
import './LecturerNotificationsPage.css'

const TYPE_LABEL = {
  internship: 'Hồ sơ thực tập',
  assignment: 'Phân công',
  report: 'Báo cáo',
  log: 'Nhật ký',
  reminder: 'Nhắc nhở',
  evaluation: 'Đánh giá',
}

function LecturerNotificationsPage() {
  const { currentUser } = useAuth()
  const { items: notifications, isLoading, isMutating, error, updateItem, markAllAsRead } = useNotifications()

  const myNotifications = notifications
    .filter((notification) => notification.user_id === currentUser.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const unreadCount = myNotifications.filter((notification) => !notification.is_read).length

  async function handleMarkRead(id) {
    if (isMutating) {
      return
    }
    const result = await updateItem(id, { is_read: true })
    if (!result.success) {
      window.alert(result.message)
    }
  }

  async function handleMarkAllRead() {
    if (isMutating) {
      return
    }
    const result = await markAllAsRead(currentUser.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    {
      key: 'title',
      label: 'Thông báo',
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div className="notification-content">{row.content}</div>
        </div>
      ),
    },
    { key: 'type', label: 'Loại', render: (row) => TYPE_LABEL[row.type] ?? row.type },
    { key: 'created_at', label: 'Ngày' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (row.is_read ? <Badge tone="neutral">Đã đọc</Badge> : <Badge tone="info">Chưa đọc</Badge>),
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        !row.is_read ? (
          <Button
            variant="secondary"
            className="btn-sm"
            disabled={isMutating}
            onClick={() => handleMarkRead(row.id)}
          >
            Đánh dấu đã đọc
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Thông báo {unreadCount > 0 && `(${unreadCount} chưa đọc)`}</h2>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={handleMarkAllRead} disabled={isMutating}>
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={myNotifications} rowKey="id" emptyMessage="Chưa có thông báo nào." />
      )}
    </div>
  )
}

export default LecturerNotificationsPage
