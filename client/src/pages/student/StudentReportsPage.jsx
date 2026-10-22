import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import FormField from '../../components/common/FormField'
import ReportFormModal from '../../components/reports/ReportFormModal'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useReports } from '../../context/ReportsContext'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'
import { validateReportFile, formatFileSize } from '../../utils/fileValidation'
import { downloadReportFile } from '../../utils/reportDownload'
import '../../components/common/ListPage.css'

function StudentReportsPage() {
  const internship = useMyInternship()
  const { items: reports, isLoading, isMutating, error, addItem, updateItem } = useReports()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Rule upload file thật: Student được nộp lại báo cáo CỦA MÌNH khi status='rejected' — BẮT BUỘC
  // kèm file mới (backend reject 400 nếu không có file thật, xem reportService.update()). Backend tự
  // reset status về 'submitted', xóa reviewer_comment, và xóa file CŨ trên đĩa sau khi thay file mới.
  const [resubmitTarget, setResubmitTarget] = useState(null)
  const [resubmitFile, setResubmitFile] = useState(null)
  const [resubmitError, setResubmitError] = useState('')

  if (!internship) {
    return (
      <div className="list-page">
        <h2>Báo cáo thực tập</h2>
        <p>Bạn chưa có hồ sơ thực tập.</p>
      </div>
    )
  }

  const myReports = reports
    .filter((report) => report.internship_id === internship.id)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))

  function openModal() {
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setSubmitError('')
  }

  function openResubmit(report) {
    setResubmitTarget(report)
    setResubmitFile(null)
    setResubmitError('')
  }

  function closeResubmit() {
    setResubmitTarget(null)
    setResubmitError('')
  }

  function handleResubmitFileChange(event) {
    const selected = event.target.files[0] ?? null
    if (!selected) {
      setResubmitFile(null)
      return
    }
    const validationError = validateReportFile(selected)
    if (validationError) {
      setResubmitError(validationError)
      setResubmitFile(null)
      return
    }
    setResubmitError('')
    setResubmitFile(selected)
  }

  async function handleResubmit(event) {
    event.preventDefault()
    if (isMutating) {
      return
    }
    const validationError = validateReportFile(resubmitFile)
    if (validationError) {
      setResubmitError(validationError)
      return
    }
    const formData = new FormData()
    formData.append('file', resubmitFile)
    const result = await updateItem(resubmitTarget.id, formData)
    if (result.success) {
      closeResubmit()
    } else {
      setResubmitError(result.message)
    }
  }

  // report_type/file do ReportFormModal validate — internship_id chỉ trang này mới biết, nên dựng
  // FormData ở đây (modal không biết gì về internship hiện tại, giữ đúng ranh giới modal/trang cha).
  async function handleSubmit({ report_type, file }) {
    setSubmitError('')
    const formData = new FormData()
    formData.append('internship_id', internship.id)
    formData.append('report_type', report_type)
    formData.append('file', file)
    const result = await addItem(formData)

    if (result.success) {
      setIsModalOpen(false)
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDownload(report) {
    try {
      await downloadReportFile(report.id, report.file_name)
    } catch (err) {
      window.alert(err.message)
    }
  }

  const columns = [
    { key: 'report_type', label: 'Loại báo cáo', render: (row) => REPORT_TYPE_LABEL[row.report_type] },
    {
      key: 'file_name',
      label: 'File',
      render: (row) => (
        <Button
          variant="secondary"
          className="btn-sm"
          disabled={!row.stored_file_name}
          title={row.stored_file_name ? undefined : 'Chưa có file'}
          onClick={() => handleDownload(row)}
        >
          {row.file_name} — Tải xuống
        </Button>
      ),
    },
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
      key: 'reviewer_comment',
      label: 'Nhận xét giảng viên',
      render: (row) => row.reviewer_comment || '—',
    },
    {
      key: 'company_comment',
      label: 'Nhận xét doanh nghiệp',
      render: (row) => row.company_comment || '—',
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.status === 'rejected' ? (
          <Button variant="secondary" onClick={() => openResubmit(row)}>
            Nộp lại
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Báo cáo thực tập</h2>
        <Button onClick={openModal}>+ Nộp báo cáo</Button>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={myReports} rowKey="id" emptyMessage="Chưa có báo cáo nào." />
      )}

      <ReportFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <Modal isOpen={Boolean(resubmitTarget)} onClose={closeResubmit} title="Nộp lại báo cáo">
        <form onSubmit={handleResubmit}>
          <FormField label="Chọn file báo cáo mới (.pdf, .doc, .docx — tối đa 10MB)" htmlFor="resubmit_file" error={resubmitError}>
            <input id="resubmit_file" type="file" accept=".pdf,.doc,.docx" onChange={handleResubmitFileChange} />
          </FormField>
          {resubmitFile && (
            <p className="form-hint">
              Đã chọn: {resubmitFile.name} ({formatFileSize(resubmitFile.size)})
            </p>
          )}
          <div className="modal-footer">
            <Button variant="secondary" onClick={closeResubmit} disabled={isMutating}>
              Hủy
            </Button>
            <Button type="submit" disabled={isMutating}>
              {isMutating ? 'Đang lưu...' : 'Nộp lại'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default StudentReportsPage
