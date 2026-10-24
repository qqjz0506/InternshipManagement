import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import DataTable from '../common/DataTable'

const STATUS_META = {
  applied: { label: 'Đang chờ', tone: 'warning' },
  accepted: { label: 'Đã nhận', tone: 'success' },
  rejected: { label: 'Đã từ chối', tone: 'danger' },
  withdrawn: { label: 'Đã rút', tone: 'neutral' },
}

// Admin/Company Mentor xem + duyệt đơn ứng tuyển của 1 vị trí cụ thể — accept/reject CHỈ áp dụng cho
// đơn đang 'applied' (nút tự ẩn cho đơn đã xử lý, khớp đúng rule server: reject() 409 nếu không còn
// 'applied').
function PositionApplicationsModal({ isOpen, onClose, position, applications, students, onAccept, onReject, isMutating, actionError }) {
  if (!position) {
    return null
  }

  const positionApplications = applications.filter((application) => application.position_id === position.id)

  function studentLabel(studentId) {
    const student = students.find((item) => item.id === studentId)
    return student ? `${student.student_code} - ${student.full_name}` : `SV #${studentId}`
  }

  const columns = [
    { key: 'student', label: 'Sinh viên', render: (row) => studentLabel(row.student_id) },
    { key: 'note', label: 'Ghi chú', render: (row) => row.note || '—' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.status === 'applied' ? (
          <div className="row-actions">
            <Button className="btn-sm" onClick={() => onAccept(row.id)} disabled={isMutating}>
              Chấp nhận
            </Button>
            <Button variant="danger" className="btn-sm" onClick={() => onReject(row.id)} disabled={isMutating}>
              Từ chối
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Đơn ứng tuyển — ${position.title} (${position.slots} chỗ)`}>
      {actionError && <p className="form-field-error">{actionError}</p>}
      <DataTable columns={columns} data={positionApplications} rowKey="id" emptyMessage="Chưa có ai ứng tuyển vị trí này." />
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Modal>
  )
}

export default PositionApplicationsModal
