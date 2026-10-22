import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import CompanyReportCommentModal from '../../components/reports/CompanyReportCommentModal'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useStudents } from '../../context/StudentsContext'
import { useReports } from '../../context/ReportsContext'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { downloadReportFile } from '../../utils/reportDownload'
import '../../components/common/ListPage.css'

function CompanyReportsPage() {
  const myInternships = useMyMentoredInternships()
  const { items: students } = useStudents()
  const { items: reports, isLoading, isMutating, error, updateItem } = useReports()

  const [studentFilter, setStudentFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)
  const [commentError, setCommentError] = useState('')

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
        <Badge tone={REPORT_STATUS_META[row.status].tone}>{REPORT_STATUS_META[row.status].label}</Badge>
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
            {row.company_comment ? 'Xem / Sửa nhận xét' : 'Nhận xét'}
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

      <CompanyReportCommentModal
        isOpen={Boolean(selectedReport)}
        onClose={() => {
          setSelectedReport(null)
          setCommentError('')
        }}
        onSubmit={async (reportId, changes) => {
          setCommentError('')
          const result = await updateItem(reportId, changes)
          if (result.success) {
            setSelectedReport(null)
          } else {
            setCommentError(result.message)
          }
        }}
        report={selectedReport}
        studentName={selectedReport ? findStudentByInternship(selectedReport.internship_id)?.full_name ?? '' : ''}
        submitError={commentError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default CompanyReportsPage
