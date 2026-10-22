import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import CompanyFormModal from '../../components/companies/CompanyFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useCompanies } from '../../context/CompaniesContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  active: { label: 'Đang hợp tác', tone: 'success' },
  inactive: { label: 'Ngừng hợp tác', tone: 'neutral' },
}

function CompaniesPage() {
  const {
    items: companies,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
  } = useCompanies()
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const filteredCompanies = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return companies.filter((company) => {
      const matchesKeyword =
        keyword === '' ||
        company.company_code.toLowerCase().includes(keyword) ||
        company.company_name.toLowerCase().includes(keyword) ||
        company.tax_code.toLowerCase().includes(keyword)

      const matchesStatus = statusFilter === 'all' || company.status === statusFilter

      return matchesKeyword && matchesStatus
    })
  }, [companies, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE))
  const pageCompanies = filteredCompanies.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingCompany(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(company) {
    setEditingCompany(company)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingCompany(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('company_code', code, ignoreId)
  }

  function isTaxCodeTaken(taxCode, ignoreId) {
    return isFieldTaken('tax_code', taxCode, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingCompany
      ? await updateItem(editingCompany.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(company) {
    const confirmed = window.confirm(
      `Xóa doanh nghiệp "${company.company_name}" (${company.company_code})?`,
    )
    if (!confirmed) {
      return
    }
    const result = await deleteItem(company.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'company_code', label: 'Mã DN' },
    { key: 'company_name', label: 'Tên doanh nghiệp' },
    { key: 'tax_code', label: 'MST' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'representative', label: 'Người đại diện' },
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
        <h2>Doanh nghiệp</h2>
        <Button onClick={openAddModal}>+ Thêm doanh nghiệp</Button>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo mã DN, tên, MST..."
        />

        <select
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hợp tác</option>
          <option value="inactive">Ngừng hợp tác</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageCompanies}
            rowKey="id"
            emptyMessage="Chưa có dữ liệu."
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <CompanyFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialData={editingCompany}
        isCodeTaken={isCodeTaken}
        isTaxCodeTaken={isTaxCodeTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default CompaniesPage
