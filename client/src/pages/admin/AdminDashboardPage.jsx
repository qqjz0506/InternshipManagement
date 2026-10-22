import StatCard from '../../components/common/StatCard'
import InfoCard from '../../components/common/InfoCard'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useTopics } from '../../context/TopicsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'
import './AdminDashboardPage.css'

// Toàn bộ số liệu suy ra trực tiếp từ shared Context tại thời điểm render — không hard-code,
// không lưu snapshot/thống kê riêng (tránh lệch dữ liệu so với các module quản lý).
function AdminDashboardPage() {
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: companies } = useCompanies()
  const { items: topics } = useTopics()
  const { items: departments } = useDepartments()
  const { internships } = useInternships()
  const { items: logs } = useInternshipLogs()
  const { items: reports } = useReports()

  const studentsWithInternship = new Set(internships.map((internship) => internship.student_id))
  const noInternshipCount = students.filter((student) => !studentsWithInternship.has(student.id)).length
  const inProgressCount = internships.filter((internship) => internship.status === 'in_progress').length
  const completedCount = internships.filter((internship) => internship.status === 'completed').length
  const pendingCount = internships.filter((internship) => internship.status === 'pending').length
  const reportsPendingCount = reports.filter((report) => report.status === 'submitted').length

  const departmentBreakdown = departments.map((department) => ({
    label: department.department_name,
    value: students.filter((student) => student.department_id === department.id).length,
  }))
  const maxDepartmentValue = Math.max(1, ...departmentBreakdown.map((row) => row.value))

  const statusBreakdown = Object.entries(STATUS_META).map(([status, meta]) => ({
    label: meta.label,
    value: internships.filter((internship) => internship.status === status).length,
  }))
  const maxStatusValue = Math.max(1, ...statusBreakdown.map((row) => row.value))

  function findStudentByInternship(internshipId) {
    const internship = internships.find((item) => item.id === internshipId)
    return students.find((item) => item.id === internship?.student_id)
  }

  const recentActivity = [
    ...reports.map((report) => ({
      date: report.submitted_at,
      text: `${findStudentByInternship(report.internship_id)?.full_name ?? 'Sinh viên'} đã nộp báo cáo`,
    })),
    ...logs.map((log) => ({
      date: log.log_date,
      text: `${findStudentByInternship(log.internship_id)?.full_name ?? 'Sinh viên'} đã cập nhật nhật ký "${log.title}"`,
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="stat-grid">
        <StatCard label="Tổng sinh viên" value={students.length} />
        <StatCard label="Đang thực tập" value={inProgressCount} />
        <StatCard label="Đã hoàn thành" value={completedCount} />
        <StatCard label="Chưa có hồ sơ thực tập" value={noInternshipCount} />
        <StatCard label="Số doanh nghiệp" value={companies.length} />
        <StatCard label="Số giảng viên" value={lecturers.length} />
        <StatCard label="Số đề tài" value={topics.length} />
        <StatCard label="Hồ sơ chờ duyệt" value={pendingCount} />
        <StatCard label="Báo cáo chưa xử lý" value={reportsPendingCount} />
      </div>

      <div className="card-grid">
        <InfoCard title="Sinh viên theo khoa">
          <div className="breakdown-list">
            {departmentBreakdown.map((row) => (
              <div className="breakdown-row" key={row.label}>
                <span className="breakdown-label">{row.label}</span>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill"
                    style={{ width: `${(row.value / maxDepartmentValue) * 100}%` }}
                  />
                </div>
                <span className="breakdown-value">{row.value}</span>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard title="Trạng thái thực tập">
          <div className="breakdown-list">
            {statusBreakdown.map((row) => (
              <div className="breakdown-row" key={row.label}>
                <span className="breakdown-label">{row.label}</span>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill"
                    style={{ width: `${(row.value / maxStatusValue) * 100}%` }}
                  />
                </div>
                <span className="breakdown-value">{row.value}</span>
              </div>
            ))}
          </div>
        </InfoCard>
      </div>

      <InfoCard title="Hoạt động gần đây" isEmpty={recentActivity.length === 0} emptyMessage="Chưa có hoạt động nào.">
        <ul className="activity-list">
          {recentActivity.map((activity) => (
            <li key={`${activity.date}-${activity.text}`}>
              <span className="activity-date">{activity.date}</span>
              {activity.text}
            </li>
          ))}
        </ul>
      </InfoCard>
    </div>
  )
}

export default AdminDashboardPage
