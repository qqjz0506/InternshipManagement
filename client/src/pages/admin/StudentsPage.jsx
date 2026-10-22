import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import StudentFormModal from '../../components/students/StudentFormModal'
import ImportModal from '../../components/imports/ImportModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import * as importApi from '../../api/importApi'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  active: { label: 'Đang học', tone: 'success' },
  inactive: { label: 'Ngừng học', tone: 'neutral' },
}

function StudentsPage() {
  const {
    items: students,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
    refresh,
  } = useStudents()
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
  const [editingStudent, setEditingStudent] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const filteredStudents = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return students.filter((student) => {
      const matchesKeyword =
        keyword === '' ||
        student.student_code.toLowerCase().includes(keyword) ||
        student.full_name.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword)

      const matchesDepartment =
        departmentFilter === 'all' || student.department_id === Number(departmentFilter)

      const matchesStatus = statusFilter === 'all' || student.status === statusFilter

      return matchesKeyword && matchesDepartment && matchesStatus
    })
  }, [students, debouncedSearch, departmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const pageStudents = filteredStudents.slice(
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
    setEditingStudent(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(student) {
    setEditingStudent(student)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingStudent(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('student_code', code, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingStudent
      ? await updateItem(editingStudent.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(student) {
    const confirmed = window.confirm(
      `Xóa sinh viên "${student.full_name}" (${student.student_code})?`,
    )
    if (!confirmed) {
      return
    }
    const result = await deleteItem(student.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  const columns = [
    { key: 'student_code', label: 'MSSV' },
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email' },
    {
      key: 'department',
      label: 'Khoa',
      render: (row) => getDepartmentName(row.department_id),
    },
    { key: 'class', label: 'Lớp' },
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
        <h2>Sinh viên</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            Nhập từ Excel
          </Button>
          <Button onClick={openAddModal}>+ Thêm sinh viên</Button>
        </div>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo MSSV, họ tên, email..."
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
          <option value="active">Đang học</option>
          <option value="inactive">Ngừng học</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageStudents}
            rowKey="id"
            emptyMessage="Chưa có dữ liệu."
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        departments={departments}
        initialData={editingStudent}
        isCodeTaken={isCodeTaken}
        submitError={submitError}
        isSubmitting={isMutating}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityLabel="sinh viên"
        getTemplate={importApi.getStudentsTemplate}
        preview={importApi.previewStudents}
        commit={importApi.commitStudents}
        onImported={refresh}
      />
    </div>
  )
}

export default StudentsPage
