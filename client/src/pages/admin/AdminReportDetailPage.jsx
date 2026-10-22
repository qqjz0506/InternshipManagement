import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InfoCard from '../../components/common/InfoCard'
import { useReports } from '../../context/ReportsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { downloadReportFile } from '../../utils/reportDownload'
import './AdminReportDetailPage.css'

function formatReportCode(id) {
  return `BC-${String(id).padStart(3, '0')}`
}

// Admin quản lý workflow (đổi trạng thái), KHÔNG sửa nội dung báo cáo của sinh viên (mục 5).
const ADMIN_SELECTABLE_STATUSES = ['submitted', 'approved', 'rejected']

function AdminReportDetailPage() {
  const { id } = useParams()
  const { items: reports, isLoading, isMutating, updateItem } = useReports()
  const { internships } = useInternships()
  const { items: students } = useStudents()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()

  const [nextStatus, setNextStatus] = useState('')

  const report = reports.find((item) => item.id === Number(id))

  if (isLoading) {
    return <p>Đang tải dữ liệu...</p>
  }

  if (!report) {
    return (
      <div className="list-page">
        <p>Không tìm thấy báo cáo này.</p>
        <Link to="/admin/reports">Quay lại danh sách báo cáo</Link>
      </div>
    )
  }

  const internship = internships.find((item) => item.id === report.internship_id)
  const student = students.find((item) => item.id === internship?.student_id)
  const department = departments.find((item) => item.id === student?.department_id)
  const period = periods.find((item) => item.id === internship?.period_id)
  const company = companies.find((item) => item.id === internship?.company_id)
  const mentor = mentors.find((item) => item.id === internship?.company_mentor_id)
  const lecturer = lecturers.find((item) => item.id === internship?.lecturer_id)
  const topic = topics.find((item) => item.id === internship?.topic_id)

  async function handleDownload() {
    try {
      await downloadReportFile(report.id, report.file_name)
    } catch (err) {
      window.alert(err.message)
    }
  }

  async function handleStatusChange() {
    if (!nextStatus || nextStatus === report.status || isMutating) {
      return
    }
    const confirmed = window.confirm(
      `Đổi trạng thái báo cáo sang "${REPORT_STATUS_META[nextStatus].label}"?`,
    )
    if (!confirmed) {
      return
    }
    const result = await updateItem(report.id, { status: nextStatus })
    if (!result.success) {
      window.alert(result.message)
      return
    }
    setNextStatus('')
  }

  return (
    <div className="list-page">
      <div className="detail-header">
        <div>
          <Link to="/admin/reports" className="back-link">
            ← Danh sách báo cáo
          </Link>
          <h2>{formatReportCode(report.id)}</h2>
        </div>
        <Badge tone={REPORT_STATUS_META[report.status].tone}>{REPORT_STATUS_META[report.status].label}</Badge>
      </div>

      <div className="card-grid">
        <InfoCard title="Sinh viên">
          <dl>
            <dt>MSSV</dt>
            <dd>{student?.student_code}</dd>
            <dt>Họ tên</dt>
            <dd>{student?.full_name}</dd>
            <dt>Lớp</dt>
            <dd>{student?.class}</dd>
            <dt>Khoa</dt>
            <dd>{department?.department_name ?? '—'}</dd>
          </dl>
        </InfoCard>

        <InfoCard title="Hồ sơ thực tập">
          <dl>
            <dt>Doanh nghiệp</dt>
            <dd>{company?.company_name ?? 'Chưa phân công'}</dd>
            <dt>Người hướng dẫn</dt>
            <dd>{mentor?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Giảng viên</dt>
            <dd>{lecturer?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Đề tài</dt>
            <dd>{topic?.topic_name ?? 'Chưa có'}</dd>
            <dt>Đợt thực tập</dt>
            <dd>{period?.period_name ?? '—'}</dd>
            <dt>Ngày bắt đầu</dt>
            <dd>{internship?.start_date ?? 'Chưa xác định'}</dd>
            <dt>Ngày kết thúc</dt>
            <dd>{internship?.end_date ?? 'Chưa xác định'}</dd>
          </dl>
        </InfoCard>

        <InfoCard title="Thông tin báo cáo">
          <dl>
            <dt>Loại báo cáo</dt>
            <dd>{REPORT_TYPE_LABEL[report.report_type]}</dd>
            <dt>Tên file</dt>
            <dd>
              {report.file_name}{' '}
              <Button
                variant="secondary"
                className="btn-sm"
                disabled={!report.stored_file_name}
                title={report.stored_file_name ? undefined : 'Chưa có file'}
                onClick={handleDownload}
              >
                Tải xuống
              </Button>
            </dd>
            <dt>Ngày nộp</dt>
            <dd>{report.submitted_at}</dd>
          </dl>
          <p className="form-hint">
            Hệ thống hiện chưa lưu ngày cập nhật/lịch sử chỉnh sửa cho báo cáo — chỉ hiển thị đúng dữ liệu đang có.
          </p>

          <div className="status-control">
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              <option value="">-- Đổi trạng thái --</option>
              {ADMIN_SELECTABLE_STATUSES.filter((status) => status !== report.status).map((status) => (
                <option key={status} value={status}>
                  {REPORT_STATUS_META[status].label}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              className="btn-sm"
              onClick={handleStatusChange}
              disabled={!nextStatus || isMutating}
            >
              Cập nhật
            </Button>
          </div>
        </InfoCard>

        <InfoCard
          title="Nhận xét của giảng viên"
          isEmpty={!report.reviewer_comment}
          emptyMessage="Giảng viên chưa nhận xét."
        >
          <p>{report.reviewer_comment}</p>
          <p className="form-hint">Người phản hồi: {lecturer?.full_name ?? '—'}</p>
        </InfoCard>

        <InfoCard
          title="Nhận xét của doanh nghiệp"
          isEmpty={!report.company_comment}
          emptyMessage="Doanh nghiệp chưa nhận xét."
        >
          <p>{report.company_comment}</p>
          <p className="form-hint">Người phản hồi: {mentor?.full_name ?? '—'}</p>
        </InfoCard>
      </div>
    </div>
  )
}

export default AdminReportDetailPage
