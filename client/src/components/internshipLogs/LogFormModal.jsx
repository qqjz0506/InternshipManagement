import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = {
  log_date: '',
  title: '',
  content: '',
  result: '',
  difficulties: '',
  next_plan: '',
  note: '',
  progress: 0,
}

// readOnly = true khi nhật ký đã được giảng viên nhận xét (status 'reviewed') — sinh viên chỉ xem, không sửa được nữa.
function LogFormModal({ isOpen, onClose, onSubmit, initialData, readOnly, submitError, isSubmitting }) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData ?? EMPTY_FORM)
      setErrors({})
    }
  }, [isOpen, initialData])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.log_date)) {
      nextErrors.log_date = 'Vui lòng chọn ngày.'
    }

    if (!isRequired(formData.title)) {
      nextErrors.title = 'Vui lòng nhập tiêu đề.'
    }

    if (!isRequired(formData.content)) {
      nextErrors.content = 'Vui lòng nhập nội dung công việc.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (readOnly) {
      onClose()
      return
    }
    if (isSubmitting) {
      return
    }
    if (!validate()) {
      return
    }
    onSubmit({
      ...formData,
      progress: Math.min(100, Math.max(0, Number(formData.progress) || 0)),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={readOnly ? 'Xem nhật ký thực tập' : isEditMode ? 'Cập nhật nhật ký' : 'Thêm nhật ký thực tập'}
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Ngày" htmlFor="log_date" error={errors.log_date}>
          <input
            id="log_date"
            type="date"
            value={formData.log_date}
            disabled={readOnly}
            onChange={(event) => handleChange('log_date', event.target.value)}
          />
        </FormField>

        <FormField label="Tiêu đề" htmlFor="title" error={errors.title}>
          <input
            id="title"
            value={formData.title}
            disabled={readOnly}
            onChange={(event) => handleChange('title', event.target.value)}
          />
        </FormField>

        <FormField label="Nội dung công việc" htmlFor="content" error={errors.content}>
          <textarea
            id="content"
            rows={3}
            value={formData.content}
            disabled={readOnly}
            onChange={(event) => handleChange('content', event.target.value)}
          />
        </FormField>

        <FormField label="Kết quả" htmlFor="result">
          <textarea
            id="result"
            rows={2}
            value={formData.result}
            disabled={readOnly}
            onChange={(event) => handleChange('result', event.target.value)}
          />
        </FormField>

        <FormField label="Khó khăn" htmlFor="difficulties">
          <textarea
            id="difficulties"
            rows={2}
            value={formData.difficulties}
            disabled={readOnly}
            onChange={(event) => handleChange('difficulties', event.target.value)}
          />
        </FormField>

        <FormField label="Kế hoạch tiếp theo" htmlFor="next_plan">
          <textarea
            id="next_plan"
            rows={2}
            value={formData.next_plan}
            disabled={readOnly}
            onChange={(event) => handleChange('next_plan', event.target.value)}
          />
        </FormField>

        <FormField label="Ghi chú" htmlFor="note">
          <input
            id="note"
            value={formData.note}
            disabled={readOnly}
            onChange={(event) => handleChange('note', event.target.value)}
          />
        </FormField>

        <FormField label="Tiến độ (%)" htmlFor="progress">
          <input
            id="progress"
            type="number"
            min="0"
            max="100"
            value={formData.progress}
            disabled={readOnly}
            onChange={(event) => handleChange('progress', event.target.value)}
          />
        </FormField>

        {formData.lecturer_comment && (
          <FormField label="Nhận xét của giảng viên" htmlFor="lecturer_comment">
            <textarea id="lecturer_comment" rows={2} value={formData.lecturer_comment} disabled />
          </FormField>
        )}

        {formData.company_comment && (
          <FormField label="Nhận xét của doanh nghiệp" htmlFor="company_comment_readonly">
            <textarea id="company_comment_readonly" rows={2} value={formData.company_comment} disabled />
          </FormField>
        )}

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {readOnly ? 'Đóng' : 'Hủy'}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default LogFormModal
