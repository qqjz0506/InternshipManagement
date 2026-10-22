import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { validateReportFile, formatFileSize } from '../../utils/fileValidation'

const EMPTY_FORM = { report_type: 'weekly' }

// Upload file thật (server/config/upload.js) — onSubmit nhận { report_type, file } (File object),
// trang cha (StudentReportsPage.jsx) tự dựng FormData kèm internship_id (modal không biết internship
// nào, giữ đúng ranh giới cũ: modal chỉ lo input, trang cha lo gọi API).
function ReportFormModal({ isOpen, onClose, onSubmit, submitError, isSubmitting }) {
  const [reportType, setReportType] = useState(EMPTY_FORM.report_type)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setReportType(EMPTY_FORM.report_type)
      setFile(null)
      setError('')
    }
  }, [isOpen])

  function handleFileChange(event) {
    const selected = event.target.files[0] ?? null
    if (!selected) {
      setFile(null)
      return
    }
    const validationError = validateReportFile(selected)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }
    setError('')
    setFile(selected)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    const validationError = validateReportFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    onSubmit({ report_type: reportType, file })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nộp báo cáo thực tập">
      <form onSubmit={handleSubmit}>
        <FormField label="Loại báo cáo" htmlFor="report_type">
          <select
            id="report_type"
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            <option value="weekly">Báo cáo tuần</option>
            <option value="final">Báo cáo tổng kết</option>
          </select>
        </FormField>

        <FormField label="File báo cáo (.pdf, .doc, .docx — tối đa 10MB)" htmlFor="file" error={error}>
          <input id="file" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
        </FormField>

        {file && (
          <p className="form-hint">
            Đã chọn: {file.name} ({formatFileSize(file.size)})
          </p>
        )}

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang nộp...' : 'Nộp báo cáo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ReportFormModal
