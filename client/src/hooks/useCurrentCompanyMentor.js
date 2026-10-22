import { useAuth } from '../context/AuthContext'
import { useCompanyMentors } from '../context/CompanyMentorsContext'

// Cùng pattern useCurrentStudent/useCurrentLecturer — không tạo state riêng.
export function useCurrentCompanyMentor() {
  const { currentUser } = useAuth()
  const { items: mentors } = useCompanyMentors()

  if (!currentUser) {
    return null
  }

  return mentors.find((mentor) => mentor.user_id === currentUser.id) ?? null
}
