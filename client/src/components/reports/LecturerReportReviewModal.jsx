import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { REPORT_TYPE_LABEL } from '../../utils/reportStatus'

// Chỉ dùng lại đúng 4 status đã có (draft/submitted/approved/rejected) — không tự tạo thêm status mới.
// 'draft' là trạng thái riêng của sinh viên trước khi nộp nên không cho Lecturer chọn.
const LECTURER_SELECTABLE_STATUSES = ['submitted', 'approved', 'rejected']
const STATUS_OPTION_LABEL = {
  submitted: 'Đã nộp (chưa duyệt)',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

function LecturerReportReviewModal({ isOpen, onClose, onSubmit, report, studentName, submitError, isSubmitting }) {
  const [status, setStatus] = useState('submitted')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (isOpen && report) {
      setStatus(report.status === 'draft' ? 'submitted' : report.status)
      setComment(report.reviewer_comment ?? '')
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
    onSubmit(report.id, { status, reviewer_comment: comment })
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

        <FormField label="Trạng thái" htmlFor="status">
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {LECTURER_SELECTABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_OPTION_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Nhận xét" htmlFor="reviewer_comment">
          <textarea
            id="reviewer_comment"
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
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default LecturerReportReviewModal
