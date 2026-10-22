import { createApiResourceContext } from './createApiResourceContext'
import * as lecturerApi from '../api/lecturerApi'

// Phase 4B-2: Lecturer không còn dùng mock data/lecturers.js làm source of truth — state đến từ
// GET /api/lecturers. Ownership (Lecturer chỉ xem chính mình; Student/Company Mentor chỉ xem GV
// liên quan) đã được backend enforce hoàn toàn (Phase 3B) — Context chỉ pass-through CRUD.
// refresh: nạp lại toàn bộ danh sách từ server — dùng sau khi Admin nhập nhiều dòng từ Excel (import
// Phase), vì addItem() chỉ thêm ĐÚNG 1 item/lần, không hợp cho việc thêm hàng loạt.
const { Provider, useResource } = createApiResourceContext(lecturerApi, 'Lecturers', {
  extraActions: {
    refresh: async ({ api, setItems }) => {
      const data = await api.getAll()
      setItems(data)
    },
  },
})

export const LecturersProvider = Provider
export const useLecturers = useResource
