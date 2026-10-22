import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isRequired, isValidEmail } from '../../utils/validators'
import * as authApi from '../../api/authApi'
import './LoginPage.css'

// Luôn hiển thị ĐÚNG message server trả về (giống nhau dù email tồn tại hay không — chống dò tài
// khoản, xem server/controllers/authController.js FORGOT_PASSWORD_MESSAGE) — KHÔNG tự suy luận thêm
// ở client (ví dụ không hiển thị "email không tồn tại").
function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!isRequired(email) || !isValidEmail(email)) {
      setError('Vui lòng nhập email hợp lệ.')
      return
    }

    setIsSubmitting(true)
    try {
      const data = await authApi.forgotPassword(email)
      setMessage(data?.message ?? 'Nếu email tồn tại trong hệ thống, một đường link đặt lại mật khẩu đã được gửi tới email đó.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-card">
      <h1>Quên mật khẩu</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ten@example.com"
          disabled={isSubmitting}
        />

        {error && <p className="login-error">{error}</p>}
        {message && <p>{message}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu đặt lại mật khẩu'}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </div>
  )
}

export default ForgotPasswordPage
