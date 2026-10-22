import { Link } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import StatCard from '../../components/common/StatCard'
import InfoCard from '../../components/common/InfoCard'
import { useAuth } from '../../context/AuthContext'
import { useCurrentStudent } from '../../hooks/useCurrentStudent'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useNotifications } from '../../context/NotificationsContext'
import { useRemindersOverview } from '../../hooks/useRemindersOverview'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'
import './StudentDashboardPage.css'

function StudentDashboardPage() {
  const { currentUser } = useAuth()
  const student = useCurrentStudent()
  const internship = useMyInternship()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()
  const { items: logs } = useInternshipLogs()
  const { items: reports } = useReports()
  const { items: evaluations } = useEvaluations()
  const { items: notifications } = useNotifications()
  const { overview } = useRemindersOverview()

  if (!student) {
    return (
      <div className="list-page">
        <h2>Dashboard</h2>
        <p>Không tìm thấy hồ sơ sinh viên gắn với tài khoản này.</p>
      </div>
    )
  }

  const department = departments.find((item) => item.id === student.department_id)
  const period = internship ? periods.find((item) => item.id === internship.period_id) : null
  const company = internship ? companies.find((item) => item.id === internship.company_id) : null
  const mentor = internship ? mentors.find((item) => item.id === internship.company_mentor_id) : null
  const lecturer = internship ? lecturers.find((item) => item.id === internship.lecturer_id) : null
  const topic = internship ? topics.find((item) => item.id === internship.topic_id) : null

  const myLogsCount = internship ? logs.filter((log) => log.internship_id === internship.id).length : 0
  const myReportsCount = internship ? reports.filter((report) => report.internship_id === internship.id).length : 0
  const myPublishedEvaluations = internship
    ? evaluations.filter((evaluation) => evaluation.internship_id === internship.id && evaluation.is_published)
    : []

  const myNotifications = notifications
    .filter((notification) => notification.user_id === currentUser.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const recentNotifications = myNotifications.slice(0, 3)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Xin chào, {student.full_name}</h2>
      </div>
      <p className="dashboard-subtitle">
        MSSV {student.student_code} · {department?.department_name ?? '—'} · Lớp {student.class}
      </p>

      {!internship ? (
        <InfoCard title="Thực tập">
          <p className="info-card-empty">Bạn chưa đăng ký thực tập cho đợt nào.</p>
          <Link to="/student/internship">Đăng ký thực tập ngay →</Link>
        </InfoCard>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              label="Trạng thái hồ sơ"
              value={
                <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
              }
            />
            <StatCard label="Tiến độ" value={`${internship.progress}%`} />
            <StatCard label="Nhật ký đã nộp" value={myLogsCount} />
            <StatCard label="Báo cáo đã nộp" value={myReportsCount} />
            <StatCard label="Đánh giá đã công bố" value={myPublishedEvaluations.length} />
          </div>

          <div className="card-grid">
            <InfoCard title="Đợt thực tập">
              <dl>
                <dt>Tên đợt</dt>
                <dd>{period?.period_name ?? '—'}</dd>
                <dt>Thời gian</dt>
                <dd>{period ? `${period.start_date} → ${period.end_date}` : '—'}</dd>
              </dl>
            </InfoCard>

            <InfoCard
              title="Doanh nghiệp & người hướng dẫn"
              isEmpty={!company}
              emptyMessage="Chưa phân công doanh nghiệp."
            >
              <dl>
                <dt>Doanh nghiệp</dt>
                <dd>{company?.company_name}</dd>
                <dt>Người hướng dẫn</dt>
                <dd>{mentor ? `${mentor.full_name} (${mentor.position})` : 'Chưa phân công'}</dd>
              </dl>
            </InfoCard>

            <InfoCard title="Giảng viên hướng dẫn" isEmpty={!lecturer} emptyMessage="Chưa phân công giảng viên.">
              <dl>
                <dt>Họ tên</dt>
                <dd>{lecturer?.full_name}</dd>
                <dt>Email</dt>
                <dd>{lecturer?.email}</dd>
              </dl>
            </InfoCard>

            <InfoCard title="Đề tài" isEmpty={!topic} emptyMessage="Chưa có đề tài.">
              <dl>
                <dt>Tên đề tài</dt>
                <dd>{topic?.topic_name}</dd>
              </dl>
            </InfoCard>
          </div>

          <InfoCard title="Việc cần làm" isEmpty={!overview?.items?.length} emptyMessage="Không có việc gì cần nhắc.">
            <ul className="dashboard-notification-list">
              {overview?.items?.map((item) => <li key={item.key}>{item.message}</li>)}
            </ul>
          </InfoCard>

          <InfoCard title="Thông báo gần đây">
            {recentNotifications.length === 0 ? (
              <p className="info-card-empty">Chưa có thông báo nào.</p>
            ) : (
              <ul className="dashboard-notification-list">
                {recentNotifications.map((notification) => (
                  <li key={notification.id}>
                    <strong>{notification.title}</strong> — {notification.created_at}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/student/notifications">Xem tất cả thông báo →</Link>
          </InfoCard>
        </>
      )}
    </div>
  )
}

export default StudentDashboardPage
