import { useCurrentStudent } from './useCurrentStudent'
import { useInternships } from '../context/InternshipsContext'
import { useInternshipPeriods } from '../context/InternshipPeriodsContext'

// Hồ sơ thực tập "hiện tại" của sinh viên đang đăng nhập: ưu tiên hồ sơ thuộc
// đợt đang diễn ra, nếu không có thì lấy hồ sơ gần nhất. Trả về null nếu chưa đăng ký.
export function useMyInternship() {
  const student = useCurrentStudent()
  const { internships } = useInternships()
  const { items: periods } = useInternshipPeriods()

  if (!student) {
    return null
  }

  const myInternships = internships.filter((item) => item.student_id === student.id)
  if (myInternships.length === 0) {
    return null
  }

  const ongoingPeriod = periods.find((period) => period.status === 'ongoing')
  const ongoingInternship = myInternships.find((item) => item.period_id === ongoingPeriod?.id)

  return ongoingInternship ?? myInternships[myInternships.length - 1]
}
