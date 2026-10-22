import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = {
  department_code: '',
  department_name: '',
  description: '',
}

function DepartmentFormModal({ isOpen, onClose, onSubmit, initialData, isCodeTaken, submitError, isSubmitting }) {
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

    if (!isRequired(formData.department_code)) {
      nextErrors.department_code = 'Vui lòng nhập mã khoa.'
    } else if (isCodeTaken(formData.department_code, initialData?.id)) {
      nextErrors.department_code = 'Mã khoa đã tồn tại.'
    }

    if (!isRequired(formData.department_name)) {
      nextErrors.department_name = 'Vui lòng nhập tên khoa.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onSubmit(formData)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Cập nhật khoa / bộ môn' : 'Thêm khoa / bộ môn'}>
      <form onSubmit={handleSubmit}>
        <FormField label="Mã khoa" htmlFor="department_code" error={errors.department_code}>
          <input
            id="department_code"
            value={formData.department_code}
            onChange={(event) => handleChange('department_code', event.target.value)}
          />
        </FormField>

        <FormField label="Tên khoa" htmlFor="department_name" error={errors.department_name}>
          <input
            id="department_name"
            value={formData.department_name}
            onChange={(event) => handleChange('department_name', event.target.value)}
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

export default DepartmentFormModal
