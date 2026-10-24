import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import AssignLecturerModal from '../../components/internships/AssignLecturerModal'
import AssignCompanyModal from '../../components/internships/AssignCompanyModal'
import AssignTopicModal from '../../components/internships/AssignTopicModal'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useTopics } from '../../context/TopicsContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useFinalResult } from '../../hooks/useFinalResult'
import { downloadIntroductionLetter, downloadResultSheet } from '../../utils/internshipDocumentDownload'
import { STATUS_META, ALLOWED_TRANSITIONS } from '../../utils/internshipStatus'
import './InternshipDetailPage.css'

// Khung tab để Nhật ký/Báo cáo/Đánh giá cắm thẳng vào sau, chỉ cần thay nội dung tab
const TABS = [
  { key: 'logs', label: 'Nhật ký thực tập' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'evaluations', label: 'Đánh giá' },
]

function InternshipDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { internships, getById, isLoading, isMutating, updateInternship, deleteInternship } = useInternships()
  const { items: students } = useStudents()
  const { items: lecturers } = useLecturers()
  const { items: companies } = useCompanies()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: topics } = useTopics()
  const { items: companyMentors } = useCompanyMentors()
  const internship = getById(id)
  const { finalResult } = useFinalResult(internship?.id)

  const [activeTab, setActiveTab] = useState('logs')
  const [isLecturerModalOpen, setIsLecturerModalOpen] = useState(false)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [progressInput, setProgressInput] = useState(internship?.progress ?? 0)
  const [lecturerError, setLecturerError] = useState('')
  const [companyAssignError, setCompanyAssignError] = useState('')
  const [topicAssignError, setTopicAssignError] = useState('')

  if (isLoading) {
    return <p>Đang tải dữ liệu...</p>
  }

  if (!internship) {
    return (
      <div className="detail-not-found">
        <p>Không tìm thấy hồ sơ thực tập.</p>
        <Link to="/admin/internships">Quay lại danh sách</Link>
      </div>
    )
  }

  const student = students.find((item) => item.id === internship.student_id)
  const department = departments.find((item) => item.id === student?.department_id)
  const period = periods.find((item) => item.id === internship.period_id)
  const company = companies.find((item) => item.id === internship.company_id)
  const mentor = companyMentors.find((item) => item.id === internship.company_mentor_id)
  const lecturer = lecturers.find((item) => item.id === internship.lecturer_id)
  const topic = topics.find((item) => item.id === internship.topic_id)

  const allowedNextStatuses = ALLOWED_TRANSITIONS[internship.status]
  const canEditProgress = !['completed', 'cancelled', 'rejected'].includes(internship.status)

  // "Đang hướng dẫn x/y" (Mục 16K README) — đếm số hồ sơ pending/approved/in_progress của từng
  // giảng viên TRONG CÙNG ĐỢT của hồ sơ đang xem, từ dữ liệu InternshipsContext đã tải sẵn (chỉ
  // hiển thị tham khảo, server vẫn là nguồn chặn thật — xem internshipService.assertLecturerCapacity).
  const lecturerCounts = internships
    .filter((item) => item.period_id === internship.period_id && ['pending', 'approved', 'in_progress'].includes(item.status))
    .reduce((acc, item) => {
      if (item.lecturer_id) {
        acc[item.lecturer_id] = (acc[item.lecturer_id] ?? 0) + 1
      }
      return acc
    }, {})

  async function handleStatusChange() {
    if (!nextStatus || isMutating) {
      return
    }

    if (nextStatus === 'completed') {
      const confirmed = window.confirm(
        'Đánh dấu hoàn thành sẽ tự động đặt tiến độ về 100%. Tiếp tục?',
      )
      if (!confirmed) {
        return
      }
      const result = await updateInternship(internship.id, { status: nextStatus, progress: 100 })
      if (!result.success) {
        window.alert(result.message)
        return
      }
      setProgressInput(100)
    } else {
      const result = await updateInternship(internship.id, { status: nextStatus })
      if (!result.success) {
        window.alert(result.message)
        return
      }
    }
    setNextStatus('')
  }

  async function handleProgressSave() {
    const value = Math.min(100, Math.max(0, Number(progressInput) || 0))
    const result = await updateInternship(internship.id, { progress: value })
    if (!result.success) {
      window.alert(result.message)
      return
    }
    setProgressInput(value)
  }

  function openLecturerModal() {
    setLecturerError('')
    setIsLecturerModalOpen(true)
  }

  function closeLecturerModal() {
    setIsLecturerModalOpen(false)
    setLecturerError('')
  }

  async function handleAssignLecturer(lecturerId) {
    const result = await updateInternship(internship.id, { lecturer_id: lecturerId })
    if (!result.success) {
      setLecturerError(result.message)
      return
    }
    setIsLecturerModalOpen(false)
  }

  function openCompanyModal() {
    setCompanyAssignError('')
    setIsCompanyModalOpen(true)
  }

  function closeCompanyModal() {
    setIsCompanyModalOpen(false)
    setCompanyAssignError('')
  }

  async function handleAssignCompany({ company_id, company_mentor_id }) {
    const result = await updateInternship(internship.id, { company_id, company_mentor_id })
    if (!result.success) {
      setCompanyAssignError(result.message)
      return
    }
    setIsCompanyModalOpen(false)
  }

  function openTopicModal() {
    setTopicAssignError('')
    setIsTopicModalOpen(true)
  }

  function closeTopicModal() {
    setIsTopicModalOpen(false)
    setTopicAssignError('')
  }

  async function handleAssignTopic(topicId) {
    const result = await updateInternship(internship.id, { topic_id: topicId })
    if (!result.success) {
      setTopicAssignError(result.message)
      return
    }
    setIsTopicModalOpen(false)
  }

  async function handleDelete() {
    const confirmed = window.confirm('Xóa hồ sơ thực tập này? Hành động không thể hoàn tác.')
    if (!confirmed) {
      return
    }
    const result = await deleteInternship(internship.id)
    if (!result.success) {
      window.alert(result.message)
      return
    }
    navigate('/admin/internships', { replace: true })
  }

  async function handleDownloadIntroductionLetter() {
    try {
      await downloadIntroductionLetter(internship.id, student?.student_code)
    } catch (err) {
      window.alert(err.message)
    }
  }

  async function handleDownloadResultSheet() {
    try {
      await downloadResultSheet(internship.id, student?.student_code)
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <div className="internship-detail">
      <div className="detail-header">
        <div>
          <Link to="/admin/internships" className="back-link">
            ← Danh sách hồ sơ thực tập
          </Link>
          <h2>{student ? `${student.full_name} (${student.student_code})` : 'Hồ sơ thực tập'}</h2>
        </div>
        <div className="detail-header-actions">
          <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
          {['approved', 'in_progress', 'completed'].includes(internship.status) && (
            <Button variant="secondary" className="btn-sm" onClick={handleDownloadIntroductionLetter}>
              Giấy giới thiệu (PDF)
            </Button>
          )}
          {internship.status === 'completed' && (
            <Button variant="secondary" className="btn-sm" onClick={handleDownloadResultSheet}>
              Phiếu kết quả (PDF)
            </Button>
          )}
          {internship.status === 'pending' && (
            <Button variant="danger" className="btn-sm" disabled={isMutating} onClick={handleDelete}>
              Xóa hồ sơ
            </Button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Thông tin sinh viên</h3>
          <dl>
            <dt>Họ tên</dt>
            <dd>{student?.full_name ?? '—'}</dd>
            <dt>MSSV</dt>
            <dd>{student?.student_code ?? '—'}</dd>
            <dt>Khoa</dt>
            <dd>{department?.department_name ?? '—'}</dd>
            <dt>Lớp</dt>
            <dd>{student?.class ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{student?.email ?? '—'}</dd>
            <dt>Điện thoại</dt>
            <dd>{student?.phone ?? '—'}</dd>
          </dl>
        </div>

        <div className="detail-card">
          <h3>Đợt thực tập</h3>
          <dl>
            <dt>Tên đợt</dt>
            <dd>{period?.period_name ?? '—'}</dd>
            <dt>Thời gian</dt>
            <dd>{period ? `${period.start_date} → ${period.end_date}` : '—'}</dd>
          </dl>
        </div>

        <div className="detail-card">
          <div className="detail-card-header">
            <h3>Đề tài</h3>
            <Button variant="secondary" className="btn-sm" onClick={openTopicModal}>
              {topic ? 'Đổi đề tài' : 'Chọn đề tài'}
            </Button>
          </div>
          {topic ? (
            <dl>
              <dt>Mã đề tài</dt>
              <dd>{topic.topic_code}</dd>
              <dt>Tên đề tài</dt>
              <dd>{topic.topic_name}</dd>
              <dt>Mô tả</dt>
              <dd>{topic.description}</dd>
            </dl>
          ) : (
            <p className="empty-hint">Chưa chọn đề tài.</p>
          )}
        </div>

        <div className="detail-card">
          <div className="detail-card-header">
            <h3>Doanh nghiệp & người hướng dẫn</h3>
            <Button variant="secondary" className="btn-sm" onClick={openCompanyModal}>
              Phân công
            </Button>
          </div>
          {company ? (
            <dl>
              <dt>Doanh nghiệp</dt>
              <dd>{company.company_name}</dd>
              <dt>Địa chỉ</dt>
              <dd>{company.address}</dd>
              <dt>Người hướng dẫn</dt>
              <dd>{mentor ? `${mentor.full_name} (${mentor.position})` : 'Chưa phân công'}</dd>
            </dl>
          ) : (
            <p className="empty-hint">Chưa phân công doanh nghiệp.</p>
          )}
        </div>

        <div className="detail-card">
          <div className="detail-card-header">
            <h3>Giảng viên hướng dẫn</h3>
            <Button variant="secondary" className="btn-sm" onClick={openLecturerModal}>
              Phân công
            </Button>
          </div>
          {lecturer ? (
            <dl>
              <dt>Họ tên</dt>
              <dd>{lecturer.full_name}</dd>
              <dt>Email</dt>
              <dd>{lecturer.email}</dd>
            </dl>
          ) : (
            <p className="empty-hint">Chưa phân công giảng viên.</p>
          )}
        </div>

        <div className="detail-card">
          <h3>Trạng thái & tiến độ</h3>

          <div className="status-control">
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              <option value="">-- Đổi trạng thái --</option>
              {allowedNextStatuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              className="btn-sm"
              onClick={handleStatusChange}
              disabled={!nextStatus || isMutating}
            >
              Cập nhật
            </Button>
          </div>
          {allowedNextStatuses.length === 0 && (
            <p className="empty-hint">Đây là trạng thái cuối, không thể thay đổi thêm.</p>
          )}

          <div className="progress-control">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${internship.progress}%` }} />
            </div>
            <input
              type="number"
              min="0"
              max="100"
              value={progressInput}
              disabled={!canEditProgress}
              onChange={(event) => setProgressInput(event.target.value)}
            />
            <Button
              variant="secondary"
              className="btn-sm"
              onClick={handleProgressSave}
              disabled={!canEditProgress || isMutating}
            >
              Lưu tiến độ
            </Button>
          </div>
        </div>

        {finalResult && (
          <div className="detail-card">
            <h3>Kết quả tổng kết</h3>
            <dl>
              <dt>Điểm tổng kết</dt>
              <dd>
                <strong>{finalResult.finalScore}</strong>
              </dd>
              <dt>Xếp loại</dt>
              <dd>{finalResult.classification}</dd>
            </dl>
          </div>
        )}
      </div>

      <div className="detail-tabs">
        <div className="tab-header">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="tab-body">
          <p>
            Nội dung "{TABS.find((tab) => tab.key === activeTab)?.label}" sẽ được xây dựng ở phase tiếp theo
            (hồ sơ #{internship.id}).
          </p>
        </div>
      </div>

      <AssignLecturerModal
        isOpen={isLecturerModalOpen}
        onClose={closeLecturerModal}
        onSubmit={handleAssignLecturer}
        lecturers={lecturers}
        currentLecturerId={internship.lecturer_id}
        studentDepartmentId={student?.department_id}
        lecturerCounts={lecturerCounts}
        submitError={lecturerError}
        isSubmitting={isMutating}
      />

      <AssignCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={closeCompanyModal}
        onSubmit={handleAssignCompany}
        companies={companies}
        companyMentors={companyMentors}
        currentCompanyId={internship.company_id}
        currentMentorId={internship.company_mentor_id}
        submitError={companyAssignError}
        isSubmitting={isMutating}
      />

      <AssignTopicModal
        isOpen={isTopicModalOpen}
        onClose={closeTopicModal}
        onSubmit={handleAssignTopic}
        topics={topics}
        currentTopicId={internship.topic_id}
        submitError={topicAssignError}
        isSubmitting={isMutating}
      />
    </div>
  )
}

export default InternshipDetailPage
