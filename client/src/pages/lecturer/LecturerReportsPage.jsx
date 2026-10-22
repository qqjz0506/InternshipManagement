import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import LecturerReportReviewModal from '../../components/reports/LecturerReportReviewModal'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useStudents } from '../../context/StudentsContext'
import { useReports } from '../../context/ReportsContext'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { downloadReportFile } from '../../utils/reportDownload'
import '../../components/common/ListPage.css'

function LecturerReportsPage() {
  const myInternships = useMyAssignedInternships()
  const { items: students } = useStudents()
  const { items: reports, isLoading, isMutating, error, updateItem } = useReports()

  const [studentFilter, setStudentFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reviewError, setReviewError] = useState('')

  const myInternshipIds = new Set(myInternships.map((internship) => internship.id))

  function findStudentByInternship(internshipId) {
    const internship = myInternships.find((item) => item.id === internshipId)
    return students.find((item) => item.id === internship?.student_id)
  }

  const myReports = reports
    .filter((report) => myInternshipIds.has(report.internship_id))
    .filter(
      (report) =>
        studentFilter === 'all' || String(findStudentByInternship(report.internship_id)?.id) === studentFilter,
    )
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))

  const studentOptions = myInternships
    .map((internship) => students.find((item) => item.id === internship.student_id))
    .filter(Boolean)

  async function handleDownload(report) {
    try {
      await downloadReportFile(report.id, report.file_name)
    } catch (err) {
      window.alert(err.message)
    }
  }

  const columns = [
    {
      key: 'student',
      label: 'Sinh viên',
      render: (row) => findStudentByInternship(row.internship_id)?.full_name ?? '—',
    },
    { key: 'report_type', label: 'Loại', render: (row) => REPORT_TYPE_LABEL[row.report_type] },
    { key: 'submitted_at', label: 'Ngày nộp' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <>
          <Badge tone={REPORT_STATUS_META[row.status].tone}>{REPORT_STATUS_META[row.status].label}</Badge>
          {Boolean(row.is_late) && (
            <Badge tone="danger" className="report-late-badge">
              Nộp trễ
            </Badge>
          )}
        </>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="row-actions">
          <Button
            variant="secondary"
            className="btn-sm"
            disabled={!row.stored_file_name}
            title={row.stored_file_name ? undefined : 'Chưa có file'}
            onClick={() => handleDownload(row)}
          >
            Tải xuống
          </Button>
          <Button variant="secondary" className="btn-sm" onClick={() => setSelectedReport(row)}>
            Nhận xét
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Báo cáo thực tập</h2>
      </div>

      <div className="page-filters">
        <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
          <option value="all">Tất cả sinh viên</option>
          {studentOptions.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={myReports} rowKey="id" emptyMessage="Chưa có báo cáo nào." />
      )}

      <LecturerReportReviewModal
        isOpen={Boolean(selectedReport)}
        onClose={() => {
          setSelectedReport(null)
          setReviewError('')
        }}
        onSubmit={async (reportId, changes) => {
          setReviewError('')
          const result = await updateItem(reportId, changes)
          if (result.success) {
            setSelectedReport(null)
          } else {
            setReviewError(result.message)
          }
        }}
        report={selectedReport}
        studentName={selectedReport ? findStudentByInternship(selectedReport.internship_id)?.full_name ?? '' : ''}
        submitError={reviewError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default LecturerReportsPage
