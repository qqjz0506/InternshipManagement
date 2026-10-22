import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import LecturerEvaluationForm from '../../components/evaluations/LecturerEvaluationForm'
import { useMyAssignedInternships } from '../../hooks/useMyAssignedInternships'
import { useStudents } from '../../context/StudentsContext'
import { useEvaluations } from '../../context/EvaluationsContext'
import * as exportApi from '../../api/exportApi'
import { triggerBlobDownload } from '../../utils/downloadFile'
import '../../components/common/ListPage.css'

function LecturerEvaluationsPage() {
  const myInternships = useMyAssignedInternships()
  const { items: students } = useStudents()
  const { items: evaluations, isLoading, error } = useEvaluations()

  const [selectedInternship, setSelectedInternship] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    if (isExporting) {
      return
    }
    setExportError('')
    setIsExporting(true)
    try {
      const { blob, filename } = await exportApi.exportEvaluations({})
      triggerBlobDownload(blob, filename ?? 'evaluations.xlsx')
    } catch (err) {
      setExportError(err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const rows = myInternships
    .map((internship) => ({
      id: internship.id,
      internship,
      student: students.find((item) => item.id === internship.student_id),
      evaluation: evaluations.find(
        (evaluation) => evaluation.internship_id === internship.id && evaluation.evaluator_role === 'lecturer',
      ),
    }))
    .filter((row) => row.student)

  const columns = [
    { key: 'student', label: 'Sinh viên', render: (row) => row.student.full_name },
    { key: 'student_code', label: 'MSSV', render: (row) => row.student.student_code },
    {
      key: 'evaluation_status',
      label: 'Trạng thái đánh giá',
      render: (row) => {
        if (!row.evaluation) {
          return <Badge tone="neutral">Chưa đánh giá</Badge>
        }
        return row.evaluation.is_published ? (
          <Badge tone="success">Đã công bố</Badge>
        ) : (
          <Badge tone="warning">Nháp</Badge>
        )
      },
    },
    {
      key: 'overall_score',
      label: 'Điểm tổng',
      render: (row) => row.evaluation?.overall_score ?? '—',
    },
    {
      key: 'actions',
      label: '',
      render: (row) => {
        // Chỉ cho tạo đánh giá mới khi SV đã thực sự bắt đầu thực tập — đánh giá đã có thì vẫn xem/sửa
        // được bình thường dù hồ sơ đổi trạng thái sau đó (nhất quán với KPI "đánh giá cần thực hiện" ở Dashboard).
        const canEvaluate = row.evaluation || ['in_progress', 'completed'].includes(row.internship.status)
        return canEvaluate ? (
          <Button variant="secondary" className="btn-sm" onClick={() => setSelectedInternship(row.internship)}>
            {row.evaluation ? 'Xem / Sửa' : 'Đánh giá'}
          </Button>
        ) : (
          <span className="form-hint">Chưa bắt đầu thực tập</span>
        )
      },
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Đánh giá sinh viên</h2>
        <Button variant="secondary" disabled={isExporting} onClick={handleExport}>
          {isExporting ? 'Đang xuất...' : 'Xuất đánh giá (.xlsx)'}
        </Button>
      </div>

      {error && <p className="form-field-error">{error}</p>}
      {exportError && <p className="form-field-error">{exportError}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={rows} rowKey="id" emptyMessage="Bạn chưa được phân công hướng dẫn sinh viên nào." />
      )}

      <LecturerEvaluationForm
        isOpen={Boolean(selectedInternship)}
        onClose={() => setSelectedInternship(null)}
        internshipId={selectedInternship?.id}
        studentName={
          selectedInternship
            ? students.find((item) => item.id === selectedInternship.student_id)?.full_name ?? ''
            : ''
        }
      />
    </div>
  )
}

export default LecturerEvaluationsPage
