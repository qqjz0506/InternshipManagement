import { useState } from 'react'
import DataTable from '../../components/common/DataTable'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import FormField from '../../components/common/FormField'
import { useInternshipPositions } from '../../context/InternshipPositionsContext'
import { usePositionApplications } from '../../context/PositionApplicationsContext'
import { useCompanies } from '../../context/CompaniesContext'
import '../../components/common/ListPage.css'

const APPLICATION_STATUS_META = {
  applied: { label: 'Đang chờ', tone: 'warning' },
  accepted: { label: 'Đã nhận', tone: 'success' },
  rejected: { label: 'Đã từ chối', tone: 'danger' },
  withdrawn: { label: 'Đã rút', tone: 'neutral' },
}

// GET /internship-positions đã tự scope ở backend: Student CHỈ thấy vị trí 'open' của đợt chưa đóng
// (xem server/services/internshipPositionService.js). GET /position-applications cũng tự scope CHỈ
// đơn của chính mình — trang này không cần lọc gì thêm ở client.
function StudentPositionsPage() {
  const { items: positions, isLoading: isPositionsLoading, error: positionsError } = useInternshipPositions()
  const {
    items: myApplications,
    isLoading: isApplicationsLoading,
    isMutating,
    error: applicationError,
    addItem: apply,
    withdraw,
  } = usePositionApplications()
  const { items: companies } = useCompanies()

  const [applyingPosition, setApplyingPosition] = useState(null)
  const [note, setNote] = useState('')
  const [submitError, setSubmitError] = useState('')

  function getCompanyName(companyId) {
    return companies.find((company) => company.id === companyId)?.company_name ?? '—'
  }

  function openApplyModal(position) {
    setApplyingPosition(position)
    setNote('')
    setSubmitError('')
  }
  function closeApplyModal() {
    setApplyingPosition(null)
    setSubmitError('')
  }

  async function handleApply(event) {
    event.preventDefault()
    setSubmitError('')
    const result = await apply({ position_id: applyingPosition.id, note })
    if (result.success) {
      closeApplyModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleWithdraw(applicationId) {
    const confirmed = window.confirm('Rút đơn ứng tuyển này?')
    if (!confirmed) {
      return
    }
    const result = await withdraw(applicationId)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const appliedPositionIds = new Set(myApplications.filter((app) => app.status === 'applied').map((app) => app.position_id))

  const positionColumns = [
    { key: 'title', label: 'Tên vị trí' },
    { key: 'company', label: 'Doanh nghiệp', render: (row) => getCompanyName(row.company_id) },
    { key: 'description', label: 'Mô tả', render: (row) => row.description || '—' },
    { key: 'requirements', label: 'Yêu cầu', render: (row) => row.requirements || '—' },
    { key: 'slots', label: 'Số lượng', render: (row) => row.slots },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        appliedPositionIds.has(row.id) ? (
          <Badge tone="warning">Đã ứng tuyển</Badge>
        ) : (
          <Button className="btn-sm" onClick={() => openApplyModal(row)}>
            Ứng tuyển
          </Button>
        ),
    },
  ]

  const applicationColumns = [
    { key: 'position', label: 'Vị trí', render: (row) => positions.find((p) => p.id === row.position_id)?.title ?? `#${row.position_id}` },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={APPLICATION_STATUS_META[row.status].tone}>{APPLICATION_STATUS_META[row.status].label}</Badge>,
    },
    { key: 'note', label: 'Ghi chú', render: (row) => row.note || '—' },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.status === 'applied' ? (
          <Button variant="danger" className="btn-sm" onClick={() => handleWithdraw(row.id)}>
            Rút đơn
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Vị trí thực tập</h2>
      </div>

      {positionsError && <p className="form-field-error">{positionsError}</p>}
      {isPositionsLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={positionColumns} data={positions} rowKey="id" emptyMessage="Hiện chưa có vị trí thực tập nào mở." />
      )}

      <h3 style={{ marginTop: 32 }}>Đơn ứng tuyển của tôi</h3>
      {applicationError && <p className="form-field-error">{applicationError}</p>}
      {isApplicationsLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <DataTable columns={applicationColumns} data={myApplications} rowKey="id" emptyMessage="Bạn chưa ứng tuyển vị trí nào." />
      )}

      <Modal isOpen={Boolean(applyingPosition)} onClose={closeApplyModal} title={`Ứng tuyển: ${applyingPosition?.title ?? ''}`}>
        <form onSubmit={handleApply}>
          <FormField label="Ghi chú (tùy chọn)" htmlFor="note">
            <textarea id="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          {submitError && <p className="form-field-error">{submitError}</p>}
          <div className="modal-footer">
            <Button variant="secondary" onClick={closeApplyModal} disabled={isMutating}>
              Hủy
            </Button>
            <Button type="submit" disabled={isMutating}>
              {isMutating ? 'Đang gửi...' : 'Gửi đơn ứng tuyển'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default StudentPositionsPage
