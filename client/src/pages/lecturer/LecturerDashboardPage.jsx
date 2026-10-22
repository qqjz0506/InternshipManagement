import { Link } from 'react-router-dom'
import StatCard from '../../components/common/StatCard'
import InfoCard from '../../components/common/InfoCard'
import { useAuth } from '../../context/AuthContext'
import { useCurrentLecturer } from '../../hooks/useCurrentLecturer'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useNotifications } from '../../context/NotificationsContext'
import '../../components/common/ListPage.css'
import './LecturerDashboardPage.css'

function LecturerDashboardPage() {
  const { currentUser } = useAuth()
  const lecturer = useCurrentLecturer()
  const myInternships = useMyAssignedInternships()
  const { items: logs } = useInternshipLogs()
  const { items: reports } = useReports()
  const { items: evaluations } = useEvaluations()
  const { items: notifications } = useNotifications()

  if (!lecturer) {
    return (
      <div className="list-page">
        <h2>Dashboard</h2>
        <p>Không tìm thấy hồ sơ giảng viên gắn với tài khoản này.</p>
      </div>
    )
  }

  const myInternshipIds = new Set(myInternships.map((internship) => internship.id))
  const totalStudents = new Set(myInternships.map((internship) => internship.student_id)).size
  const inProgressCount = myInternships.filter((internship) => internship.status === 'in_progress').length
  const completedCount = myInternships.filter((internship) => internship.status === 'completed').length
  const pendingCount = myInternships.filter((internship) =>
    ['pending', 'approved'].includes(internship.status),
  ).length

  const logsToReview = logs.filter(
    (log) => myInternshipIds.has(log.internship_id) && log.status === 'submitted',
  ).length
  const reportsToReview = reports.filter(
    (report) => myInternshipIds.has(report.internship_id) && report.status === 'submitted',
  ).length
  const evaluationsNeeded = myInternships.filter(
    (internship) =>
      ['in_progress', 'completed'].includes(internship.status) &&
      !evaluations.some(
        (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'lecturer',
      ),
  ).length

  const myNotifications = notifications
    .filter((notification) => notification.user_id === currentUser.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const recentNotifications = myNotifications.slice(0, 3)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Xin chào, {lecturer.full_name}</h2>
      </div>
      <p className="dashboard-subtitle">Mã GV {lecturer.lecturer_code}</p>

      <div className="stat-grid">
        <StatCard label="Sinh viên đang hướng dẫn" value={totalStudents} />
        <StatCard label="Đang thực tập" value={inProgressCount} />
        <StatCard label="Đã hoàn thành" value={completedCount} />
        <StatCard label="Hồ sơ chờ xử lý" value={pendingCount} />
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
        <Link to="/lecturer/notifications">Xem tất cả thông báo →</Link>
      </InfoCard>
    </div>
  )
}

export default LecturerDashboardPage
