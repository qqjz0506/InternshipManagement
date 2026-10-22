import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { useDebounce } from '../../hooks/useDebounce'
import { useMyMentoredInternships } from '../../hooks/useMyMentoredInternships'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import * as exportApi from '../../api/exportApi'
import { triggerBlobDownload } from '../../utils/downloadFile'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Họ tên A → Z' },
  { value: 'progress_desc', label: 'Tiến độ cao → thấp' },
  { value: 'progress_asc', label: 'Tiến độ thấp → cao' },
]

// Chỉ lấy đúng sinh viên có internship.company_mentor_id === mentor hiện tại (mục 5) —
// KHÔNG lấy toàn bộ sinh viên của Company rồi lọc theo mentor.
function CompanyStudentsPage() {
  const myInternships = useMyMentoredInternships()
  const { items: students } = useStudents()
  const { items: departments } = useDepartments()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name_asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    if (isExporting) {
      return
    }
    setExportError('')
    setIsExporting(true)
    try {
      const { blob, filename } = await exportApi.exportInternships({})
      triggerBlobDownload(blob, filename ?? 'internships.xlsx')
    } catch (err) {
      setExportError(err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const rows = useMemo(() => {
    return myInternships
      .map((internship) => {
        const student = students.find((item) => item.id === internship.student_id)
        return {
          id: internship.student_id,
          internship,
          student,
          department: departments.find((item) => item.id === student?.department_id),
          lecturer: lecturers.find((item) => item.id === internship.lecturer_id),
          topic: topics.find((item) => item.id === internship.topic_id),
        }
      })
      .filter((row) => row.student)
  }, [myInternships, students, departments, lecturers, topics])

  const filteredRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    const result = rows.filter((row) => {
      const matchesKeyword =
        keyword === '' ||
        row.student.student_code.toLowerCase().includes(keyword) ||
        row.student.full_name.toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'all' || row.internship.status === statusFilter
      return matchesKeyword && matchesStatus
    })

    const sorted = [...result]
    if (sortBy === 'name_asc') {
      sorted.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name))
    } else if (sortBy === 'progress_desc') {
      sorted.sort((a, b) => b.internship.progress - a.internship.progress)
    } else if (sortBy === 'progress_asc') {
      sorted.sort((a, b) => a.internship.progress - b.internship.progress)
    }

    return sorted
  }, [rows, debouncedSearch, statusFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function withPageReset(setter) {
    return (value) => {
      setter(value)
      setCurrentPage(1)
    }
  }

  const columns = [
    { key: 'student_code', label: 'MSSV', render: (row) => row.student.student_code },
    { key: 'full_name', label: 'Họ tên', render: (row) => row.student.full_name },
    { key: 'class', label: 'Lớp', render: (row) => row.student.class },
    { key: 'department', label: 'Khoa', render: (row) => row.department?.department_name ?? '—' },
    { key: 'lecturer', label: 'Giảng viên hướng dẫn', render: (row) => row.lecturer?.full_name ?? 'Chưa phân công' },
    { key: 'topic', label: 'Đề tài', render: (row) => row.topic?.topic_name ?? 'Chưa có' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <Badge tone={STATUS_META[row.internship.status].tone}>{STATUS_META[row.internship.status].label}</Badge>
      ),
    },
    { key: 'progress', label: 'Tiến độ', render: (row) => `${row.internship.progress}%` },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Link to={`/company/students/${row.student.id}`}>
          <Button variant="secondary" className="btn-sm">
            Xem chi tiết
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Sinh viên phụ trách</h2>
        <Button variant="secondary" disabled={isExporting} onClick={handleExport}>
          {isExporting ? 'Đang xuất...' : 'Xuất thông tin thực tập (.xlsx)'}
        </Button>
      </div>
      {exportError && <p className="form-field-error">{exportError}</p>}

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={withPageReset(setSearchTerm)}
          placeholder="Tìm theo MSSV, họ tên..."
        />

        <select value={statusFilter} onChange={(event) => withPageReset(setStatusFilter)(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={pageRows}
        rowKey="id"
        emptyMessage="Bạn chưa được phân công tiếp nhận sinh viên nào."
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  )
}

export default CompanyStudentsPage
