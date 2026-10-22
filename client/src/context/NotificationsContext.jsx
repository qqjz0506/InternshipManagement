import { createApiResourceContext } from './createApiResourceContext'
import * as notificationApi from '../api/notificationApi'
import { canLoadNotifications } from './providerAccess'

// Phase 4E-2: Notification không còn dùng mock data/notifications.js làm source of truth — state
// đến từ GET /api/notifications. Ownership (user_id = chính mình, IDOR protection qua query param)
// + immutable fields (chỉ is_read sửa được) đã được backend enforce hoàn toàn (Phase 3B) — Context
// chỉ pass-through CRUD, tái dùng factory có sẵn (naming đã tương thích).
//
// Bổ sung sau (thông báo tự động): pollIntervalMs để Topbar hiện badge gần-thời-gian-thực mà không
// cần F5; markAllAsRead là extraAction (API bulk, không map được vào updateItem(id, payload) vì
// không có đúng 1 id) — thay thế cách cũ (loop updateItem cho từng thông báo chưa đọc, nhiều request).
const { Provider, useResource } = createApiResourceContext(notificationApi, 'Notifications', {
  shouldLoad: canLoadNotifications,
  pollIntervalMs: 30000,
  extraActions: {
    // ownUserId: BẮT BUỘC truyền currentUser.id từ page gọi — items có thể chứa thông báo của NHIỀU
    // user khác nhau khi Admin gọi getAll() (backend không ép user_id cho Admin, xem
    // notificationService.getAll), nên không được flip is_read cho MỌI item trong local state, chỉ
    // đúng item thuộc về chính người gọi (khớp đúng những gì backend thật sự vừa update).
    async markAllAsRead({ api, setItems }, ownUserId) {
      await api.markAllAsRead()
      setItems((prev) => prev.map((item) => (item.user_id === ownUserId ? { ...item, is_read: 1 } : item)))
    },
  },
})

export const NotificationsProvider = Provider
export const useNotifications = useResource
