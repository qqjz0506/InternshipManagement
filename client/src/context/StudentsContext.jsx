import { createApiResourceContext } from './createApiResourceContext'
import * as studentApi from '../api/studentApi'

// Phase 4B-2: Student không còn dùng mock data/students.js làm source of truth — state đến từ
// GET /api/students. Ownership/field-whitelist (Student chỉ tự sửa field liên hệ, chỉ xem chính
// mình; Lecturer/Company Mentor chỉ xem SV mình phụ trách) đã được backend enforce hoàn toàn
// (Phase 3B) — Context chỉ cần pass-through CRUD, không cần logic riêng gì thêm (xem
// docs/API_PHASE_4B_2.md mục 5).
// refresh: nạp lại toàn bộ danh sách từ server — dùng sau khi Admin nhập nhiều dòng từ Excel (import
// Phase), vì addItem() chỉ thêm ĐÚNG 1 item/lần, không hợp cho việc thêm hàng loạt.
const { Provider, useResource } = createApiResourceContext(studentApi, 'Students', {
  extraActions: {
    refresh: async ({ api, setItems }) => {
      const data = await api.getAll()
      setItems(data)
    },
  },
})

export const StudentsProvider = Provider
export const useStudents = useResource
