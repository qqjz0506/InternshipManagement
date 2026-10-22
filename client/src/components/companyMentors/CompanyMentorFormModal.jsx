import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired, isValidEmail, isValidPhone } from '../../utils/validators'

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  company_id: '',
  position: '',
  status: 'active',
}

// Không có field mã/code cho CompanyMentor (khác Lecturer) — email là định danh duy nhất, phải unique.
// KHÔNG có input cho user_id: việc liên kết tài khoản thuộc quy trình riêng ở Admin Accounts (mục 5/9).
function CompanyMentorFormModal({
  isOpen,
  onClose,
  onSubmit,
  companies,
  initialData,
  isEmailTaken,
  submitError,
  isSubmitting,
}) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      // Giữ nguyên cả initialData.user_id dù form không có input cho nó — PUT backend là full
      // replace (không phải merge), nếu chỉ lấy đúng 6 field hiển thị trên form thì user_id sẽ bị
      // gửi thành undefined -> backend ghi đè thành NULL, âm thầm gỡ liên kết tài khoản mỗi khi Admin
      // sửa bất kỳ field nào khác (mismatch phát hiện ở Phase 4B-3, mục 2 report).
      setFormData(initialData ?? EMPTY_FORM)
      setErrors({})
    }
  }, [isOpen, initialData])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.full_name)) {
      nextErrors.full_name = 'Vui lòng nhập họ tên.'
    }

    if (!isRequired(formData.email)) {
      nextErrors.email = 'Vui lòng nhập email.'
    } else if (!isValidEmail(formData.email)) {
      nextErrors.email = 'Email không hợp lệ.'
    } else if (isEmailTaken(formData.email, initialData?.id)) {
      nextErrors.email = 'Email đã được dùng cho người hướng dẫn khác.'
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      nextErrors.phone = 'Số điện thoại không hợp lệ.'
    }

    if (!isRequired(formData.company_id)) {
      nextErrors.company_id = 'Vui lòng chọn doanh nghiệp.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onSubmit({ ...formData, company_id: Number(formData.company_id) })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Cập nhật người hướng dẫn' : 'Thêm người hướng dẫn'}
    >
      <form onSubmit={handleSubmit}>
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

        <FormField label="Doanh nghiệp" htmlFor="company_id" error={errors.company_id}>
          <select
            id="company_id"
            value={formData.company_id}
            onChange={(event) => handleChange('company_id', event.target.value)}
          >
            <option value="">-- Chọn doanh nghiệp --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
        </FormField>

        {isEditMode && (
          <p className="form-hint">
            Đổi doanh nghiệp sẽ tự động gỡ phân công khỏi các hồ sơ thực tập đang dùng người hướng dẫn này
            (vì mentor không còn thuộc doanh nghiệp cũ).
          </p>
        )}

        <FormField label="Chức vụ" htmlFor="position">
          <input
            id="position"
            value={formData.position}
            onChange={(event) => handleChange('position', event.target.value)}
          />
        </FormField>

        <FormField label="Trạng thái" htmlFor="status">
          <select id="status" value={formData.status} onChange={(event) => handleChange('status', event.target.value)}>
            <option value="active">Đang hợp tác</option>
            <option value="inactive">Ngừng hợp tác</option>
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

export default CompanyMentorFormModal
