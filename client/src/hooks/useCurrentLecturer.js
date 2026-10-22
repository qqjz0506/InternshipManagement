import { useAuth } from '../context/AuthContext'
import { useLecturers } from '../context/LecturersContext'

// Trả về đúng 1 bản ghi Lecturer ứng với tài khoản đang đăng nhập (qua user_id),
// cùng pattern với useCurrentStudent — không tạo state riêng.
export function useCurrentLecturer() {
  const { currentUser } = useAuth()
  const { items: lecturers } = useLecturers()

  if (!currentUser) {
    return null
  }

  return lecturers.find((lecturer) => lecturer.user_id === currentUser.id) ?? null
}
