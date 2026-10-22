import Badge from '../../components/common/Badge'
import Timeline from '../../components/common/Timeline'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import { buildInternshipTimelineSteps } from '../../utils/internshipTimeline'
import '../../components/common/ListPage.css'

// Toàn bộ bước ở đây suy ra trực tiếp từ dữ liệu Internships/Reports/Evaluations hiện có,
// KHÔNG lưu một trạng thái timeline riêng — tránh có 2 nguồn sự thật về tiến độ.
function StudentProgressPage() {
  const internship = useMyInternship()
  const { items: logs } = useInternshipLogs()
  const { items: reports } = useReports()
  const { items: evaluations } = useEvaluations()

  if (!internship) {
    return (
      <div className="list-page">
        <h2>Tiến độ thực tập</h2>
        <p>Bạn chưa có hồ sơ thực tập.</p>
      </div>
    )
  }

  if (internship.status === 'rejected' || internship.status === 'cancelled') {
    return (
      <div className="list-page">
        <div className="page-header">
          <h2>Tiến độ thực tập</h2>
          <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
        </div>
        <p>
          Hồ sơ thực tập này đã {internship.status === 'rejected' ? 'bị từ chối' : 'bị hủy'}, không tiếp tục
          theo dõi tiến độ.
        </p>
      </div>
    )
  }

  const hasLogs = logs.some((log) => log.internship_id === internship.id)
  const hasReports = reports.some((report) => report.internship_id === internship.id)
  const hasPublishedEvaluation = evaluations.some(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.is_published,
  )

  const steps = buildInternshipTimelineSteps(internship, { hasLogs, hasReports, hasPublishedEvaluation })

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Tiến độ thực tập</h2>
        <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
      </div>
      <Timeline steps={steps} />
    </div>
  )
}

export default StudentProgressPage
