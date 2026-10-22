import { Link } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import InfoCard from '../../components/common/InfoCard'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'
import './CompanyProgressPage.css'

function CompanyProgressPage() {
  const myInternships = useMyMentoredInternships()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()

  if (myInternships.length === 0) {
    return (
      <div className="list-page">
        <h2>Tiến độ thực tập</h2>
        <p>Bạn chưa được phân công tiếp nhận sinh viên nào.</p>
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
          const lecturer = lecturers.find((item) => item.id === internship.lecturer_id)
          const topic = topics.find((item) => item.id === internship.topic_id)

          return (
            <InfoCard
              key={internship.id}
              title={student?.full_name ?? 'Sinh viên'}
              action={<Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>}
            >
              <dl>
                <dt>Giảng viên</dt>
                <dd>{lecturer?.full_name ?? 'Chưa phân công'}</dd>
                <dt>Đề tài</dt>
                <dd>{topic?.topic_name ?? 'Chưa có'}</dd>
              </dl>
              <div className="progress-mini-bar">
                <div className="progress-mini-fill" style={{ width: `${internship.progress}%` }} />
              </div>
              <p>{internship.progress}% hoàn thành</p>
              <Link to={`/company/students/${internship.student_id}`}>Xem chi tiết →</Link>
            </InfoCard>
          )
        })}
      </div>
    </div>
  )
}

export default CompanyProgressPage
