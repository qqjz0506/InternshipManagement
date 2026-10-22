import { useState } from 'react'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InfoCard from '../../components/common/InfoCard'
import StudentInternshipRegisterModal from '../../components/internships/StudentInternshipRegisterModal'
import StudentProposeCompanyModal from '../../components/internships/StudentProposeCompanyModal'
import StudentProposeTopicModal from '../../components/topics/StudentProposeTopicModal'
import { useCurrentStudent } from '../../hooks/useCurrentStudent'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useSettings } from '../../context/SettingsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import { STATUS_META } from '../../utils/internshipStatus'
import '../../components/common/ListPage.css'
import './StudentInternshipPage.css'

const STATUS_DESCRIPTION = {
  pending: 'Hồ sơ của bạn đang chờ Admin duyệt.',
  approved: 'Hồ sơ đã được duyệt, chuẩn bị bắt đầu thực tập.',
  in_progress: 'Bạn đang trong quá trình thực tập.',
  completed: 'Bạn đã hoàn thành đợt thực tập này.',
  rejected: 'Hồ sơ đã bị từ chối. Vui lòng liên hệ Admin để biết thêm chi tiết.',
  cancelled: 'Hồ sơ đã bị hủy.',
}

// Chỉ cho đổi đề xuất doanh nghiệp/đề tài khi hồ sơ còn ở giai đoạn đầu (chưa chính thức bắt đầu)
const EDITABLE_STATUSES = ['pending', 'approved']

