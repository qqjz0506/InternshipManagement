import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import PeriodFormModal from '../../components/internshipPeriods/PeriodFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  upcoming: { label: 'Sắp diễn ra', tone: 'info' },
  ongoing: { label: 'Đang diễn ra', tone: 'success' },
  closed: { label: 'Đã kết thúc', tone: 'neutral' },
}

function InternshipPeriodsPage() {
  const {
    items: periods,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
  } = useInternshipPeriods()
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const filteredPeriods = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return periods.filter((period) => {
      const matchesKeyword =
        keyword === '' ||
        period.period_code.toLowerCase().includes(keyword) ||
        period.period_name.toLowerCase().includes(keyword)

      const matchesStatus = statusFilter === 'all' || period.status === statusFilter

      return matchesKeyword && matchesStatus
    })
  }, [periods, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPeriods.length / PAGE_SIZE))
  const pagePeriods = filteredPeriods.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingPeriod(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(period) {
    setEditingPeriod(period)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingPeriod(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('period_code', code, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingPeriod
      ? await updateItem(editingPeriod.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(period) {
    const confirmed = window.confirm(
      `Xóa đợt thực tập "${period.period_name}" (${period.period_code})?`,
    )
    if (!confirmed) {
      return
    }
    const result = await deleteItem(period.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'period_code', label: 'Mã đợt' },
    { key: 'period_name', label: 'Tên đợt thực tập' },
    {
      key: 'time_range',
      label: 'Thời gian',
      render: (row) => `${row.start_date} → ${row.end_date}`,
    },
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
          <Button variant="danger" className="btn-sm" onClick={() => handleDelete(row)}>
            Xóa
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Đợt thực tập</h2>
        <Button onClick={openAddModal}>+ Thêm đợt thực tập</Button>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo mã đợt, tên đợt..."
        />

        <select value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="upcoming">Sắp diễn ra</option>
          <option value="ongoing">Đang diễn ra</option>
          <option value="closed">Đã kết thúc</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pagePeriods} rowKey="id" emptyMessage="Chưa có dữ liệu." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <PeriodFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialData={editingPeriod}
        isCodeTaken={isCodeTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default InternshipPeriodsPage
