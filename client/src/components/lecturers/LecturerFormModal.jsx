import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired, isValidEmail, isValidPhone } from '../../utils/validators'

const EMPTY_FORM = {
  lecturer_code: '',
  full_name: '',
  email: '',
  phone: '',
  department_id: '',
  position: '',
  status: 'active',
}

function LecturerFormModal({
  isOpen,
  onClose,
  onSubmit,
  departments,
  initialData,
  isCodeTaken,
  submitError,
  isSubmitting,
}) {
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

    if (!isRequired(formData.lecturer_code)) {
      nextErrors.lecturer_code = 'Vui lòng nhập mã giảng viên.'
    } else if (isCodeTaken(formData.lecturer_code, initialData?.id)) {
      nextErrors.lecturer_code = 'Mã giảng viên đã tồn tại.'
    }

    if (!isRequired(formData.full_name)) {
      nextErrors.full_name = 'Vui lòng nhập họ tên.'
    }

    if (!isRequired(formData.email)) {
      nextErrors.email = 'Vui lòng nhập email.'
    } else if (!isValidEmail(formData.email)) {
      nextErrors.email = 'Email không hợp lệ.'
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      nextErrors.phone = 'Số điện thoại không hợp lệ.'
    }

    if (!isRequired(formData.department_id)) {
      nextErrors.department_id = 'Vui lòng chọn khoa.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onSubmit({ ...formData, department_id: Number(formData.department_id) })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Cập nhật giảng viên' : 'Thêm giảng viên'}
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Mã giảng viên" htmlFor="lecturer_code" error={errors.lecturer_code}>
          <input
            id="lecturer_code"
            value={formData.lecturer_code}
            onChange={(event) => handleChange('lecturer_code', event.target.value)}
          />
        </FormField>

        <FormField label="Họ tên" htmlFor="full_name" error={errors.full_name}>
          <input
            id="full_name"
            value={formData.full_name}
            onChange={(event) => handleChange('full_name', event.target.value)}
          />
        </FormField>

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(event) => handleChange('email', event.target.value)}
          />
        </FormField>

        <FormField label="Số điện thoại" htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            value={formData.phone}
            onChange={(event) => handleChange('phone', event.target.value)}
          />
        </FormField>

        <FormField label="Khoa" htmlFor="department_id" error={errors.department_id}>
          <select
            id="department_id"
            value={formData.department_id}
            onChange={(event) => handleChange('department_id', event.target.value)}
          >
            <option value="">-- Chọn khoa --</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.department_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Học hàm / Học vị" htmlFor="position">
          <input
            id="position"
            value={formData.position}
            onChange={(event) => handleChange('position', event.target.value)}
            placeholder="Giảng viên, Tiến sĩ, Phó giáo sư..."
          />
        </FormField>

        <FormField label="Trạng thái" htmlFor="status">
          <select
            id="status"
            value={formData.status}
            onChange={(event) => handleChange('status', event.target.value)}
          >
            <option value="active">Đang công tác</option>
            <option value="inactive">Đã nghỉ</option>
          </select>
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

export default LecturerFormModal
