import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InfoCard from '../../components/common/InfoCard'
import DataTable from '../../components/common/DataTable'
import Timeline from '../../components/common/Timeline'
import CompanyLogCommentModal from '../../components/internshipLogs/CompanyLogCommentModal'
import CompanyReportCommentModal from '../../components/reports/CompanyReportCommentModal'
import CompanyEvaluationForm from '../../components/evaluations/CompanyEvaluationForm'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import { LOG_STATUS_META } from '../../utils/internshipLogStatus'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { buildInternshipTimelineSteps } from '../../utils/internshipTimeline'
import '../../components/common/ListPage.css'
import './CompanyStudentDetailPage.css'

const TABS = [
  { key: 'logs', label: 'Nhật ký' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'evaluations', label: 'Đánh giá' },
]

function CompanyStudentDetailPage() {
  const { id } = useParams()
  const myInternships = useMyMentoredInternships()
  const { items: students } = useStudents()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()
  const { items: logs, isMutating: isLogMutating, updateItem: updateLog } = useInternshipLogs()
  const { items: reports, isMutating: isReportMutating, updateItem: updateReport } = useReports()
  const { items: evaluations } = useEvaluations()

  const [activeTab, setActiveTab] = useState('logs')
  const [selectedLog, setSelectedLog] = useState(null)
  const [logCommentError, setLogCommentError] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportCommentError, setReportCommentError] = useState('')
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false)

  // Authorization ở page-level: chỉ tìm trong hồ sơ ĐÃ được phân công company_mentor_id = mình.
  const internship = myInternships.find((item) => item.student_id === Number(id))

  if (!internship) {
    return (
      <div className="list-page">
        <p>Sinh viên này không thuộc phạm vi phụ trách của bạn, hoặc không tồn tại.</p>
        <Link to="/company/students">Quay lại danh sách sinh viên</Link>
      </div>
    )
  }

  const student = students.find((item) => item.id === internship.student_id)
  const department = departments.find((item) => item.id === student?.department_id)
  const period = periods.find((item) => item.id === internship.period_id)
  const lecturer = lecturers.find((item) => item.id === internship.lecturer_id)
  const topic = topics.find((item) => item.id === internship.topic_id)

  const myLogs = logs
    .filter((log) => log.internship_id === internship.id)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
  const myReports = reports
    .filter((report) => report.internship_id === internship.id)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))
  const companyEvaluation = evaluations.find(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'company',
  )
  const lecturerEvaluation = evaluations.find(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'lecturer',
  )

  const hasLogs = myLogs.length > 0
  const hasReports = myReports.length > 0
  const hasPublishedEvaluation = evaluations.some(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.is_published,
  )
  const timelineSteps = buildInternshipTimelineSteps(internship, { hasLogs, hasReports, hasPublishedEvaluation })

  const logColumns = [
    { key: 'log_date', label: 'Ngày' },
    { key: 'title', label: 'Tiêu đề' },
    { key: 'progress', label: 'Tiến độ', render: (row) => `${row.progress}%` },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={LOG_STATUS_META[row.status].tone}>{LOG_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Button variant="secondary" className="btn-sm" onClick={() => setSelectedLog(row)}>
          {row.company_comment ? 'Xem / Sửa nhận xét' : 'Nhận xét'}
        </Button>
      ),
    },
  ]

  const reportColumns = [
    { key: 'report_type', label: 'Loại', render: (row) => REPORT_TYPE_LABEL[row.report_type] },
    { key: 'file_name', label: 'File' },
    { key: 'submitted_at', label: 'Ngày nộp' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <Badge tone={REPORT_STATUS_META[row.status].tone}>{REPORT_STATUS_META[row.status].label}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Button variant="secondary" className="btn-sm" onClick={() => setSelectedReport(row)}>
          {row.company_comment ? 'Xem / Sửa nhận xét' : 'Nhận xét'}
        </Button>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="detail-header">
        <div>
          <Link to="/company/students" className="back-link">
            ← Danh sách sinh viên phụ trách
          </Link>
          <h2>{student ? `${student.full_name} (${student.student_code})` : 'Sinh viên'}</h2>
        </div>
        <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
      </div>

      <div className="card-grid">
        <InfoCard title="Thông tin sinh viên">
          <dl>
            <dt>Họ tên</dt>
            <dd>{student?.full_name}</dd>
            <dt>MSSV</dt>
            <dd>{student?.student_code}</dd>
            <dt>Email</dt>
            <dd>{student?.email}</dd>
            <dt>SĐT</dt>
            <dd>{student?.phone}</dd>
            <dt>Khoa</dt>
            <dd>{department?.department_name ?? '—'}</dd>
            <dt>Lớp</dt>
            <dd>{student?.class}</dd>
            <dt>Ngành</dt>
            <dd>{student?.major}</dd>
          </dl>
        </InfoCard>

        <InfoCard title="Hồ sơ thực tập">
          <dl>
            <dt>Đợt thực tập</dt>
            <dd>{period?.period_name ?? '—'}</dd>
            <dt>Giảng viên hướng dẫn</dt>
            <dd>{lecturer?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Đề tài</dt>
            <dd>{topic?.topic_name ?? 'Chưa có'}</dd>
            <dt>Ngày bắt đầu</dt>
            <dd>{internship.start_date ?? 'Chưa xác định'}</dd>
            <dt>Ngày kết thúc</dt>
            <dd>{internship.end_date ?? 'Chưa xác định'}</dd>
          </dl>
          <p className="form-hint">
            Sinh viên, giảng viên, đợt thực tập, đề tài do Admin/Student/Lecturer quản lý — bạn chỉ xem, không sửa.
          </p>
        </InfoCard>

        <InfoCard title="Tiến độ">
          <p>
            <strong>{internship.progress}%</strong> hoàn thành
          </p>
          <Timeline steps={timelineSteps} />
        </InfoCard>
      </div>

      <div className="detail-tabs">
        <div className="tab-header">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-body">
          {activeTab === 'logs' && (
            <DataTable columns={logColumns} data={myLogs} rowKey="id" emptyMessage="Chưa có nhật ký nào." />
          )}

          {activeTab === 'reports' && (
            <DataTable columns={reportColumns} data={myReports} rowKey="id" emptyMessage="Chưa có báo cáo nào." />
          )}

          {activeTab === 'evaluations' && (
            <div className="card-grid">
              <InfoCard title="Đánh giá của doanh nghiệp">
                {companyEvaluation ? (
                  <dl>
                    <dt>Điểm tổng</dt>
                    <dd>
                      <strong>{companyEvaluation.overall_score}</strong>
                    </dd>
                    <dt>Trạng thái</dt>
                    <dd>{companyEvaluation.is_published ? 'Đã công bố' : 'Nháp (chưa công bố)'}</dd>
                  </dl>
                ) : (
                  <p className="info-card-empty">Bạn chưa đánh giá sinh viên này.</p>
                )}
                {companyEvaluation || ['in_progress', 'completed'].includes(internship.status) ? (
                  <Button className="btn-sm" onClick={() => setIsEvaluationOpen(true)}>
                    {companyEvaluation ? 'Xem / Sửa đánh giá' : 'Đánh giá sinh viên'}
                  </Button>
                ) : (
                  <p className="form-hint">Chỉ đánh giá được khi sinh viên đã bắt đầu thực tập.</p>
                )}
              </InfoCard>

              <InfoCard
                title="Đánh giá của giảng viên"
                isEmpty={!lecturerEvaluation || !lecturerEvaluation.is_published}
                emptyMessage="Chưa có đánh giá được công bố từ giảng viên."
              >
                {lecturerEvaluation?.is_published && (
                  <dl>
                    <dt>Điểm tổng</dt>
                    <dd>
                      <strong>{lecturerEvaluation.overall_score}</strong>
                    </dd>
                    <dt>Nhận xét</dt>
                    <dd>{lecturerEvaluation.comment}</dd>
                  </dl>
                )}
              </InfoCard>
            </div>
          )}
        </div>
      </div>

      <CompanyLogCommentModal
        isOpen={Boolean(selectedLog)}
        onClose={() => {
          setSelectedLog(null)
          setLogCommentError('')
        }}
        onSubmit={async (logId, changes) => {
          setLogCommentError('')
          const result = await updateLog(logId, changes)
          if (result.success) {
            setSelectedLog(null)
          } else {
            setLogCommentError(result.message)
          }
        }}
        log={selectedLog}
        studentName={student?.full_name ?? ''}
        submitError={logCommentError}
        isSubmitting={isLogMutating}
      />

      <CompanyReportCommentModal
        isOpen={Boolean(selectedReport)}
        onClose={() => {
          setSelectedReport(null)
          setReportCommentError('')
        }}
        onSubmit={async (reportId, changes) => {
          setReportCommentError('')
          const result = await updateReport(reportId, changes)
          if (result.success) {
            setSelectedReport(null)
          } else {
            setReportCommentError(result.message)
          }
        }}
        report={selectedReport}
        studentName={student?.full_name ?? ''}
        submitError={reportCommentError}
        isSubmitting={isReportMutating}
      />

      <CompanyEvaluationForm
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
        internshipId={internship.id}
        studentName={student?.full_name ?? ''}
      />
    </div>
  )
}

export default CompanyStudentDetailPage
