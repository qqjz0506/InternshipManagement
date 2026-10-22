import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import LecturerLogReviewModal from '../../components/internshipLogs/LecturerLogReviewModal'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useStudents } from '../../context/StudentsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { LOG_STATUS_META } from '../../utils/internshipLogStatus'
import '../../components/common/ListPage.css'

function LecturerLogsPage() {
  const myInternships = useMyAssignedInternships()
  const { items: students } = useStudents()
  const { items: logs, isLoading, isMutating, error, updateItem } = useInternshipLogs()

  const [studentFilter, setStudentFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState(null)
  const [reviewError, setReviewError] = useState('')

  const myInternshipIds = new Set(myInternships.map((internship) => internship.id))

  function findStudentByInternship(internshipId) {
    const internship = myInternships.find((item) => item.id === internshipId)
    return students.find((item) => item.id === internship?.student_id)
  }

  const myLogs = logs
    .filter((log) => myInternshipIds.has(log.internship_id))
    .filter(
      (log) => studentFilter === 'all' || String(findStudentByInternship(log.internship_id)?.id) === studentFilter,
    )
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))

  const studentOptions = myInternships
    .map((internship) => students.find((item) => item.id === internship.student_id))
    .filter(Boolean)

  const columns = [
    { key: 'student', label: 'Sinh viên', render: (row) => findStudentByInternship(row.internship_id)?.full_name ?? '—' },
    { key: 'log_date', label: 'Ngày' },
    { key: 'title', label: 'Tiêu đề' },
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

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Nhật ký thực tập</h2>
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
        <DataTable columns={columns} data={myLogs} rowKey="id" emptyMessage="Chưa có nhật ký nào." />
      )}

      <LecturerLogReviewModal
        isOpen={Boolean(selectedLog)}
        onClose={() => {
          setSelectedLog(null)
          setReviewError('')
        }}
        onSubmit={async (logId, changes) => {
          setReviewError('')
          const result = await updateItem(logId, changes)
          if (result.success) {
            setSelectedLog(null)
          } else {
            setReviewError(result.message)
          }
        }}
        log={selectedLog}
        studentName={selectedLog ? findStudentByInternship(selectedLog.internship_id)?.full_name ?? '' : ''}
        submitError={reviewError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default LecturerLogsPage
