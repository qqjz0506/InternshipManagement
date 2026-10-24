import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = {
  company_id: '',
  period_id: '',
  title: '',
  description: '',
  requirements: '',
  slots: 1,
  status: 'open',
}

// company_id/period_id CHỈ hiển thị lúc TẠO MỚI (immutable sau đó, đúng
// server/services/internshipPositionService.js) — isAdmin: Company Mentor không cần chọn company_id
// (backend tự ép công ty mình), chỉ Admin mới thấy dropdown chọn công ty.
function PositionFormModal({ isOpen, onClose, onSubmit, companies, periods, isAdmin, initialData, submitError, isSubmitting }) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData
          ? { ...EMPTY_FORM, ...initialData, description: initialData.description ?? '', requirements: initialData.requirements ?? '' }
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
    if (!isRequired(formData.title)) {
      nextErrors.title = 'Vui lòng nhập tên vị trí.'
    }
    if (!isEditMode) {
      if (isAdmin && !isRequired(formData.company_id)) {
        nextErrors.company_id = 'Vui lòng chọn doanh nghiệp.'
      }
      if (!isRequired(formData.period_id)) {
        nextErrors.period_id = 'Vui lòng chọn đợt thực tập.'
      }
    }
    const slots = Number(formData.slots)
    if (!Number.isInteger(slots) || slots <= 0) {
      nextErrors.slots = 'Số lượng vị trí phải là số nguyên dương.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    if (isEditMode) {
      onSubmit({ title: formData.title, description: formData.description, requirements: formData.requirements, slots: Number(formData.slots), status: formData.status })
    } else {
      const payload = { period_id: Number(formData.period_id), title: formData.title, description: formData.description, requirements: formData.requirements, slots: Number(formData.slots) }
      if (isAdmin) {
        payload.company_id = Number(formData.company_id)
      }
      onSubmit(payload)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Cập nhật vị trí thực tập' : 'Đăng vị trí thực tập mới'}>
      <form onSubmit={handleSubmit}>
        {!isEditMode && isAdmin && (
          <FormField label="Doanh nghiệp" htmlFor="company_id" error={errors.company_id}>
            <select id="company_id" value={formData.company_id} onChange={(event) => handleChange('company_id', event.target.value)}>
              <option value="">-- Chọn doanh nghiệp --</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_code} - {company.company_name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {!isEditMode && (
          <FormField label="Đợt thực tập" htmlFor="period_id" error={errors.period_id}>
            <select id="period_id" value={formData.period_id} onChange={(event) => handleChange('period_id', event.target.value)}>
              <option value="">-- Chọn đợt thực tập --</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_code} - {period.period_name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="Tên vị trí" htmlFor="title" error={errors.title}>
          <input id="title" value={formData.title} onChange={(event) => handleChange('title', event.target.value)} />
        </FormField>

        <FormField label="Mô tả" htmlFor="description">
          <textarea id="description" rows={3} value={formData.description} onChange={(event) => handleChange('description', event.target.value)} />
        </FormField>

        <FormField label="Yêu cầu" htmlFor="requirements">
          <textarea id="requirements" rows={3} value={formData.requirements} onChange={(event) => handleChange('requirements', event.target.value)} />
        </FormField>

        <FormField label="Số lượng vị trí (slots)" htmlFor="slots" error={errors.slots}>
          <input id="slots" type="number" min="1" value={formData.slots} onChange={(event) => handleChange('slots', event.target.value)} />
        </FormField>

        {isEditMode && (
          <FormField label="Trạng thái" htmlFor="status">
            <select id="status" value={formData.status} onChange={(event) => handleChange('status', event.target.value)}>
              <option value="open">Còn nhận đơn</option>
              <option value="closed">Đã đóng</option>
            </select>
          </FormField>
        )}

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

export default PositionFormModal