function StudentInternshipPage() {
  const student = useCurrentStudent()
  const internship = useMyInternship()
  const { settings } = useSettings()
  const { addInternship, updateInternship, isDuplicateRegistration, isMutating: isInternshipMutating } =
    useInternships()
  const { items: periods } = useInternshipPeriods()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: lecturers } = useLecturers()
  const { items: topics, addItem: addTopic, isMutating: isTopicMutating } = useTopics()

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [companyError, setCompanyError] = useState('')

  if (!student) {
    return (
      <div className="list-page">
        <h2>Đăng ký thực tập</h2>
        <p>Không tìm thấy hồ sơ sinh viên gắn với tài khoản này.</p>
      </div>
    )
  }

  function openRegisterModal() {
    setRegisterError('')
    setIsRegisterOpen(true)
  }

  function closeRegisterModal() {
    setIsRegisterOpen(false)
    setRegisterError('')
  }

  async function handleRegister(periodId) {
    setRegisterError('')
    const result = await addInternship({ student_id: student.id, period_id: periodId })
    if (!result.success) {
      setRegisterError(result.message)
      return
    }
    setIsRegisterOpen(false)
  }

  if (!internship) {
    return (
      <div className="list-page">
        <div className="page-header">
          <h2>Đăng ký thực tập</h2>
        </div>

        <InfoCard title="Bạn chưa có hồ sơ thực tập">
          {settings.allowStudentRegistration ? (
            <>
              <p className="info-card-empty">Hãy đăng ký để bắt đầu quy trình thực tập.</p>
              <Button onClick={openRegisterModal}>Đăng ký thực tập</Button>
            </>
          ) : (
            <p className="info-card-empty">
              Hệ thống đang tạm khóa đăng ký thực tập mới. Vui lòng liên hệ Admin để biết thêm chi tiết.
            </p>
          )}
        </InfoCard>

        <StudentInternshipRegisterModal
          isOpen={isRegisterOpen}
          onClose={closeRegisterModal}
          onSubmit={handleRegister}
          periods={periods}
          isDuplicateRegistration={(periodId) => isDuplicateRegistration(student.id, periodId)}
          defaultPeriodId={settings.defaultInternshipPeriodId}
          submitError={registerError}
          isSubmitting={isInternshipMutating}
        />
      </div>
    )
  }

  const period = periods.find((item) => item.id === internship.period_id)
  const company = companies.find((item) => item.id === internship.company_id)
  const mentor = mentors.find((item) => item.id === internship.company_mentor_id)
  const lecturer = lecturers.find((item) => item.id === internship.lecturer_id)
  const topic = topics.find((item) => item.id === internship.topic_id)
  const canEdit = EDITABLE_STATUSES.includes(internship.status)

  function openCompanyModal() {
    setCompanyError('')
    setIsCompanyModalOpen(true)
  }

  function closeCompanyModal() {
    setIsCompanyModalOpen(false)
    setCompanyError('')
  }

  async function handleProposeCompany(companyId) {
    setCompanyError('')
    // Đổi doanh nghiệp thì xóa luôn người hướng dẫn cũ vì mentor thuộc DN cũ (đảm bảo toàn vẹn dữ liệu)
    const result = await updateInternship(internship.id, { company_id: companyId, company_mentor_id: null })
    if (!result.success) {
      setCompanyError(result.message)
      return
    }
    setIsCompanyModalOpen(false)
  }

  async function handleProposeExistingTopic(topicId) {
    setTopicError('')
    const result = await updateInternship(internship.id, { topic_id: topicId })
    if (!result.success) {
      setTopicError(result.message)
      return
    }
    setIsTopicModalOpen(false)
  }

  function openTopicModal() {
    setTopicError('')
    setIsTopicModalOpen(true)
  }

  function closeTopicModal() {
    setIsTopicModalOpen(false)
    setTopicError('')
  }

  // addTopic giờ là async (TopicsContext dùng API thật từ Phase 4B-4) — phải chờ kết quả trước khi
  // dùng id thật từ backend, không còn id sinh ra đồng bộ như mock cũ (mục 6/18 Phase 4B-4).
  async function handleProposeNewTopic(newTopicValues) {
    setTopicError('')
    const result = await addTopic({
      topic_code: `DTSV${student.id}${Date.now().toString().slice(-4)}`,
      topic_name: newTopicValues.topic_name,
      description: newTopicValues.description,
      suggested_by_student_id: student.id,
      company_id: null,
      status: 'proposed',
    })

    if (!result.success) {
      setTopicError(result.message)
      return
    }

    const linkResult = await updateInternship(internship.id, { topic_id: result.item.id })
    if (!linkResult.success) {
      setTopicError(linkResult.message)
      return
    }
    setIsTopicModalOpen(false)
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Đăng ký thực tập</h2>
        <Badge tone={STATUS_META[internship.status].tone}>{STATUS_META[internship.status].label}</Badge>
      </div>
      <p className="internship-status-desc">{STATUS_DESCRIPTION[internship.status]}</p>

      <div className="card-grid">
        <InfoCard title="Đợt thực tập">
          <dl>
            <dt>Tên đợt</dt>
            <dd>{period?.period_name ?? '—'}</dd>
            <dt>Ngày bắt đầu</dt>
            <dd>{internship.start_date ?? 'Chưa xác định'}</dd>
            <dt>Ngày kết thúc</dt>
            <dd>{internship.end_date ?? 'Chưa xác định'}</dd>
          </dl>
        </InfoCard>

        <InfoCard
          title="Doanh nghiệp & người hướng dẫn"
          isEmpty={!company}
          emptyMessage="Bạn chưa chọn doanh nghiệp."
          action={
            canEdit ? (
              <Button variant="secondary" className="btn-sm" onClick={openCompanyModal}>
                {company ? 'Đổi đề xuất' : 'Chọn doanh nghiệp'}
              </Button>
            ) : null
          }
        >
          <dl>
            <dt>Doanh nghiệp</dt>
            <dd>{company?.company_name}</dd>
            <dt>Địa chỉ</dt>
            <dd>{company?.address}</dd>
            <dt>Người hướng dẫn</dt>
            <dd>{mentor ? `${mentor.full_name} (${mentor.position})` : 'Chưa phân công'}</dd>
          </dl>
        </InfoCard>

        <InfoCard title="Giảng viên hướng dẫn" isEmpty={!lecturer} emptyMessage="Chưa được phân công giảng viên.">
          <dl>
            <dt>Họ tên</dt>
            <dd>{lecturer?.full_name}</dd>
            <dt>Email</dt>
            <dd>{lecturer?.email}</dd>
          </dl>
          <p className="form-hint">Giảng viên hướng dẫn do Admin phân công.</p>
        </InfoCard>

        <InfoCard
          title="Đề tài"
          isEmpty={!topic}
          emptyMessage="Bạn chưa đề xuất đề tài."
          action={
            canEdit ? (
              <Button variant="secondary" className="btn-sm" onClick={openTopicModal}>
                {topic ? 'Đổi đề tài' : 'Đề xuất đề tài'}
              </Button>
            ) : null
          }
        >
          <dl>
            <dt>Tên đề tài</dt>
            <dd>{topic?.topic_name}</dd>
            <dt>Mô tả</dt>
            <dd>{topic?.description}</dd>
          </dl>
        </InfoCard>
      </div>

      <StudentProposeCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={closeCompanyModal}
        onSubmit={handleProposeCompany}
        companies={companies}
        currentCompanyId={internship.company_id}
        submitError={companyError}
        isSubmitting={isInternshipMutating}
      />

      <StudentProposeTopicModal
        isOpen={isTopicModalOpen}
        onClose={closeTopicModal}
        onSubmitExisting={handleProposeExistingTopic}
        onSubmitNew={handleProposeNewTopic}
        topics={topics}
        currentTopicId={internship.topic_id}
        submitError={topicError}
        isSubmitting={isTopicMutating || isInternshipMutating}
      />
    </div>
  )
}

export default StudentInternshipPage
