import { Link } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import InfoCard from '../../components/common/InfoCard'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useStudents } from '../../context/StudentsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useTopics } from '../../context/TopicsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'
import './LecturerProgressPage.css'

// Theo dõi hồ sơ thực tập (doanh nghiệp/mentor/đề tài/trạng thái/tiến độ) — chỉ xem, không sửa
// các trường thuộc workflow Admin/Student/Company (mục 4).
function LecturerProgressPage() {
  const myInternships = useMyAssignedInternships()
  const { items: students } = useStudents()
  const { items: companies } = useCompanies()
  const { items: topics } = useTopics()

  if (myInternships.length === 0) {
    return (
      <div className="list-page">
        <h2>Tiến độ thực tập</h2>
        <p>Bạn chưa được phân công hướng dẫn sinh viên nào.</p>
      </div>
    )
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Tiến độ thực tập</h2>
      </div>

      <div className="card-grid">
        {myInternships.map((internship) => {
          const student = students.find((item) => item.id === internship.student_id)
          const company = companies.find((item) => item.id === internship.company_id)
          const topic = topics.find((item) => item.id === internship.topic_id)

          return (
            <InfoCard
              key={internship.id}
              title={student?.full_name ?? 'Sinh viên'}
              action={<Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>}
            >
              <dl>
                <dt>Doanh nghiệp</dt>
                <dd>{company?.company_name ?? 'Chưa phân công'}</dd>
                <dt>Đề tài</dt>
                <dd>{topic?.topic_name ?? 'Chưa có'}</dd>
              </dl>
              <div className="progress-mini-bar">
                <div className="progress-mini-fill" style={{ width: `${internship.progress}%` }} />
              </div>
              <p>{internship.progress}% hoàn thành</p>
              <Link to={`/lecturer/students/${internship.student_id}`}>Xem chi tiết →</Link>
            </InfoCard>
          )
        })}
      </div>
    </div>
  )
}

export default LecturerProgressPage
