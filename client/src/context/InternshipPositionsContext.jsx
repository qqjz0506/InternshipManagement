import { createApiResourceContext } from './createApiResourceContext'
import * as internshipPositionApi from '../api/internshipPositionApi'

// Vị trí thực tập (Mục 16K README) — GET đã scope theo role ở backend (Admin: tất cả, Company
// Mentor: vị trí công ty mình, Student: chỉ vị trí 'open' của đợt chưa đóng). addItem/updateItem
// generic (createApiResourceContext) đủ dùng cho tạo/sửa vị trí. refresh(): nạp lại accepted_count/
// status mới nhất sau khi chấp nhận/từ chối đơn (PositionApplicationsContext) — đổi ở Context KHÁC
// không tự làm state ở đây cũ đi, phải fetch lại thủ công.
const { Provider, useResource } = createApiResourceContext(internshipPositionApi, 'InternshipPositions', {
  extraActions: {
    refresh: async ({ api, setItems }) => {
      const data = await api.getAll()
      setItems(data)
    },
  },
})

export const InternshipPositionsProvider = Provider
export const useInternshipPositions = useResource
