import { useEffect, useState } from 'react'
import StatCard from '../../components/common/StatCard'
import InfoCard from '../../components/common/InfoCard'
import BarBreakdown from '../../components/common/BarBreakdown'
import DataTable from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import { useCompanies } from '../../context/CompaniesContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import { REPORT_STATUS_META } from '../../utils/reportStatus'
import * as exportApi from '../../api/exportApi'
import * as statisticsApi from '../../api/statisticsApi'
import { triggerBlobDownload } from '../../utils/downloadFile'
import '../../components/common/ListPage.css'
import './AdminStatisticsPage.css'

// Toàn bộ số liệu ở trang này được tính SẴN ở server (GET /api/statistics/summary — SQL GROUP BY
// theo khoa/đợt/doanh nghiệp/trạng thái, xem server/services/statisticsService.js), KHÔNG còn tải
// toàn bộ Context (students/internships/reports/evaluations) về rồi reduce ở client như trước. Filter
// (Đợt/Khoa/Doanh nghiệp) chỉ là state UI cục bộ, trigger refetch API mỗi khi đổi.
function AdminStatisticsPage() {
  const { items: companies } = useCompanies()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()

  const [periodFilter, setPeriodFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [exportingTarget, setExportingTarget] = useState(null) // 'internships' | 'evaluations' | null
  const [exportError, setExportError] = useState('')
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Export dùng ĐÚNG filter đang áp dụng trên trang (period/department/company) — không tạo bộ filter
  // riêng cho export (mục 14 Phase 5). 'all' nghĩa là không áp filter đó.
  function currentFilters() {
    return {
      period_id: periodFilter === 'all' ? undefined : periodFilter,
      department_id: departmentFilter === 'all' ? undefined : departmentFilter,
      company_id: companyFilter === 'all' ? undefined : companyFilter,
    }
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    statisticsApi
      .getSummary(currentFilters())
      .then((data) => {
        if (!cancelled) {
          setSummary(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, departmentFilter, companyFilter])

  async function handleExport(target, exportFn) {
    if (exportingTarget) {
      return
    }
    setExportError('')
    setExportingTarget(target)
    try {
      const { blob, filename } = await exportFn(currentFilters())
      triggerBlobDownload(blob, filename ?? `${target}.xlsx`)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExportingTarget(null)
    }
  }

  const filterBar = (
    <div className="page-filters">
      <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
        <option value="all">Tất cả đợt thực tập</option>
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.period_name}
          </option>
        ))}
      </select>

      <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
        <option value="all">Tất cả khoa/bộ môn</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.department_name}
          </option>
        ))}
      </select>

      <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
        <option value="all">Tất cả doanh nghiệp</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.company_name}
          </option>
        ))}
      </select>
    </div>
  )

  const header = (
    <div className="page-header">
      <h2>Thống kê</h2>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button
          variant="secondary"
          disabled={Boolean(exportingTarget)}
          onClick={() => handleExport('internships', exportApi.exportInternships)}
        >
          {exportingTarget === 'internships' ? 'Đang xuất...' : 'Xuất thông tin thực tập (.xlsx)'}
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(exportingTarget)}
          onClick={() => handleExport('evaluations', exportApi.exportEvaluations)}
        >
          {exportingTarget === 'evaluations' ? 'Đang xuất...' : 'Xuất đánh giá (.xlsx)'}
        </Button>
      </div>
    </div>
  )

  if (isLoading && !summary) {
    return (
      <div className="list-page">
        {header}
        {exportError && <p className="form-field-error">{exportError}</p>}
        {filterBar}
        <p>Đang tải dữ liệu...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="list-page">
        {header}
        {filterBar}
        <p className="form-field-error">{loadError}</p>
      </div>
    )
  }

  const { kpi, byStatus, byDepartment, byPeriod, byCompany, reports, evaluations } = summary

  const statusRows = Object.entries(STATUS_META).map(([status, meta]) => ({
    label: meta.label,
    value: byStatus[status] ?? 0,
  }))

  const departmentChartRows = byDepartment.map((row) => ({ label: row.department_name, value: row.total_students }))

  const notStartedCount = (byStatus.pending ?? 0) + (byStatus.approved ?? 0)
  const progressRows = [
    { label: 'Chưa bắt đầu', value: notStartedCount },
    { label: 'Đang thực tập', value: byStatus.in_progress ?? 0 },
    { label: 'Đã hoàn thành', value: byStatus.completed ?? 0 },
  ]

  const statusColumns = Object.keys(STATUS_META).map((status) => ({
    key: status,
    label: STATUS_META[status].label,
    render: (row) => row[status],
  }))

  const companyChartRows = byCompany
    .filter((row) => row.student_count > 0)
    .map((row) => ({ label: row.company_name, value: row.student_count }))

  const reportStatusRows = Object.entries(REPORT_STATUS_META).map(([status, meta]) => ({
    label: meta.label,
    value: reports.byStatus[status] ?? 0,
  }))

  return (
    <div className="list-page">
      {header}

      {exportError && <p className="form-field-error">{exportError}</p>}

      {filterBar}

      {/* KPI tổng quan */}
      <div className="stat-grid">
        <StatCard label="Tổng sinh viên" value={kpi.totalStudents} />
        <StatCard label="Hồ sơ thực tập" value={kpi.totalInternships} />
        <StatCard label="Hồ sơ chờ duyệt" value={byStatus.pending ?? 0} />
        <StatCard label="Đang thực tập" value={byStatus.in_progress ?? 0} />
        <StatCard label="Đã hoàn thành" value={byStatus.completed ?? 0} />
        <StatCard label="Doanh nghiệp tham gia" value={kpi.companiesInScope} />
        <StatCard label="Giảng viên tham gia" value={kpi.lecturersInScope} />
        <StatCard label="Báo cáo" value={kpi.totalReports} />
        <StatCard label="Đánh giá" value={kpi.totalEvaluations} />
      </div>

      {/* Trạng thái hồ sơ + Tiến độ */}
      <div className="card-grid">
        <InfoCard title="Phân bố trạng thái hồ sơ thực tập">
          <BarBreakdown rows={statusRows} />
        </InfoCard>

        <InfoCard title="Tiến độ thực tập (gộp nhóm)">
          <BarBreakdown rows={progressRows} />
        </InfoCard>
      </div>

      {/* Theo khoa/bộ môn */}
      <div className="statistics-section">
        <h3>Thống kê theo khoa/bộ môn</h3>
        <div className="card-grid">
          <InfoCard title="Số sinh viên theo khoa">
            <BarBreakdown rows={departmentChartRows} />
          </InfoCard>
          <InfoCard title="Bảng chi tiết theo khoa">
            <DataTable
              rowKey="id"
              data={byDepartment}
              emptyMessage="Chưa có dữ liệu."
              columns={[
                { key: 'department_name', label: 'Khoa/Bộ môn' },
                { key: 'total_students', label: 'Tổng sinh viên' },
                { key: 'registered', label: 'Đã đăng ký thực tập' },
                { key: 'in_progress', label: 'Đang thực tập' },
                { key: 'completed', label: 'Đã hoàn thành' },
              ]}
            />
          </InfoCard>
        </div>
      </div>

      {/* Theo đợt thực tập */}
      <div className="statistics-section">
        <h3>Thống kê theo đợt thực tập</h3>
        <InfoCard title="Bảng tổng hợp theo đợt">
          <DataTable
            rowKey="id"
            data={byPeriod}
            emptyMessage="Chưa có dữ liệu."
            columns={[
              { key: 'period_name', label: 'Đợt thực tập' },
              { key: 'total', label: 'Tổng hồ sơ' },
              ...statusColumns,
            ]}
          />
        </InfoCard>
      </div>

      {/* Theo doanh nghiệp */}
      <div className="statistics-section">
        <h3>Thống kê theo doanh nghiệp</h3>
        <p className="statistics-note">
          Hệ thống hiện có {companies.length} doanh nghiệp — hiển thị đầy đủ, sắp xếp theo số sinh viên giảm dần.
        </p>
        <div className="card-grid">
          <InfoCard
            title="Số sinh viên thực tập theo doanh nghiệp"
            isEmpty={companyChartRows.length === 0}
            emptyMessage="Chưa có sinh viên nào được phân công doanh nghiệp."
          >
            <BarBreakdown rows={companyChartRows} />
          </InfoCard>
          <InfoCard title="Bảng chi tiết theo doanh nghiệp">
            <DataTable
              rowKey="id"
              data={byCompany}
              emptyMessage="Chưa có dữ liệu."
              columns={[
                { key: 'company_name', label: 'Doanh nghiệp' },
                { key: 'mentor_count', label: 'Số mentor' },
                { key: 'student_count', label: 'Số sinh viên' },
                { key: 'in_progress', label: 'Đang thực tập' },
                { key: 'completed', label: 'Đã hoàn thành' },
              ]}
            />
          </InfoCard>
        </div>
      </div>

      {/* Báo cáo */}
      <div className="statistics-section">
        <h3>Thống kê báo cáo</h3>
        <div className="stat-grid">
          <StatCard label="Tổng báo cáo" value={reports.total} />
          <StatCard label="Đã có nhận xét" value={reports.withFeedback} />
        </div>
        <InfoCard title="Phân bố theo trạng thái báo cáo">
          <BarBreakdown rows={reportStatusRows} />
        </InfoCard>
      </div>

      {/* Đánh giá */}
      <div className="statistics-section">
        <h3>Thống kê đánh giá</h3>
        <div className="stat-grid">
          <StatCard label="Tổng đánh giá" value={evaluations.total} />
          <StatCard label="Đánh giá từ giảng viên" value={evaluations.lecturerCount} />
          <StatCard label="Đánh giá từ doanh nghiệp" value={evaluations.companyCount} />
          <StatCard label="Đã công bố" value={evaluations.publishedCount} />
          <StatCard label="Điểm TB (Giảng viên)" value={evaluations.lecturerAverage ?? 'Chưa có dữ liệu'} />
          <StatCard label="Điểm TB (Doanh nghiệp)" value={evaluations.companyAverage ?? 'Chưa có dữ liệu'} />
        </div>
      </div>
    </div>
  )
}

export default AdminStatisticsPage
