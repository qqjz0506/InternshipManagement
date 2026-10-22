import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InternshipCreateModal from '../../components/internships/InternshipCreateModal'
import { useDebounce } from '../../hooks/useDebounce'
import { useSettings } from '../../context/SettingsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

function InternshipsPage() {
  const { internships, isLoading, isMutating, error, addInternship, isDuplicateRegistration } = useInternships()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: companies } = useCompanies()
  const { items: periods } = useInternshipPeriods()
  const { settings } = useSettings()
  const navigate = useNavigate()

  function findStudent(id) {
    return students.find((student) => student.id === id)
  }

  function findLecturer(id) {
    return lecturers.find((lecturer) => lecturer.id === id)
  }

  function findCompany(id) {
    return companies.find((company) => company.id === id)
  }

  function findPeriod(id) {
    return periods.find((period) => period.id === id)
  }

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [lecturerFilter, setLecturerFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createError, setCreateError] = useState('')

  const filtered = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return internships.filter((item) => {
      const student = students.find((candidate) => candidate.id === item.student_id)
      const matchesKeyword =
        keyword === '' ||
        student?.student_code.toLowerCase().includes(keyword) ||
        student?.full_name.toLowerCase().includes(keyword)

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesPeriod = periodFilter === 'all' || item.period_id === Number(periodFilter)
      const matchesCompany = companyFilter === 'all' || item.company_id === Number(companyFilter)
      const matchesLecturer = lecturerFilter === 'all' || item.lecturer_id === Number(lecturerFilter)

      return matchesKeyword && matchesStatus && matchesPeriod && matchesCompany && matchesLecturer
    })
  }, [internships, students, debouncedSearch, statusFilter, periodFilter, companyFilter, lecturerFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function withPageReset(setter) {
    return (value) => {
      setter(value)
      setCurrentPage(1)
    }
  }

  function openCreateModal() {
    setCreateError('')
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
    setCreateError('')
  }

  async function handleCreate(values) {
    setCreateError('')
    const result = await addInternship(values)
    if (!result.success) {
      setCreateError(result.message)
      return
    }
    setIsCreateModalOpen(false)
    navigate(`/admin/internships/${result.item.id}`)
  }

  const columns = [
    {
      key: 'student',
      label: 'Sinh viên',
      render: (row) => {
        const student = findStudent(row.student_id)
        return student ? `${student.student_code} - ${student.full_name}` : '—'
      },
    },
    {
      key: 'period',
      label: 'Đợt thực tập',
      render: (row) => findPeriod(row.period_id)?.period_name ?? '—',
    },
    {
      key: 'company',
      label: 'Doanh nghiệp',
      render: (row) => findCompany(row.company_id)?.company_name ?? 'Chưa phân công',
    },
    {
      key: 'lecturer',
      label: 'Giảng viên',
      render: (row) => findLecturer(row.lecturer_id)?.full_name ?? 'Chưa phân công',
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'progress',
      label: 'Tiến độ',
      render: (row) => `${row.progress}%`,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Link to={`/admin/internships/${row.id}`}>
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
        <h2>Hồ sơ thực tập</h2>
        <Button onClick={openCreateModal}>+ Tạo hồ sơ</Button>
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={withPageReset(setSearchTerm)}
          placeholder="Tìm theo MSSV, họ tên sinh viên..."
        />

        <select value={statusFilter} onChange={(event) => withPageReset(setStatusFilter)(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>

        <select value={periodFilter} onChange={(event) => withPageReset(setPeriodFilter)(event.target.value)}>
          <option value="all">Tất cả đợt</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.period_name}
            </option>
          ))}
        </select>

        <select value={companyFilter} onChange={(event) => withPageReset(setCompanyFilter)(event.target.value)}>
          <option value="all">Tất cả doanh nghiệp</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
            </option>
          ))}
        </select>

        <select value={lecturerFilter} onChange={(event) => withPageReset(setLecturerFilter)(event.target.value)}>
          <option value="all">Tất cả giảng viên</option>
          {lecturers.map((lecturer) => (
            <option key={lecturer.id} value={lecturer.id}>
              {lecturer.full_name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pageItems} rowKey="id" emptyMessage="Chưa có dữ liệu." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <InternshipCreateModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleCreate}
        students={students}
        periods={periods}
        isDuplicateRegistration={isDuplicateRegistration}
        defaultPeriodId={settings.defaultInternshipPeriodId}
        submitError={createError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default InternshipsPage
