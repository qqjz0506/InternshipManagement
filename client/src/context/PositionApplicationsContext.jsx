import { createApiResourceContext } from './createApiResourceContext'
import * as applicationApi from '../api/positionApplicationApi'

// Đơn ứng tuyển vị trí thực tập (Mục 16K README) — addItem() = ứng tuyển (POST /, đúng
// applicationApi.create()). withdraw/reject/accept không phải PUT /:id chung (3 action-endpoint
// riêng, không phải update 1 field tùy ý) -> dùng extraActions, tự cập nhật lại đúng item trong
// state sau khi gọi API thành công (không cần gọi lại getAll()).
const { Provider, useResource } = createApiResourceContext(applicationApi, 'PositionApplications', {
  extraActions: {
    withdraw: async ({ api, setItems }, id) => {
      const updated = await api.withdraw(id)
      setItems((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
    },
    reject: async ({ api, setItems }, id) => {
      const updated = await api.reject(id)
      setItems((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
    },
    accept: async ({ api, setItems }, id) => {
      const updated = await api.accept(id)
      setItems((prev) => prev.map((item) => (item.id === Number(id) ? updated : item)))
    },
  },
})

export const PositionApplicationsProvider = Provider
export const usePositionApplications = useResource
