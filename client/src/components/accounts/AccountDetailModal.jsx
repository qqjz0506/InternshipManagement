import { Fragment, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useUsers } from '../../context/UsersContext'

// Chỉ đọc — không hiển thị password (mục 8). account do trang cha chuẩn bị sẵn (đã join profile).
// "Đặt lại mật khẩu": sinh mật khẩu tạm ngẫu nhiên (userService.resetPassword), hiển thị ĐÚNG 1 LẦN
// ngay trong modal này để Admin chép lại đưa cho người dùng — không lưu lại ở đâu khác trên client.
function AccountDetailModal({ isOpen, onClose, account }) {
  const { resetPassword, isMutating } = useUsers()
  const [resetResult, setResetResult] = useState(null)
  const [resetError, setResetError] = useState('')

  if (!account) {
    return null
  }

  async function handleResetPassword() {
    const confirmed = window.confirm(
      `Đặt lại mật khẩu cho tài khoản "${account.user.email}"? Mật khẩu hiện tại sẽ không còn dùng được.`,
    )
    if (!confirmed) {
      return
    }
    setResetError('')
    const result = await resetPassword(account.user.id)
    if (result.success) {
      setResetResult(result.temporaryPassword)
    } else {
      setResetError(result.message)
    }
  }

  function handleClose() {
    setResetResult(null)
    setResetError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Chi tiết tài khoản">
      <dl>
        <dt>Họ tên</dt>
        <dd>{account.user.fullName}</dd>
        <dt>Email đăng nhập</dt>
        <dd>{account.user.email}</dd>
        <dt>Vai trò</dt>
        <dd>{account.roleLabel}</dd>
        <dt>Trạng thái</dt>
        <dd>{account.user.status === 'locked' ? 'Đã khóa' : 'Hoạt động'}</dd>
        <dt>Đối tượng liên kết</dt>
        <dd>{account.label}</dd>
        {account.extraFields.map((field) => (
          <Fragment key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </Fragment>
        ))}
      </dl>

      {resetResult && (
        <p className="form-hint">
          Mật khẩu tạm mới: <strong>{resetResult}</strong> — chỉ hiển thị 1 lần, hãy chép lại ngay và gửi cho người dùng.
        </p>
      )}
      {resetError && <p className="form-field-error">{resetError}</p>}

      <div className="modal-footer">
        <Button variant="secondary" onClick={handleResetPassword} disabled={isMutating}>
          Đặt lại mật khẩu
        </Button>
        <Button variant="secondary" onClick={handleClose}>
          Đóng
        </Button>
      </div>
    </Modal>
  )
}

export default AccountDetailModal
