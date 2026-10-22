import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_HOME_PATH } from '../../data/mockUsers'
import './LoginPage.css'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    setError('')

    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.')
      return
    }

    setIsSubmitting(true)
    const result = await login(email, password)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    navigate(ROLE_HOME_PATH[result.user.role], { replace: true })
  }

  return (
    <div className="login-card">
      <h1>Hệ thống quản lý thực tập tốt nghiệp</h1>
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

        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          disabled={isSubmitting}
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="login-demo">
        <p>Tài khoản demo:</p>
        <ul>
          <li>Admin: admin@example.com / admin123</li>
          <li>Sinh viên 1: student@example.com / student123</li>
          <li>Sinh viên 2: student2@example.com / student123</li>
          <li>Sinh viên 3: student3@example.com / student123</li>
          <li>Sinh viên 4 (chưa đăng ký thực tập): student4@example.com / student123</li>
          <li>Giảng viên 1: lecturer@example.com / lecturer123</li>
          <li>Giảng viên 2: lecturer2@example.com / lecturer123</li>
          <li>Doanh nghiệp 1 (Mentor Nam, XYZ): company@example.com / company123</li>
          <li>Doanh nghiệp 2 (Mentor Hạnh, FPT): company2@example.com / company123</li>
          <li>Doanh nghiệp 3 (Mentor Kiên, FPT): company3@example.com / company123</li>
        </ul>
      </div>
    </div>
  )
}

export default LoginPage
