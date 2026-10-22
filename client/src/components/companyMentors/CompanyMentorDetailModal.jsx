import Modal from '../common/Modal'
import Button from '../common/Button'

const STATUS_LABEL = { active: 'Đang hợp tác', inactive: 'Ngừng hợp tác' }

// Chỉ đọc — không hiển thị password của tài khoản liên kết (chỉ hiển thị email để nhận diện).
function CompanyMentorDetailModal({ isOpen, onClose, mentor, company, linkedUser, assignedCount }) {
  if (!mentor) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết người hướng dẫn">
      <dl>
        <dt>Họ tên</dt>
        <dd>{mentor.full_name}</dd>
        <dt>Email</dt>
        <dd>{mentor.email}</dd>
        <dt>Số điện thoại</dt>
        <dd>{mentor.phone || '—'}</dd>
        <dt>Chức vụ</dt>
        <dd>{mentor.position || '—'}</dd>
        <dt>Doanh nghiệp</dt>
        <dd>{company?.company_name ?? 'Chưa rõ'}</dd>
        <dt>Trạng thái</dt>
        <dd>{STATUS_LABEL[mentor.status] ?? mentor.status}</dd>
        <dt>Tài khoản liên kết</dt>
        <dd>{linkedUser ? linkedUser.email : 'Chưa có tài khoản'}</dd>
        <dt>Hồ sơ đang phụ trách</dt>
        <dd>{assignedCount} sinh viên</dd>
      </dl>

      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Modal>
  )
}

export default CompanyMentorDetailModal
