import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import PositionFormModal from '../../components/internshipPositions/PositionFormModal'
import PositionApplicationsModal from '../../components/internshipPositions/PositionApplicationsModal'
import { useInternshipPositions } from '../../context/InternshipPositionsContext'
import { usePositionApplications } from '../../context/PositionApplicationsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useStudents } from '../../context/StudentsContext'
import '../../components/common/ListPage.css'

// Backend đã tự scope GET /internship-positions theo company_id của chính Mentor (xem
// server/services/internshipPositionService.js) — trang này chỉ hiển thị + quản lý ĐÚNG vị trí của
// công ty mình, không cần lọc thêm ở client.
const STATUS_META = {
  open: { label: 'Còn nhận đơn', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'neutral' },
}

function CompanyPositionsPage() {
  const { items: positions, isLoading, isMutating, error, addItem, updateItem, refresh } = useInternshipPositions()
  const { items: applications, isMutating: isApplicationMutating, accept, reject } = usePositionApplications()
  const { items: periods } = useInternshipPeriods()
  const { items: students } = useStudents()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [viewingPosition, setViewingPosition] = useState(null)
  const [actionError, setActionError] = useState('')

  function getPeriodName(periodId) {
    return periods.find((period) => period.id === periodId)?.period_name ?? '—'
  }

  function openAddModal() {
    setEditingPosition(null)
    setSubmitError('')
    setIsFormOpen(true)
  }
  function openEditModal(position) {
    setEditingPosition(position)
    setSubmitError('')
    setIsFormOpen(true)
  }
  function closeFormModal() {
    setIsFormOpen(false)
    setEditingPosition(null)
    setSubmitError('')
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingPosition ? await updateItem(editingPosition.id, formValues) : await addItem(formValues)
    if (result.success) {
      closeFormModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleAccept(applicationId) {
    setActionError('')
    const result = await accept(applicationId)
    if (!result.success) {
      setActionError(result.message)
    } else {
      await refresh()
    }
  }
  async function handleReject(applicationId) {
    setActionError('')
    const result = await reject(applicationId)
    if (!result.success) {
      setActionError(result.message)
    } else {
      await refresh()
    }
  }

  const columns = [
    { key: 'title', label: 'Tên vị trí' },
    { key: 'period', label: 'Đợt thực tập', render: (row) => getPeriodName(row.period_id) },
    { key: 'slots', label: 'Đơn đã nhận / Slots', render: (row) => `${row.accepted_count ?? 0}/${row.slots}` },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="row-actions">
          <Button variant="secondary" className="btn-sm" onClick={() => openEditModal(row)}>
            Sửa
          </Button>
          <Button className="btn-sm" onClick={() => setViewingPosition(row)}>
            Xem đơn ứng tuyển
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Vị trí thực tập</h2>
        <Button onClick={openAddModal}>+ Đăng vị trí mới</Button>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={columns} data={positions} rowKey="id" emptyMessage="Chưa đăng vị trí thực tập nào." />
      )}

      <PositionFormModal
        isOpen={isFormOpen}
        onClose={closeFormModal}
        onSubmit={handleSubmit}
        companies={[]}
        periods={periods}
        isAdmin={false}
        initialData={editingPosition}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <PositionApplicationsModal
        isOpen={Boolean(viewingPosition)}
        onClose={() => setViewingPosition(null)}
        position={viewingPosition}
        applications={applications}
        students={students}
        onAccept={handleAccept}
        onReject={handleReject}
        isMutating={isApplicationMutating}
        actionError={actionError}
      />
    </div>
  )
}

export default CompanyPositionsPage
