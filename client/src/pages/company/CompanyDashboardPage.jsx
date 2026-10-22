import { Link } from 'react-router-dom'
import StatCard from '../../components/common/StatCard'
import InfoCard from '../../components/common/InfoCard'
import { useAuth } from '../../context/AuthContext'
import { useCurrentCompanyMentor } from '../../hooks/useCurrentCompanyMentor'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useCompanies } from '../../context/CompaniesContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useNotifications } from '../../context/NotificationsContext'
import '../../components/common/ListPage.css'
import './CompanyDashboardPage.css'

function CompanyDashboardPage() {
  const { currentUser } = useAuth()
  const mentor = useCurrentCompanyMentor()
  const myInternships = useMyMentoredInternships()
  const { items: companies } = useCompanies()
  const { items: logs } = useInternshipLogs()
  const { items: reports } = useReports()
  const { items: evaluations } = useEvaluations()
  const { items: notifications } = useNotifications()

  if (!mentor) {
    return (
      <div className="list-page">
        <h2>Dashboard</h2>
        <p>Không tìm thấy hồ sơ người hướng dẫn gắn với tài khoản này.</p>
      </div>
    )
  }

  const company = companies.find((item) => item.id === mentor.company_id)
  const myInternshipIds = new Set(myInternships.map((internship) => internship.id))
  const totalStudents = new Set(myInternships.map((internship) => internship.student_id)).size
  const inProgressCount = myInternships.filter((internship) => internship.status === 'in_progress').length
  const completedCount = myInternships.filter((internship) => internship.status === 'completed').length

  const logsToReview = logs.filter(
    (log) => myInternshipIds.has(log.internship_id) && !log.company_comment,
  ).length
  const reportsToReview = reports.filter(
    (report) => myInternshipIds.has(report.internship_id) && !report.company_comment,
  ).length
  const evaluationsNeeded = myInternships.filter(
    (internship) =>
      ['in_progress', 'completed'].includes(internship.status) &&
      !evaluations.some(
        (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'company',
      ),
  ).length

  const myNotifications = notifications
    .filter((notification) => notification.user_id === currentUser.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const recentNotifications = myNotifications.slice(0, 3)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Xin chào, {mentor.full_name}</h2>
      </div>
      <p className="dashboard-subtitle">
        {mentor.position} · {company?.company_name ?? '—'}
      </p>

      <div className="stat-grid">
        <StatCard label="Sinh viên phụ trách" value={totalStudents} />
        <StatCard label="Đang thực tập" value={inProgressCount} />
        <StatCard label="Đã hoàn thành" value={completedCount} />
        <StatCard label="Nhật ký cần xem" value={logsToReview} />
        <StatCard label="Báo cáo cần xem" value={reportsToReview} />
        <StatCard label="Đánh giá cần thực hiện" value={evaluationsNeeded} />
      </div>

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
        <Link to="/company/notifications">Xem tất cả thông báo →</Link>
      </InfoCard>
    </div>
  )
}

export default CompanyDashboardPage
