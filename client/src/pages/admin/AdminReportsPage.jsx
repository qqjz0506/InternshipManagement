import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import StatCard from '../../components/common/StatCard'
import { useDebounce } from '../../hooks/useDebounce'
import { useReports } from '../../context/ReportsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useTopics } from '../../context/TopicsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { REPORT_STATUS_META } from '../../utils/reportStatus'
import { downloadReportFile } from '../../utils/reportDownload'
import '../../components/common/ListPage.css'

const PAGE_SIZE = 8

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Ngày nộp: mới nhất trước' },
  { value: 'date_asc', label: 'Ngày nộp: cũ nhất trước' },
]

function formatReportCode(id) {
  return `BC-${String(id).padStart(3, '0')}`
}

// Reports chỉ có internship_id — mọi thông tin Student/Company/Lecturer/Topic/Period đều
// join qua Internship, không lưu quan hệ trùng lặp ở đâu khác.
function AdminReportsPage() {
  const { items: reports, isLoading, error } = useReports()
  const { internships } = useInternships()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: topics } = useTopics()
  const { items: periods } = useInternshipPeriods()

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [lecturerFilter, setLecturerFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date_desc')
  const [currentPage, setCurrentPage] = useState(1)

  const rows = useMemo(() => {
    return reports
      .map((report) => {
        const internship = internships.find((item) => item.id === report.internship_id)
        const student = students.find((item) => item.id === internship?.student_id)
        return {
          id: report.id,
          report,
          internship,
          student,
          lecturer: lecturers.find((item) => item.id === internship?.lecturer_id),
          company: companies.find((item) => item.id === internship?.company_id),
          mentor: mentors.find((item) => item.id === internship?.company_mentor_id),
          topic: topics.find((item) => item.id === internship?.topic_id),
          period: periods.find((item) => item.id === internship?.period_id),
        }
      })
      .filter((row) => row.student)
  }, [reports, internships, students, lecturers, companies, mentors, topics, periods])

  const filteredRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    const result = rows.filter((row) => {
      const matchesKeyword =
        keyword === '' ||
        row.student.student_code.toLowerCase().includes(keyword) ||
        row.student.full_name.toLowerCase().includes(keyword) ||
        (row.company?.company_name.toLowerCase().includes(keyword) ?? false)

      const matchesStatus = statusFilter === 'all' || row.report.status === statusFilter
      const matchesLecturer = lecturerFilter === 'all' || String(row.lecturer?.id) === lecturerFilter
      const matchesCompany = companyFilter === 'all' || String(row.company?.id) === companyFilter
      const matchesPeriod = periodFilter === 'all' || String(row.period?.id) === periodFilter

      return matchesKeyword && matchesStatus && matchesLecturer && matchesCompany && matchesPeriod
    })

    const sorted = [...result]
    sorted.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return a.report.submitted_at < b.report.submitted_at ? -1 : 1
      }
      return a.report.submitted_at < b.report.submitted_at ? 1 : -1
    })

    return sorted
  }, [rows, debouncedSearch, statusFilter, lecturerFilter, companyFilter, periodFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function withPageReset(setter) {
    return (value) => {
      setter(value)
      setCurrentPage(1)
    }
  }

  const totalCount = reports.length
  const statusCounts = Object.keys(REPORT_STATUS_META).reduce((acc, status) => {
    acc[status] = reports.filter((report) => report.status === status).length
    return acc
  }, {})

  const columns = [
    { key: 'code', label: 'Mã báo cáo', render: (row) => formatReportCode(row.report.id) },
    {
      key: 'student',
      label: 'Sinh viên',
      render: (row) => `${row.student.student_code} - ${row.student.full_name}`,
    },
    { key: 'company', label: 'Doanh nghiệp', render: (row) => row.company?.company_name ?? 'Chưa phân công' },
    { key: 'mentor', label: 'Người hướng dẫn DN', render: (row) => row.mentor?.full_name ?? 'Chưa phân công' },
    { key: 'lecturer', label: 'Giảng viên', render: (row) => row.lecturer?.full_name ?? 'Chưa phân công' },
    { key: 'topic', label: 'Đề tài', render: (row) => row.topic?.topic_name ?? 'Chưa có' },
    { key: 'period', label: 'Đợt thực tập', render: (row) => row.period?.period_name ?? '—' },
    { key: 'submitted_at', label: 'Ngày nộp', render: (row) => row.report.submitted_at },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <>
          <Badge tone={REPORT_STATUS_META[row.report.status].tone}>
            {REPORT_STATUS_META[row.report.status].label}
          </Badge>
          {Boolean(row.report.is_late) && (
            <Badge tone="danger" className="report-late-badge">
              Nộp trễ
            </Badge>
          )}
        </>
      ),
    },
    {
      key: 'comment',
      label: 'Nhận xét',
      render: (row) => row.report.reviewer_comment || row.report.company_comment || '—',
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="row-actions">
          <Button
            variant="secondary"
            className="btn-sm"
            disabled={!row.report.stored_file_name}
            title={row.report.stored_file_name ? undefined : 'Chưa có file'}
            onClick={async () => {
              try {
                await downloadReportFile(row.report.id, row.report.file_name)
              } catch (err) {
                window.alert(err.message)
              }
            }}
          >
            Tải xuống
          </Button>
          <Link to={`/admin/reports/${row.report.id}`}>
            <Button variant="secondary" className="btn-sm">
              Xem chi tiết
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Báo cáo thực tập</h2>
      </div>

      <div className="stat-grid">
        <StatCard label="Tổng báo cáo" value={totalCount} />
        {Object.entries(REPORT_STATUS_META).map(([status, meta]) => (
          <StatCard key={status} label={meta.label} value={statusCounts[status] ?? 0} />
        ))}
      </div>

      <div className="page-filters">
        <SearchInput
          value={searchTerm}
          onChange={withPageReset(setSearchTerm)}
          placeholder="Tìm theo MSSV, họ tên SV, tên doanh nghiệp..."
        />

        <select value={statusFilter} onChange={(event) => withPageReset(setStatusFilter)(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(REPORT_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
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

        <select value={companyFilter} onChange={(event) => withPageReset(setCompanyFilter)(event.target.value)}>
          <option value="all">Tất cả doanh nghiệp</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
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

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <>
          <DataTable columns={columns} data={pageRows} rowKey="id" emptyMessage="Chưa có báo cáo nào." />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  )
}

export default AdminReportsPage
