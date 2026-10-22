import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormField from '../components/common/FormField'
import Button from '../components/common/Button'
import { isRequired } from '../utils/validators'
import * as authApi from '../api/authApi'
import { useAuth } from '../context/AuthContext'
import '../components/common/ListPage.css'

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmNewPassword: '' }

// Trang dùng chung cho cả 4 role (route /change-password, không gắn riêng 1 nhóm role nào) — gọi
// trực tiếp authApi (không qua Context, vì đây không phải 1 "entity" có list/CRUD, chỉ 1 hành động
// đơn lẻ của chính tài khoản đang đăng nhập).
function ChangePasswordPage() {
  const { currentUser, refreshCurrentUser } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [emailNotifications, setEmailNotifications] = useState(Boolean(currentUser?.emailNotifications))
  const [isSavingEmailPref, setIsSavingEmailPref] = useState(false)
  const [emailPrefError, setEmailPrefError] = useState('')

  async function handleToggleEmailNotifications(event) {
    const nextValue = event.target.checked
    setEmailNotifications(nextValue)
    setEmailPrefError('')
    setIsSavingEmailPref(true)
    try {
      await authApi.setEmailNotifications(nextValue)
      await refreshCurrentUser()
    } catch (err) {
      setEmailNotifications(!nextValue)
      setEmailPrefError(err.message)
    } finally {
      setIsSavingEmailPref(false)
    }
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccessMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!isRequired(formData.currentPassword) || !isRequired(formData.newPassword)) {
      setError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.')
      return
    }
    if (formData.newPassword !== formData.confirmNewPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu mới không khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.changePassword(formData.currentPassword, formData.newPassword)
      setFormData(EMPTY_FORM)
      setSuccessMessage('Đổi mật khẩu thành công.')
      // Đồng bộ lại currentUser.mustChangePassword (server đã tắt cờ) — để ProtectedRoute hết chặn
      // ngay, không cần F5/đăng nhập lại. Nếu lúc vào đây là BỊ BẮT đổi (mustChangePassword=true),
      // điều hướng thẳng về trang chủ (RootRedirect sẽ tự đưa đúng dashboard theo role).
      const wasForced = currentUser?.mustChangePassword
      const updated = await refreshCurrentUser()
      if (wasForced && !updated.mustChangePassword) {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Đổi mật khẩu</h2>
      </div>

      {currentUser?.mustChangePassword && (
        <p className="form-field-error">
          Tài khoản của bạn đang dùng mật khẩu tạm do Admin cấp — bắt buộc đổi mật khẩu trước khi tiếp tục sử dụng
          hệ thống.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
        <FormField label="Mật khẩu hiện tại" htmlFor="currentPassword">
          <input
            id="currentPassword"
            type="password"
            value={formData.currentPassword}
            onChange={(event) => handleChange('currentPassword', event.target.value)}
          />
        </FormField>

        <FormField label="Mật khẩu mới" htmlFor="newPassword">
          <input
            id="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={(event) => handleChange('newPassword', event.target.value)}
          />
        </FormField>
        <p className="form-hint">Tối thiểu 8 ký tự, bao gồm cả chữ và số, khác mật khẩu hiện tại.</p>

        <FormField label="Xác nhận mật khẩu mới" htmlFor="confirmNewPassword">
          <input
            id="confirmNewPassword"
            type="password"
            value={formData.confirmNewPassword}
            onChange={(event) => handleChange('confirmNewPassword', event.target.value)}
          />
        </FormField>

        {error && <p className="form-field-error">{error}</p>}
        {successMessage && <p className="form-hint">{successMessage}</p>}

        <div className="modal-footer">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </Button>
        </div>
      </form>

      <div style={{ maxWidth: 420, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={handleToggleEmailNotifications}
            disabled={isSavingEmailPref}
          />
          Nhận email khi có thông báo mới
        </label>
        {emailPrefError && <p className="form-field-error">{emailPrefError}</p>}
      </div>
    </div>
  )
}

export default ChangePasswordPage
