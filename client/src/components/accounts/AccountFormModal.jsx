import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { ROLE_LABELS } from '../../data/mockUsers'
import { isRequired, isValidEmail } from '../../utils/validators'

const EMPTY_FORM = { fullName: '', email: '', password: '', role: 'student', linkedProfileId: '' }

// Role/đối tượng liên kết CHỈ chọn được lúc tạo mới — sửa tài khoản chỉ đổi họ tên/email/mật khẩu,
// tránh đổi role sau khi đã tạo gây lệch dữ liệu (backend cũng reject cứng role/profile_id ở PUT,
// Phase 4F-1 mục 16 — UI khóa field này chỉ là lớp UX, không phải chốt chặn an toàn duy nhất).
function AccountFormModal({ isOpen, onClose, onSubmit, initialData, isEmailTaken, unlinkedByRole, submitError, isSubmitting }) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      // Backend không bao giờ trả password/password_hash (Phase 4F-1) — không còn gì để pre-fill.
      // password luôn bắt đầu rỗng; rỗng lúc submit (edit mode) nghĩa là "giữ nguyên mật khẩu cũ".
      setFormData(
        initialData
          ? { fullName: initialData.fullName, email: initialData.email, password: '', role: initialData.role, linkedProfileId: '' }
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

    if (!isRequired(formData.fullName)) {
      nextErrors.fullName = 'Vui lòng nhập họ tên.'
    }

    if (!isRequired(formData.email)) {
      nextErrors.email = 'Vui lòng nhập email.'
    } else if (!isValidEmail(formData.email)) {
      nextErrors.email = 'Email không hợp lệ.'
    } else if (isEmailTaken(formData.email, initialData?.id)) {
      nextErrors.email = 'Email đã được dùng cho tài khoản khác.'
    }

    // Tạo mới: bắt buộc nhập mật khẩu. Sửa: để trống = giữ nguyên mật khẩu cũ, không bắt buộc.
    if (!isEditMode && !isRequired(formData.password)) {
      nextErrors.password = 'Vui lòng nhập mật khẩu.'
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
      const payload = { fullName: formData.fullName, email: formData.email }
      if (formData.password) {
        payload.password = formData.password
      }
      onSubmit(payload)
      return
    }
    onSubmit({
      fullName: formData.fullName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      linkedProfileId: formData.linkedProfileId || null,
    })
  }

  const candidateProfiles = unlinkedByRole[formData.role] ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}>
      <form onSubmit={handleSubmit}>
        <FormField label="Họ tên" htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            value={formData.fullName}
            onChange={(event) => handleChange('fullName', event.target.value)}
          />
        </FormField>

        <FormField label="Email đăng nhập" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(event) => handleChange('email', event.target.value)}
          />
        </FormField>

        <FormField
          label={isEditMode ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
          htmlFor="password"
          error={errors.password}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={(event) => handleChange('password', event.target.value)}
          />
        </FormField>

        {isEditMode ? (
          <FormField label="Vai trò" htmlFor="role_readonly">
            <input id="role_readonly" value={ROLE_LABELS[formData.role]} disabled />
          </FormField>
        ) : (
          <>
            <FormField label="Vai trò" htmlFor="role">
              <select
                id="role"
                value={formData.role}
                onChange={(event) => handleChange('role', event.target.value)}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>

            {formData.role !== 'admin' && (
              <FormField label="Liên kết với hồ sơ (tùy chọn)" htmlFor="linkedProfileId">
                <select
                  id="linkedProfileId"
                  value={formData.linkedProfileId}
                  onChange={(event) => handleChange('linkedProfileId', event.target.value)}
                >
                  <option value="">-- Chưa liên kết --</option>
                  {candidateProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </>
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

export default AccountFormModal
