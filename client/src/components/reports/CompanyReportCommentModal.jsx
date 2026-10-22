import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { REPORT_TYPE_LABEL, REPORT_STATUS_META } from '../../utils/reportStatus'

// Company Mentor chỉ xem + thêm company_comment — không đổi status/nội dung/người nộp (mục 10).
function CompanyReportCommentModal({ isOpen, onClose, onSubmit, report, studentName, submitError, isSubmitting }) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (isOpen && report) {
      setComment(report.company_comment ?? '')
    }
  }, [isOpen, report])

  if (!report) {
    return null
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onSubmit(report.id, { company_comment: comment })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Báo cáo của ${studentName}`}>
      <form onSubmit={handleSubmit}>
        <FormField label="Loại báo cáo" htmlFor="report_type">
          <input id="report_type" value={REPORT_TYPE_LABEL[report.report_type]} disabled />
        </FormField>

        <FormField label="File đính kèm" htmlFor="file_name">
          <input id="file_name" value={report.file_name} disabled />
        </FormField>

        <FormField label="Ngày nộp" htmlFor="submitted_at">
          <input id="submitted_at" value={report.submitted_at} disabled />
        </FormField>

        <FormField label="Trạng thái (do giảng viên/admin quản lý)" htmlFor="status">
          <input id="status" value={REPORT_STATUS_META[report.status].label} disabled />
        </FormField>

        <FormField label="Nhận xét của doanh nghiệp" htmlFor="company_comment">
          <textarea
            id="company_comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </FormField>

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu nhận xét'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CompanyReportCommentModal
