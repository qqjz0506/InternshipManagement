import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import LecturerFormModal from '../../components/lecturers/LecturerFormModal'
import ImportModal from '../../components/imports/ImportModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useLecturers } from '../../context/LecturersContext'
import { useDepartments } from '../../context/DepartmentsContext'
import * as importApi from '../../api/importApi'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  active: { label: 'Đang công tác', tone: 'success' },
  inactive: { label: 'Đã nghỉ', tone: 'neutral' },
}

function LecturersPage() {
  const {
    items: lecturers,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
    refresh,
  } = useLecturers()
  const { items: departments } = useDepartments()

  function getDepartmentName(departmentId) {
    return departments.find((dept) => dept.id === departmentId)?.department_name ?? '—'
  }

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLecturer, setEditingLecturer] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const filteredLecturers = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return lecturers.filter((lecturer) => {
      const matchesKeyword =
        keyword === '' ||
        lecturer.lecturer_code.toLowerCase().includes(keyword) ||
        lecturer.full_name.toLowerCase().includes(keyword) ||
        lecturer.email.toLowerCase().includes(keyword)

      const matchesDepartment =
        departmentFilter === 'all' || lecturer.department_id === Number(departmentFilter)

      const matchesStatus = statusFilter === 'all' || lecturer.status === statusFilter

      return matchesKeyword && matchesDepartment && matchesStatus
    })
  }, [lecturers, debouncedSearch, departmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLecturers.length / PAGE_SIZE))
  const pageLecturers = filteredLecturers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleDepartmentFilterChange(value) {
    setDepartmentFilter(value)
    setCurrentPage(1)
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingLecturer(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(lecturer) {
    setEditingLecturer(lecturer)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingLecturer(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('lecturer_code', code, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingLecturer
      ? await updateItem(editingLecturer.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(lecturer) {
    const confirmed = window.confirm(
      `Xóa giảng viên "${lecturer.full_name}" (${lecturer.lecturer_code})?`,
    )
    if (!confirmed) {
      return
    }
    const result = await deleteItem(lecturer.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'lecturer_code', label: 'Mã GV' },
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email' },
    {
      key: 'department',
      label: 'Khoa',
      render: (row) => getDepartmentName(row.department_id),
    },
    { key: 'position', label: 'Học hàm / Học vị' },
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
        <h2>Giảng viên</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            Nhập từ Excel
          </Button>
          <Button onClick={openAddModal}>+ Thêm giảng viên</Button>
        </div>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo mã GV, họ tên, email..."
        />

        <select
          value={departmentFilter}
          onChange={(event) => handleDepartmentFilterChange(event.target.value)}
        >
          <option value="all">Tất cả khoa</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.department_name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang công tác</option>
          <option value="inactive">Đã nghỉ</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageLecturers}
            rowKey="id"
            emptyMessage="Chưa có dữ liệu."
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <LecturerFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        departments={departments}
        initialData={editingLecturer}
        isCodeTaken={isCodeTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityLabel="giảng viên"
        getTemplate={importApi.getLecturersTemplate}
        preview={importApi.previewLecturers}
        commit={importApi.commitLecturers}
        onImported={refresh}
      />
    </div>
  )
}

export default LecturersPage
