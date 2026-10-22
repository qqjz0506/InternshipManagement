import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import LogFormModal from '../../components/internshipLogs/LogFormModal'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useInternshipLogs } from '../../context/InternshipLogsContext'
import { LOG_STATUS_META } from '../../utils/internshipLogStatus'
import '../../components/common/ListPage.css'

function StudentLogsPage() {
  const internship = useMyInternship()
  const { items: logs, isLoading, isMutating, error, addItem, updateItem, deleteItem } = useInternshipLogs()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [submitError, setSubmitError] = useState('')

  if (!internship) {
    return (
      <div className="list-page">
        <h2>Nhật ký thực tập</h2>
        <p>Bạn chưa có hồ sơ thực tập.</p>
      </div>
    )
  }

  const myLogs = logs
    .filter((log) => log.internship_id === internship.id)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))

  const canAddLog = internship.status === 'in_progress'

  function openAddModal() {
    setEditingLog(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(log) {
    setEditingLog(log)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingLog(null)
    setSubmitError('')
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingLog
      ? await updateItem(editingLog.id, formValues)
      : await addItem({ ...formValues, internship_id: internship.id, status: 'submitted', lecturer_comment: '' })

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(log) {
    const confirmed = window.confirm(`Xóa nhật ký "${log.title}"?`)
    if (!confirmed) {
      return
    }
    const result = await deleteItem(log.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'log_date', label: 'Ngày' },
    { key: 'title', label: 'Tiêu đề' },
    { key: 'progress', label: 'Tiến độ', render: (row) => `${row.progress}%` },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={LOG_STATUS_META[row.status].tone}>{LOG_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => {
        const isLocked = row.status === 'reviewed'
        return (
          <div className="row-actions">
            <Button variant="secondary" className="btn-sm" onClick={() => openEditModal(row)}>
              {isLocked ? 'Xem' : 'Sửa'}
            </Button>
            {!isLocked && (
              <Button variant="danger" className="btn-sm" onClick={() => handleDelete(row)}>
                Xóa
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Nhật ký thực tập</h2>
        {canAddLog ? (
          <Button onClick={openAddModal}>+ Thêm nhật ký</Button>
        ) : (
          <span className="form-hint">Chỉ ghi nhật ký khi đang trong quá trình thực tập.</span>
        )}
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={myLogs} rowKey="id" emptyMessage="Chưa có nhật ký nào." />
      )}

      <LogFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialData={editingLog}
        readOnly={editingLog?.status === 'reviewed'}
        submitError={submitError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default StudentLogsPage
