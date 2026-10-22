import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import CompanyMentorFormModal from '../../components/companyMentors/CompanyMentorFormModal'
import CompanyMentorDetailModal from '../../components/companyMentors/CompanyMentorDetailModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useInternships } from '../../context/InternshipsContext'
import { useUsers } from '../../context/UsersContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  active: { label: 'Đang hợp tác', tone: 'success' },
  inactive: { label: 'Ngừng hợp tác', tone: 'neutral' },
}

function CompanyMentorsPage() {
  const {
    items: mentors,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
  } = useCompanyMentors()
  const { items: companies } = useCompanies()
  const { internships } = useInternships()
  const { users } = useUsers()

  function getCompanyName(companyId) {
    return companies.find((company) => company.id === companyId)?.company_name ?? '—'
  }

  function getLinkedUser(mentor) {
    return mentor.user_id ? users.find((user) => user.id === mentor.user_id) : null
  }

  function getAssignedCount(mentorId) {
    return internships.filter((internship) => internship.company_mentor_id === mentorId).length
  }

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMentor, setEditingMentor] = useState(null)
  const [viewingMentor, setViewingMentor] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const filteredMentors = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return mentors.filter((mentor) => {
      const matchesKeyword =
        keyword === '' ||
        mentor.full_name.toLowerCase().includes(keyword) ||
        mentor.email.toLowerCase().includes(keyword)

      const matchesCompany = companyFilter === 'all' || mentor.company_id === Number(companyFilter)

      return matchesKeyword && matchesCompany
    })
  }, [mentors, debouncedSearch, companyFilter])

  const totalPages = Math.max(1, Math.ceil(filteredMentors.length / PAGE_SIZE))
  const pageMentors = filteredMentors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleCompanyFilterChange(value) {
    setCompanyFilter(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingMentor(null)
    setSubmitError('')
    setIsFormOpen(true)
  }

  function openEditModal(mentor) {
    setEditingMentor(mentor)
    setSubmitError('')
    setIsFormOpen(true)
  }

  function closeFormModal() {
    setIsFormOpen(false)
    setEditingMentor(null)
    setSubmitError('')
  }

  function isEmailTaken(email, ignoreId) {
    return isFieldTaken('email', email, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    // Đổi doanh nghiệp: KHÔNG tự lặp lại transaction gỡ phân công Internship ở frontend — backend
    // (companyMentorService.update) đã làm việc này trong cùng 1 DB transaction (mục 11 Phase 4B-3).
    // Chỉ hiển thị thông báo tham khảo sau khi backend xác nhận thành công.
    const companyChanged = Boolean(editingMentor) && formValues.company_id !== editingMentor.company_id

    const result = editingMentor
      ? await updateItem(editingMentor.id, formValues)
      : await addItem(formValues)

    if (!result.success) {
      setSubmitError(result.message)
      return
    }

    closeFormModal()
    if (companyChanged) {
      window.alert(
        'Đã cập nhật người hướng dẫn. Do đổi doanh nghiệp, hệ thống đã tự động gỡ phân công khỏi mọi hồ sơ thực tập cũ đang dùng người hướng dẫn này (nếu có).',
      )
    }
  }

  async function handleDelete(mentor) {
    const linkedUser = getLinkedUser(mentor)
    const warning = linkedUser
      ? `Người hướng dẫn này có tài khoản liên kết (${linkedUser.email}). Xóa sẽ KHÔNG xóa tài khoản đó — tài khoản sẽ mất liên kết. `
      : ''
    const confirmed = window.confirm(`${warning}Xóa người hướng dẫn "${mentor.full_name}"?`)
    if (!confirmed) {
      return
    }
    const result = await deleteItem(mentor.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'SĐT', render: (row) => row.phone || '—' },
    { key: 'company', label: 'Doanh nghiệp', render: (row) => getCompanyName(row.company_id) },
    { key: 'position', label: 'Chức vụ', render: (row) => row.position || '—' },
    {
      key: 'account',
      label: 'Tài khoản',
      render: (row) => (getLinkedUser(row) ? <Badge tone="info">Đã liên kết</Badge> : <Badge tone="neutral">Chưa có</Badge>),
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
          <Button variant="secondary" className="btn-sm" onClick={() => setViewingMentor(row)}>
            Xem chi tiết
          </Button>
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
        <h2>Người hướng dẫn doanh nghiệp</h2>
        <Button onClick={openAddModal}>+ Thêm người hướng dẫn</Button>
      </div>
      <p className="form-hint">
        Quản lý người hướng dẫn tại doanh nghiệp — dữ liệu này được dùng để phân công cho Hồ sơ thực tập
        (mục "Phân công doanh nghiệp") và có thể liên kết tài khoản đăng nhập ở trang Tài khoản.
      </p>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo họ tên, email..."
        />

        <select value={companyFilter} onChange={(event) => handleCompanyFilterChange(event.target.value)}>
          <option value="all">Tất cả doanh nghiệp</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pageMentors} rowKey="id" emptyMessage="Chưa có dữ liệu." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <CompanyMentorFormModal
        isOpen={isFormOpen}
        onClose={closeFormModal}
        onSubmit={handleSubmit}
        companies={companies}
        initialData={editingMentor}
        isEmailTaken={isEmailTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <CompanyMentorDetailModal
        isOpen={Boolean(viewingMentor)}
        onClose={() => setViewingMentor(null)}
        mentor={viewingMentor}
        company={viewingMentor ? companies.find((company) => company.id === viewingMentor.company_id) : null}
        linkedUser={viewingMentor ? getLinkedUser(viewingMentor) : null}
        assignedCount={viewingMentor ? getAssignedCount(viewingMentor.id) : 0}
      />
    </div>
  )
}

export default CompanyMentorsPage
