import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'

// Giảng viên KHÔNG được sửa nội dung nhật ký của sinh viên — chỉ đọc + thêm nhận xét.
// Lưu sẽ chuyển status 'submitted' -> 'reviewed', dùng đúng cơ chế khóa mà Student Portal đã có.
function LecturerLogReviewModal({ isOpen, onClose, onSubmit, log, studentName, submitError, isSubmitting }) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (isOpen && log) {
      setComment(log.lecturer_comment ?? '')
    }
  }, [isOpen, log])

  if (!log) {
    return null
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onSubmit(log.id, { lecturer_comment: comment, status: 'reviewed' })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Nhật ký của ${studentName} — ngày ${log.log_date}`}>
      <form onSubmit={handleSubmit}>
        <FormField label="Tiêu đề" htmlFor="log_title">
          <input id="log_title" value={log.title ?? ''} disabled />
        </FormField>

        <FormField label="Nội dung công việc" htmlFor="log_content">
          <textarea id="log_content" rows={3} value={log.content ?? ''} disabled />
        </FormField>

        <FormField label="Kết quả" htmlFor="log_result">
          <textarea id="log_result" rows={2} value={log.result ?? ''} disabled />
        </FormField>

        <FormField label="Khó khăn" htmlFor="log_difficulties">
          <textarea id="log_difficulties" rows={2} value={log.difficulties ?? ''} disabled />
        </FormField>

        <FormField label="Kế hoạch tiếp theo" htmlFor="log_next_plan">
          <textarea id="log_next_plan" rows={2} value={log.next_plan ?? ''} disabled />
        </FormField>

        <FormField label="Tiến độ báo cáo" htmlFor="log_progress">
          <input id="log_progress" value={`${log.progress}%`} disabled />
        </FormField>

        {log.company_comment && (
          <FormField label="Nhận xét của doanh nghiệp" htmlFor="company_comment_readonly">
            <textarea id="company_comment_readonly" rows={2} value={log.company_comment} disabled />
          </FormField>
        )}

        <FormField label="Nhận xét của giảng viên" htmlFor="lecturer_comment">
          <textarea
            id="lecturer_comment"
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

export default LecturerLogReviewModal
