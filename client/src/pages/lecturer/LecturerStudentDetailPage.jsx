import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InfoCard from '../../components/common/InfoCard'
import DataTable from '../../components/common/DataTable'
import Timeline from '../../components/common/Timeline'
import LecturerLogReviewModal from '../../components/internshipLogs/LecturerLogReviewModal'
import LecturerReportReviewModal from '../../components/reports/LecturerReportReviewModal'
import LecturerEvaluationForm from '../../components/evaluations/LecturerEvaluationForm'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useTopics } from '../../context/TopicsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { useReports } from '../../context/ReportsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useFinalResult } from '../../hooks/useFinalResult'
import { STATUS_META } from '../../utils/internshipStatus'
import { LOG_STATUS_META } from '../../utils/internshipLogStatus'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { buildInternshipTimelineSteps } from '../../utils/internshipTimeline'
import '../../components/common/ListPage.css'
import './LecturerStudentDetailPage.css'

const TABS = [
  { key: 'logs', label: 'Nhật ký' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'evaluations', label: 'Đánh giá' },
]

function LecturerStudentDetailPage() {
  const { id } = useParams()
  const myInternships = useMyAssignedInternships()
  const { items: students } = useStudents()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: topics, updateItem: updateTopic, isMutating: isTopicMutating } = useTopics()
  const { items: logs, isMutating: isLogMutating, updateItem: updateLog } = useInternshipLogs()
  const { items: reports, isMutating: isReportMutating, updateItem: updateReport } = useReports()
  const { items: evaluations } = useEvaluations()

  const [activeTab, setActiveTab] = useState('logs')
  const [selectedLog, setSelectedLog] = useState(null)
  const [logReviewError, setLogReviewError] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportReviewError, setReportReviewError] = useState('')
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false)

  // Authorization ở page-level: chỉ tìm trong danh sách hồ sơ ĐÃ được phân công cho lecturer này.
  // Sinh viên không thuộc mình (kể cả gõ thẳng URL) sẽ không tìm thấy gì ở đây.
  const internship = myInternships.find((item) => item.student_id === Number(id))
  const { finalResult } = useFinalResult(internship?.id)

  if (!internship) {
    return (
      <div className="list-page">
        <p>Sinh viên này không thuộc phạm vi hướng dẫn của bạn, hoặc không tồn tại.</p>
        <Link to="/lecturer/students">Quay lại danh sách sinh viên</Link>
      </div>
    )
  }

  const student = students.find((item) => item.id === internship.student_id)
  const department = departments.find((item) => item.id === student?.department_id)
  const period = periods.find((item) => item.id === internship.period_id)
  const company = companies.find((item) => item.id === internship.company_id)
  const mentor = mentors.find((item) => item.id === internship.company_mentor_id)
  const topic = topics.find((item) => item.id === internship.topic_id)

  const myLogs = logs
    .filter((log) => log.internship_id === internship.id)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
  const myReports = reports
    .filter((report) => report.internship_id === internship.id)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))
  const lecturerEvaluation = evaluations.find(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'lecturer',
  )
  const companyEvaluation = evaluations.find(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'company',
  )

  const hasLogs = myLogs.length > 0
  const hasReports = myReports.length > 0
  const hasPublishedEvaluation = evaluations.some(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.is_published,
  )
  const timelineSteps = buildInternshipTimelineSteps(internship, { hasLogs, hasReports, hasPublishedEvaluation })

  // FIX BLOCKER (sau Phase 4B-4): Lecturer được phép duyệt/từ chối đề tài, nhưng CHỈ khi đề tài đó
  // gắn với 1 Internship do chính Lecturer này hướng dẫn (backend kiểm tra qua internships.topic_id +
  // internships.lecturer_id — không suy ra quyền từ suggested_by_student_id). Request CHỈ được gửi
  // đúng { status }, không gửi full topic — backend reject field khác (403), không silently bỏ qua.
  async function handleTopicDecision(decision) {
    if (isTopicMutating) {
      return
    }
    const result = await updateTopic(topic.id, { status: decision })
    if (!result.success) {
      window.alert(result.message)
    }
  }

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
          {row.status === 'reviewed' ? 'Xem / Sửa nhận xét' : 'Nhận xét'}
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
          Nhận xét
        </Button>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="detail-header">
        <div>
          <Link to="/lecturer/students" className="back-link">
            ← Danh sách sinh viên hướng dẫn
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
            <dt>Doanh nghiệp</dt>
            <dd>{company?.company_name ?? 'Chưa phân công'}</dd>
            <dt>Người hướng dẫn</dt>
            <dd>{mentor?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Ngày bắt đầu</dt>
            <dd>{internship.start_date ?? 'Chưa xác định'}</dd>
            <dt>Ngày kết thúc</dt>
            <dd>{internship.end_date ?? 'Chưa xác định'}</dd>
          </dl>
          <p className="form-hint">
            Doanh nghiệp, người hướng dẫn, đợt thực tập do Admin/Student/Company quản lý — bạn chỉ xem, không sửa.
          </p>
        </InfoCard>

        <InfoCard title="Đề tài" isEmpty={!topic} emptyMessage="Sinh viên chưa có đề tài.">
          <dl>
            <dt>Tên đề tài</dt>
            <dd>{topic?.topic_name}</dd>
            <dt>Mô tả</dt>
            <dd>{topic?.description}</dd>
            <dt>Trạng thái</dt>
            <dd>
              {topic && (
                <Badge tone={topic.status === 'approved' ? 'success' : topic.status === 'rejected' ? 'danger' : 'warning'}>
                  {topic.status === 'approved' ? 'Đã duyệt' : topic.status === 'rejected' ? 'Từ chối' : 'Đề xuất'}
                </Badge>
              )}
            </dd>
          </dl>
          {topic?.status === 'proposed' && (
            <div className="topic-actions">
              <Button className="btn-sm" disabled={isTopicMutating} onClick={() => handleTopicDecision('approved')}>
                Duyệt đề tài
              </Button>
              <Button
                variant="danger"
                className="btn-sm"
                disabled={isTopicMutating}
                onClick={() => handleTopicDecision('rejected')}
              >
                Từ chối
              </Button>
            </div>
          )}
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
              <InfoCard title="Đánh giá của giảng viên">
                {lecturerEvaluation ? (
                  <dl>
                    <dt>Điểm tổng</dt>
                    <dd>
                      <strong>{lecturerEvaluation.overall_score}</strong>
                    </dd>
                    <dt>Trạng thái</dt>
                    <dd>{lecturerEvaluation.is_published ? 'Đã công bố' : 'Nháp (chưa công bố)'}</dd>
                  </dl>
                ) : (
                  <p className="info-card-empty">Bạn chưa đánh giá sinh viên này.</p>
                )}
                {lecturerEvaluation || ['in_progress', 'completed'].includes(internship.status) ? (
                  <Button className="btn-sm" onClick={() => setIsEvaluationOpen(true)}>
                    {lecturerEvaluation ? 'Xem / Sửa đánh giá' : 'Đánh giá sinh viên'}
                  </Button>
                ) : (
                  <p className="form-hint">Chỉ đánh giá được khi sinh viên đã bắt đầu thực tập.</p>
                )}
              </InfoCard>

              <InfoCard
                title="Đánh giá của doanh nghiệp"
                isEmpty={!companyEvaluation || !companyEvaluation.is_published}
                emptyMessage="Chưa có đánh giá được công bố từ doanh nghiệp."
              >
                {companyEvaluation?.is_published && (
                  <dl>
                    <dt>Điểm tổng</dt>
                    <dd>
                      <strong>{companyEvaluation.overall_score}</strong>
                    </dd>
                    <dt>Nhận xét</dt>
                    <dd>{companyEvaluation.comment}</dd>
                  </dl>
                )}
              </InfoCard>

              <InfoCard
                title="Điểm tổng kết thực tập"
                isEmpty={!finalResult}
                emptyMessage="Chưa đủ 2 đánh giá (giảng viên + doanh nghiệp) được công bố."
              >
                {finalResult && (
                  <dl>
                    <dt>Điểm tổng kết</dt>
                    <dd>
                      <strong>{finalResult.finalScore}</strong>
                    </dd>
                    <dt>Xếp loại</dt>
                    <dd>{finalResult.classification}</dd>
                  </dl>
                )}
              </InfoCard>
            </div>
          )}
        </div>
      </div>

      <LecturerLogReviewModal
        isOpen={Boolean(selectedLog)}
        onClose={() => {
          setSelectedLog(null)
          setLogReviewError('')
        }}
        onSubmit={async (logId, changes) => {
          setLogReviewError('')
          const result = await updateLog(logId, changes)
          if (result.success) {
            setSelectedLog(null)
          } else {
            setLogReviewError(result.message)
          }
        }}
        log={selectedLog}
        studentName={student?.full_name ?? ''}
        submitError={logReviewError}
        isSubmitting={isLogMutating}
      />

      <LecturerReportReviewModal
        isOpen={Boolean(selectedReport)}
        onClose={() => {
          setSelectedReport(null)
          setReportReviewError('')
        }}
        onSubmit={async (reportId, changes) => {
          setReportReviewError('')
          const result = await updateReport(reportId, changes)
          if (result.success) {
            setSelectedReport(null)
          } else {
            setReportReviewError(result.message)
          }
        }}
        report={selectedReport}
        studentName={student?.full_name ?? ''}
        submitError={reportReviewError}
        isSubmitting={isReportMutating}
      />

      <LecturerEvaluationForm
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
        internshipId={internship.id}
        studentName={student?.full_name ?? ''}
      />
    </div>
  )
}

export default LecturerStudentDetailPage
