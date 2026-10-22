import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = {
  period_code: '',
  period_name: '',
  start_date: '',
  end_date: '',
  log_frequency_days: 7,
  final_report_deadline: '',
  evaluation_deadline: '',
  status: 'upcoming',
  description: '',
}

function PeriodFormModal({ isOpen, onClose, onSubmit, initialData, isCodeTaken, submitError, isSubmitting }) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      // final_report_deadline/evaluation_deadline có thể là `null` từ API (chưa đặt hạn) — input
      // type="date" không chấp nhận value={null} (React warning), phải chuẩn hóa về '' khi điền form.
      setFormData(
        initialData
          ? { ...initialData, final_report_deadline: initialData.final_report_deadline ?? '', evaluation_deadline: initialData.evaluation_deadline ?? '' }
          : EMPTY_FORM,
      )
      setErrors({})
    }
  }, [isOpen, initialData])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.period_code)) {
      nextErrors.period_code = 'Vui lòng nhập mã đợt thực tập.'
    } else if (isCodeTaken(formData.period_code, initialData?.id)) {
      nextErrors.period_code = 'Mã đợt thực tập đã tồn tại.'
    }

    if (!isRequired(formData.period_name)) {
      nextErrors.period_name = 'Vui lòng nhập tên đợt thực tập.'
    }

    if (!isRequired(formData.start_date)) {
      nextErrors.start_date = 'Vui lòng chọn ngày bắt đầu.'
    }

    if (!isRequired(formData.end_date)) {
      nextErrors.end_date = 'Vui lòng chọn ngày kết thúc.'
    }

    if (
      isRequired(formData.start_date) &&
      isRequired(formData.end_date) &&
      formData.start_date > formData.end_date
    ) {
      nextErrors.end_date = 'Ngày kết thúc phải sau ngày bắt đầu.'
    }

    if (isRequired(formData.log_frequency_days)) {
      const num = Number(formData.log_frequency_days)
      if (!Number.isInteger(num) || num <= 0) {
        nextErrors.log_frequency_days = 'Số ngày giữa 2 lần ghi nhật ký phải là số nguyên dương.'
      }
    }

    ;['final_report_deadline', 'evaluation_deadline'].forEach((field) => {
      if (isRequired(formData[field]) && isRequired(formData.start_date) && formData[field] < formData.start_date) {
        nextErrors[field] = 'Phải nằm trong hoặc sau ngày bắt đầu đợt.'
      }
    })

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onSubmit({ ...formData, log_frequency_days: Number(formData.log_frequency_days) })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Cập nhật đợt thực tập' : 'Thêm đợt thực tập'}>
      <form onSubmit={handleSubmit}>
        <FormField label="Mã đợt" htmlFor="period_code" error={errors.period_code}>
          <input
            id="period_code"
            value={formData.period_code}
            onChange={(event) => handleChange('period_code', event.target.value)}
          />
        </FormField>

        <FormField label="Tên đợt thực tập" htmlFor="period_name" error={errors.period_name}>
          <input
            id="period_name"
            value={formData.period_name}
            onChange={(event) => handleChange('period_name', event.target.value)}
          />
        </FormField>

        <FormField label="Ngày bắt đầu" htmlFor="start_date" error={errors.start_date}>
          <input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(event) => handleChange('start_date', event.target.value)}
          />
        </FormField>

        <FormField label="Ngày kết thúc" htmlFor="end_date" error={errors.end_date}>
          <input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(event) => handleChange('end_date', event.target.value)}
          />
        </FormField>

        <FormField label="Trạng thái" htmlFor="status">
          <select id="status" value={formData.status} onChange={(event) => handleChange('status', event.target.value)}>
            <option value="upcoming">Sắp diễn ra</option>
            <option value="ongoing">Đang diễn ra</option>
            <option value="closed">Đã kết thúc</option>
          </select>
        </FormField>

        <FormField
          label="Số ngày tối đa giữa 2 lần ghi nhật ký"
          htmlFor="log_frequency_days"
          error={errors.log_frequency_days}
        >
          <input
            id="log_frequency_days"
            type="number"
            min="1"
            value={formData.log_frequency_days}
            onChange={(event) => handleChange('log_frequency_days', event.target.value)}
          />
        </FormField>

        <FormField label="Hạn nộp báo cáo tổng kết (tùy chọn)" htmlFor="final_report_deadline" error={errors.final_report_deadline}>
          <input
            id="final_report_deadline"
            type="date"
            value={formData.final_report_deadline}
            onChange={(event) => handleChange('final_report_deadline', event.target.value)}
          />
        </FormField>

        <FormField label="Hạn hoàn tất đánh giá (tùy chọn)" htmlFor="evaluation_deadline" error={errors.evaluation_deadline}>
          <input
            id="evaluation_deadline"
            type="date"
            value={formData.evaluation_deadline}
            onChange={(event) => handleChange('evaluation_deadline', event.target.value)}
          />
        </FormField>

        <FormField label="Mô tả" htmlFor="description">
          <textarea
            id="description"
            rows={3}
            value={formData.description}
            onChange={(event) => handleChange('description', event.target.value)}
          />
        </FormField>

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default PeriodFormModal
