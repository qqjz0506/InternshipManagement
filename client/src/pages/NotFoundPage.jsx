import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <h1>404</h1>
      <p>Không tìm thấy trang bạn yêu cầu.</p>
      <Link to="/">Về trang chủ</Link>
    </div>
  )
}

export default NotFoundPage
