import { Outlet } from 'react-router-dom'
import './AuthLayout.css'

function AuthLayout() {
  return (
    <div className="auth-shell">
      <Outlet />
    </div>
  )
}

export default AuthLayout
