import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Button from '../../components/common/Button'
import DepartmentFormModal from '../../components/departments/DepartmentFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useDepartments } from '../../context/DepartmentsContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

function DepartmentsPage() {
  const {
    items: departments,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
  } = useDepartments()
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const filteredDepartments = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return departments.filter((department) => {
      return (
        keyword === '' ||
        department.department_code.toLowerCase().includes(keyword) ||
        department.department_name.toLowerCase().includes(keyword)
      )
    })
  }, [departments, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE))
  const pageDepartments = filteredDepartments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingDepartment(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(department) {
    setEditingDepartment(department)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingDepartment(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('department_code', code, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingDepartment
      ? await updateItem(editingDepartment.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(department) {
    const confirmed = window.confirm(
      `Xóa khoa "${department.department_name}" (${department.department_code})?`,
    )
    if (!confirmed) {
      return
    }
    const result = await deleteItem(department.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'department_code', label: 'Mã khoa' },
    { key: 'department_name', label: 'Tên khoa' },
    { key: 'description', label: 'Mô tả' },
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
        <h2>Khoa / Bộ môn</h2>
        <Button onClick={openAddModal}>+ Thêm khoa</Button>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo mã khoa, tên khoa..."
        />
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageDepartments}
            rowKey="id"
            emptyMessage="Chưa có dữ liệu."
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <DepartmentFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialData={editingDepartment}
        isCodeTaken={isCodeTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default DepartmentsPage
