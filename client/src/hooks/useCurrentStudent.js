import { useAuth } from '../context/AuthContext'
import { useStudents } from '../context/StudentsContext'

// Trả về đúng 1 bản ghi Student ứng với tài khoản đang đăng nhập (qua user_id),
// dùng chung cho mọi trang Student Portal — không tạo state riêng.
export function useCurrentStudent() {
  const { currentUser } = useAuth()
  const { items: students } = useStudents()

  if (!currentUser) {
    return null
  }

  return students.find((student) => student.user_id === currentUser.id) ?? null
}
