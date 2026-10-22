import { useCurrentLecturer } from './useCurrentLecturer'
import { useInternships } from '../context/InternshipsContext'

// Nguồn phân công DUY NHẤT là Internship.lecturer_id — không tạo "assignedStudents" state riêng (mục 12).
export function useMyAssignedInternships() {
  const lecturer = useCurrentLecturer()
  const { internships } = useInternships()

  if (!lecturer) {
    return []
  }

  return internships.filter((internship) => internship.lecturer_id === lecturer.id)
}
