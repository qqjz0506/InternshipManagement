import { useCurrentCompanyMentor } from './useCurrentCompanyMentor'
import { useInternships } from '../context/InternshipsContext'

// Nguồn phân công DUY NHẤT là Internship.company_mentor_id — KHÔNG lọc theo company_id
// rồi cho xem hết (mục 5): 2 mentor cùng công ty vẫn phải tách biệt sinh viên của nhau.
export function useMyMentoredInternships() {
  const mentor = useCurrentCompanyMentor()
  const { internships } = useInternships()

  if (!mentor) {
    return []
  }

  return internships.filter((internship) => internship.company_mentor_id === mentor.id)
}
