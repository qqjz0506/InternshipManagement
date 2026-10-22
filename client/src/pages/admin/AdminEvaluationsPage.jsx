import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import StatCard from '../../components/common/StatCard'
import { useDebounce } from '../../hooks/useDebounce'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const ROLE_LABEL = { lecturer: 'Giảng viên', company: 'Doanh nghiệp' }

// evaluator name KHÔNG lưu sẵn — luôn suy ra từ Internship.lecturer_id / company_mentor_id
// theo đúng evaluator_role, không tạo relationship/field mới (mục 8).
function getEvaluatorName(evaluation, internship, lecturers, mentors) {
  if (evaluation.evaluator_role === 'lecturer') {
    return lecturers.find((item) => item.id === internship?.lecturer_id)?.full_name ?? 'Chưa xác định'
  }
  return mentors.find((item) => item.id === internship?.company_mentor_id)?.full_name ?? 'Chưa xác định'
}

function AdminEvaluationsPage() {
  const { items: evaluations, isLoading, error } = useEvaluations()
  const { internships } = useInternships()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: periods } = useInternshipPeriods()

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [roleFilter, setRoleFilter] = useState('all')
  const [lecturerFilter, setLecturerFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [mentorFilter, setMentorFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [publishFilter, setPublishFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const rows = useMemo(() => {
    return evaluations
      .map((evaluation) => {
        const internship = internships.find((item) => item.id === evaluation.internship_id)
        const student = students.find((item) => item.id === internship?.student_id)
        return {
          id: evaluation.id,
          evaluation,
          internship,
          student,
          lecturer: lecturers.find((item) => item.id === internship?.lecturer_id),
          company: companies.find((item) => item.id === internship?.company_id),
          mentor: mentors.find((item) => item.id === internship?.company_mentor_id),
          period: periods.find((item) => item.id === internship?.period_id),
          evaluatorName: getEvaluatorName(evaluation, internship, lecturers, mentors),
        }
      })
      .filter((row) => row.student)
  }, [evaluations, internships, students, lecturers, companies, mentors, periods])

  const filteredRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesKeyword =
        keyword === '' ||
        row.student.student_code.toLowerCase().includes(keyword) ||
        row.student.full_name.toLowerCase().includes(keyword) ||
        row.evaluatorName.toLowerCase().includes(keyword)

      const matchesRole = roleFilter === 'all' || row.evaluation.evaluator_role === roleFilter
      const matchesLecturer = lecturerFilter === 'all' || String(row.lecturer?.id) === lecturerFilter
      const matchesCompany = companyFilter === 'all' || String(row.company?.id) === companyFilter
      const matchesMentor = mentorFilter === 'all' || String(row.mentor?.id) === mentorFilter
      const matchesPeriod = periodFilter === 'all' || String(row.period?.id) === periodFilter
      const matchesPublish =
        publishFilter === 'all' ||
        (publishFilter === 'published' ? row.evaluation.is_published : !row.evaluation.is_published)

      return (
        matchesKeyword &&
        matchesRole &&
        matchesLecturer &&
        matchesCompany &&
        matchesMentor &&
        matchesPeriod &&
        matchesPublish
      )
    })
  }, [rows, debouncedSearch, roleFilter, lecturerFilter, companyFilter, mentorFilter, periodFilter, publishFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function withPageReset(setter) {
    return (value) => {
      setter(value)
      setCurrentPage(1)
    }
  }

  const totalCount = evaluations.length
  const lecturerCount = evaluations.filter((evaluation) => evaluation.evaluator_role === 'lecturer').length
  const companyCount = evaluations.filter((evaluation) => evaluation.evaluator_role === 'company').length
  const publishedCount = evaluations.filter((evaluation) => evaluation.is_published).length
  const unpublishedCount = totalCount - publishedCount

  const columns = [
    {
      key: 'student',
      label: 'Sinh viên',
      render: (row) => `${row.student.student_code} - ${row.student.full_name}`,
    },
    {
      key: 'role',
      label: 'Vai trò đánh giá',
      render: (row) => <Badge tone={row.evaluation.evaluator_role === 'lecturer' ? 'info' : 'warning'}>{ROLE_LABEL[row.evaluation.evaluator_role]}</Badge>,
    },
    { key: 'evaluator', label: 'Người đánh giá', render: (row) => row.evaluatorName },
    { key: 'overall_score', label: 'Điểm tổng', render: (row) => row.evaluation.overall_score },
    {
      key: 'published',
      label: 'Trạng thái',
      render: (row) =>
        row.evaluation.is_published ? (
          <Badge tone="success">Đã công bố</Badge>
        ) : (
          <Badge tone="neutral">Chưa công bố</Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Link to={`/admin/evaluations/${row.evaluation.id}`}>
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
        <h2>Đánh giá thực tập</h2>
      </div>

      <div className="stat-grid">
        <StatCard label="Tổng đánh giá" value={totalCount} />
        <StatCard label="Đánh giá giảng viên" value={lecturerCount} />
        <StatCard label="Đánh giá doanh nghiệp" value={companyCount} />
        <StatCard label="Đã công bố" value={publishedCount} />
        <StatCard label="Chưa công bố" value={unpublishedCount} />
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={withPageReset(setSearchTerm)}
          placeholder="Tìm theo MSSV, họ tên SV, tên người đánh giá..."
        />

        <select value={roleFilter} onChange={(event) => withPageReset(setRoleFilter)(event.target.value)}>
          <option value="all">Tất cả vai trò</option>
          <option value="lecturer">Giảng viên</option>
          <option value="company">Doanh nghiệp</option>
        </select>

        <select value={lecturerFilter} onChange={(event) => withPageReset(setLecturerFilter)(event.target.value)}>
          <option value="all">Tất cả giảng viên</option>
          {lecturers.map((lecturer) => (
            <option key={lecturer.id} value={lecturer.id}>
              {lecturer.full_name}
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

        <select value={mentorFilter} onChange={(event) => withPageReset(setMentorFilter)(event.target.value)}>
          <option value="all">Tất cả người hướng dẫn DN</option>
          {mentors.map((mentor) => (
            <option key={mentor.id} value={mentor.id}>
              {mentor.full_name}
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

        <select value={publishFilter} onChange={(event) => withPageReset(setPublishFilter)(event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="published">Đã công bố</option>
          <option value="unpublished">Chưa công bố</option>
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pageRows} rowKey="id" emptyMessage="Chưa có đánh giá nào." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}

export default AdminEvaluationsPage
