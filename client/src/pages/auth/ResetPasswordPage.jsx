import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isRequired } from '../../utils/validators'
import * as authApi from '../../api/authApi'
import './LoginPage.css'

// token đọc từ query string (?token=...) — đúng link server gửi qua email (xem
// server/services/passwordResetService.js buildResetEmail: `${CLIENT_URL}/reset-password?token=...`).
function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('Thiếu token đặt lại mật khẩu — vui lòng dùng đúng đường link trong email.')
      return
    }
    if (!isRequired(newPassword)) {
      setError('Vui lòng nhập mật khẩu mới.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.resetPassword(token, newPassword)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-card">
      <h1>Đặt lại mật khẩu</h1>

      {!token && <p className="login-error">Thiếu token — vui lòng mở đúng đường link trong email.</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="newPassword">Mật khẩu mới</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={isSubmitting}
        />

        <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </div>
  )
}

export default ResetPasswordPage
