import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired, isValidEmail, isValidPhone } from '../../utils/validators'

const EMPTY_FORM = {
  company_code: '',
  company_name: '',
  tax_code: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  representative: '',
  status: 'active',
}

function CompanyFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isCodeTaken,
  isTaxCodeTaken,
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

    if (!isRequired(formData.company_code)) {
      nextErrors.company_code = 'Vui lòng nhập mã doanh nghiệp.'
    } else if (isCodeTaken(formData.company_code, initialData?.id)) {
      nextErrors.company_code = 'Mã doanh nghiệp đã tồn tại.'
    }

    if (!isRequired(formData.company_name)) {
      nextErrors.company_name = 'Vui lòng nhập tên doanh nghiệp.'
    }

    if (!isRequired(formData.tax_code)) {
      nextErrors.tax_code = 'Vui lòng nhập mã số thuế.'
    } else if (isTaxCodeTaken(formData.tax_code, initialData?.id)) {
      nextErrors.tax_code = 'Mã số thuế đã tồn tại.'
    }

    if (!isRequired(formData.address)) {
      nextErrors.address = 'Vui lòng nhập địa chỉ.'
    }

    if (formData.email && !isValidEmail(formData.email)) {
      nextErrors.email = 'Email không hợp lệ.'
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      nextErrors.phone = 'Số điện thoại không hợp lệ.'
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Cập nhật doanh nghiệp' : 'Thêm doanh nghiệp'}
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Mã doanh nghiệp" htmlFor="company_code" error={errors.company_code}>
          <input
            id="company_code"
            value={formData.company_code}
            onChange={(event) => handleChange('company_code', event.target.value)}
          />
        </FormField>

        <FormField label="Tên doanh nghiệp" htmlFor="company_name" error={errors.company_name}>
          <input
            id="company_name"
            value={formData.company_name}
            onChange={(event) => handleChange('company_name', event.target.value)}
          />
        </FormField>

        <FormField label="Mã số thuế" htmlFor="tax_code" error={errors.tax_code}>
          <input
            id="tax_code"
            value={formData.tax_code}
            onChange={(event) => handleChange('tax_code', event.target.value)}
          />
        </FormField>

        <FormField label="Địa chỉ" htmlFor="address" error={errors.address}>
          <input
            id="address"
            value={formData.address}
            onChange={(event) => handleChange('address', event.target.value)}
          />
        </FormField>

        <FormField label="Số điện thoại" htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            value={formData.phone}
            onChange={(event) => handleChange('phone', event.target.value)}
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

        <FormField label="Website" htmlFor="website">
          <input
            id="website"
            value={formData.website}
            onChange={(event) => handleChange('website', event.target.value)}
          />
        </FormField>

        <FormField label="Người đại diện" htmlFor="representative">
          <input
            id="representative"
            value={formData.representative}
            onChange={(event) => handleChange('representative', event.target.value)}
          />
        </FormField>

        <FormField label="Trạng thái" htmlFor="status">
          <select
            id="status"
            value={formData.status}
            onChange={(event) => handleChange('status', event.target.value)}
          >
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

export default CompanyFormModal
