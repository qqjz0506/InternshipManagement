import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import CompanyLogCommentModal from '../../components/internshipLogs/CompanyLogCommentModal'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useStudents } from '../../context/StudentsContext'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { LOG_STATUS_META } from '../../utils/internshipLogStatus'
import '../../components/common/ListPage.css'

function CompanyLogsPage() {
  const myInternships = useMyMentoredInternships()
  const { items: students } = useStudents()
  const { items: logs, isLoading, isMutating, error, updateItem } = useInternshipLogs()

  const [studentFilter, setStudentFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState(null)
  const [commentError, setCommentError] = useState('')

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
      label: 'Trạng thái (GV)',
      render: (row) => <Badge tone={LOG_STATUS_META[row.status].tone}>{LOG_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'company_comment',
      label: 'Nhận xét của bạn',
      render: (row) => (row.company_comment ? <Badge tone="success">Đã nhận xét</Badge> : <Badge tone="neutral">Chưa nhận xét</Badge>),
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

      <CompanyLogCommentModal
        isOpen={Boolean(selectedLog)}
        onClose={() => {
          setSelectedLog(null)
          setCommentError('')
        }}
        onSubmit={async (logId, changes) => {
          setCommentError('')
          const result = await updateItem(logId, changes)
          if (result.success) {
            setSelectedLog(null)
          } else {
            setCommentError(result.message)
          }
        }}
        log={selectedLog}
        studentName={selectedLog ? findStudentByInternship(selectedLog.internship_id)?.full_name ?? '' : ''}
        submitError={commentError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default CompanyLogsPage
