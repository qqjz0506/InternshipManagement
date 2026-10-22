import { useMemo, useState } from 'react'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import TopicFormModal from '../../components/topics/TopicFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useTopics } from '../../context/TopicsContext'
import { useStudents } from '../../context/StudentsContext'
import { useCompanies } from '../../context/CompaniesContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const STATUS_META = {
  proposed: { label: 'Đề xuất', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
}

function TopicsPage() {
  const {
    items: topics,
    isLoading,
    isMutating,
    error,
    addItem,
    updateItem,
    deleteItem,
    isFieldTaken,
  } = useTopics()
  const { items: students } = useStudents()
  const { items: companies } = useCompanies()

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [submitError, setSubmitError] = useState('')

  function findStudent(studentId) {
    return students.find((student) => student.id === studentId)
  }

  function findCompany(companyId) {
    return companies.find((company) => company.id === companyId)
  }

  const filteredTopics = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return topics.filter((topic) => {
      const matchesKeyword =
        keyword === '' ||
        topic.topic_code.toLowerCase().includes(keyword) ||
        topic.topic_name.toLowerCase().includes(keyword)

      const matchesStatus = statusFilter === 'all' || topic.status === statusFilter

      return matchesKeyword && matchesStatus
    })
  }, [topics, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / PAGE_SIZE))
  const pageTopics = filteredTopics.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearchChange(value) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  function openAddModal() {
    setEditingTopic(null)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function openEditModal(topic) {
    setEditingTopic(topic)
    setSubmitError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTopic(null)
    setSubmitError('')
  }

  function isCodeTaken(code, ignoreId) {
    return isFieldTaken('topic_code', code, ignoreId)
  }

  async function handleSubmit(formValues) {
    setSubmitError('')
    const result = editingTopic
      ? await updateItem(editingTopic.id, formValues)
      : await addItem(formValues)

    if (result.success) {
      closeModal()
    } else {
      setSubmitError(result.message)
    }
  }

  async function handleDelete(topic) {
    const confirmed = window.confirm(`Xóa đề tài "${topic.topic_name}" (${topic.topic_code})?`)
    if (!confirmed) {
      return
    }
    const result = await deleteItem(topic.id)
    if (!result.success) {
      window.alert(result.message)
    }
  }

  function getSourceLabel(topic) {
    const student = findStudent(topic.suggested_by_student_id)
    if (student) {
      return `SV: ${student.full_name}`
    }
    const company = findCompany(topic.company_id)
    if (company) {
      return `DN: ${company.company_name}`
    }
    return 'Admin/Khoa'
  }

  const columns = [
    { key: 'topic_code', label: 'Mã đề tài' },
    { key: 'topic_name', label: 'Tên đề tài' },
    { key: 'source', label: 'Nguồn đề xuất', render: (row) => getSourceLabel(row) },
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
        <h2>Đề tài</h2>
        <Button onClick={openAddModal}>+ Thêm đề tài</Button>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Tìm theo mã đề tài, tên đề tài..."
        />

        <select value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="proposed">Đề xuất</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pageTopics} rowKey="id" emptyMessage="Chưa có dữ liệu." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <TopicFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialData={editingTopic}
        isCodeTaken={isCodeTaken}
        students={students}
        companies={companies}
        submitError={submitError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default TopicsPage
