import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'

// Company Mentor CHỈ được thêm company_comment — không được sửa nội dung, ngày, hay status
// (status chỉ phản ánh việc Lecturer đã nhận xét hay chưa, Company không đụng vào cơ chế khóa đó).
function CompanyLogCommentModal({ isOpen, onClose, onSubmit, log, studentName, submitError, isSubmitting }) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (isOpen && log) {
      setComment(log.company_comment ?? '')
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
    onSubmit(log.id, { company_comment: comment })
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

        <FormField label="Tiến độ báo cáo" htmlFor="log_progress">
          <input id="log_progress" value={`${log.progress}%`} disabled />
        </FormField>

        {log.lecturer_comment && (
          <FormField label="Nhận xét của giảng viên" htmlFor="lecturer_comment_readonly">
            <textarea id="lecturer_comment_readonly" rows={2} value={log.lecturer_comment} disabled />
          </FormField>
        )}

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

export default CompanyLogCommentModal
