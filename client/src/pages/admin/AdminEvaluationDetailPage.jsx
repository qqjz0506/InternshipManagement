import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import InfoCard from '../../components/common/InfoCard'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useInternships } from '../../context/InternshipsContext'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import { useCompanies } from '../../context/CompaniesContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useTopics } from '../../context/TopicsContext'
import './AdminEvaluationDetailPage.css'

const ROLE_LABEL = { lecturer: 'Giảng viên', company: 'Doanh nghiệp' }

const SCORE_FIELDS = [
  { key: 'attitude_score', label: 'Thái độ' },
  { key: 'skill_score', label: 'Kỹ năng / Chuyên môn' },
  { key: 'progress_score', label: 'Tiến độ' },
  { key: 'discipline_score', label: 'Kỷ luật / Phối hợp' },
  { key: 'overall_score', label: 'Điểm tổng' },
]

function EvaluationScoreList({ evaluation }) {
  return (
    <dl>
      {SCORE_FIELDS.map(({ key, label }) => (
        <Fragment key={key}>
          <dt>{label}</dt>
          <dd>{evaluation[key]}</dd>
        </Fragment>
      ))}
      <dt>Nhận xét</dt>
      <dd>{evaluation.comment}</dd>
    </dl>
  )
}

function AdminEvaluationDetailPage() {
  const { id } = useParams()
  const { items: evaluations, isLoading, isMutating, updateItem } = useEvaluations()
  const { internships } = useInternships()
  const { items: students } = useStudents()
  const { items: departments } = useDepartments()
  const { items: periods } = useInternshipPeriods()
  const { items: companies } = useCompanies()
  const { items: mentors } = useCompanyMentors()
  const { items: lecturers } = useLecturers()
  const { items: topics } = useTopics()

  const evaluation = evaluations.find((item) => item.id === Number(id))

  if (isLoading) {
    return <p>Đang tải dữ liệu...</p>
  }

  if (!evaluation) {
    return (
      <div className="list-page">
        <p>Không tìm thấy đánh giá này.</p>
        <Link to="/admin/evaluations">Quay lại danh sách đánh giá</Link>
      </div>
    )
  }

  const internship = internships.find((item) => item.id === evaluation.internship_id)
  const student = students.find((item) => item.id === internship?.student_id)
  const department = departments.find((item) => item.id === student?.department_id)
  const period = periods.find((item) => item.id === internship?.period_id)
  const company = companies.find((item) => item.id === internship?.company_id)
  const mentor = mentors.find((item) => item.id === internship?.company_mentor_id)
  const lecturer = lecturers.find((item) => item.id === internship?.lecturer_id)
  const topic = topics.find((item) => item.id === internship?.topic_id)

  const evaluatorName =
    evaluation.evaluator_role === 'lecturer' ? lecturer?.full_name ?? 'Chưa xác định' : mentor?.full_name ?? 'Chưa xác định'

  // Đánh giá còn lại của internship này (nếu có) — chỉ để đối chiếu, không gộp điểm.
  const otherEvaluation = evaluations.find(
    (item) => item.internship_id === evaluation.internship_id && item.id !== evaluation.id,
  )

  async function handleTogglePublish() {
    if (isMutating) {
      return
    }
    const action = evaluation.is_published ? 'Bỏ công bố' : 'Công bố'
    const confirmed = window.confirm(
      `${action} đánh giá này? ${
        evaluation.is_published ? 'Sinh viên sẽ không còn xem được đánh giá này nữa.' : 'Sinh viên sẽ xem được đánh giá này ngay sau khi công bố.'
      }`,
    )
    if (!confirmed) {
      return
    }
    // published_at do server tự tính (theo múi giờ APP_TIMEZONE) ngay khi is_published đổi — gửi
    // kèm từ client vừa dư thừa vừa sai lệch múi giờ (server luôn overwrite giá trị này, cả 2 chiều).
    const nextPublished = !evaluation.is_published
    const result = await updateItem(evaluation.id, { is_published: nextPublished })
    if (!result.success) {
      window.alert(result.message)
    }
  }

  return (
    <div className="list-page">
      <div className="detail-header">
        <div>
          <Link to="/admin/evaluations" className="back-link">
            ← Danh sách đánh giá
          </Link>
          <h2>Đánh giá: {student?.full_name}</h2>
        </div>
        <Badge tone={evaluation.is_published ? 'success' : 'neutral'}>
          {evaluation.is_published ? 'Đã công bố' : 'Chưa công bố'}
        </Badge>
      </div>

      <div className="card-grid">
        <InfoCard title="Sinh viên">
          <dl>
            <dt>MSSV</dt>
            <dd>{student?.student_code}</dd>
            <dt>Họ tên</dt>
            <dd>{student?.full_name}</dd>
            <dt>Khoa</dt>
            <dd>{department?.department_name ?? '—'}</dd>
            <dt>Lớp</dt>
            <dd>{student?.class}</dd>
          </dl>
        </InfoCard>

        <InfoCard title="Hồ sơ thực tập">
          <dl>
            <dt>Doanh nghiệp</dt>
            <dd>{company?.company_name ?? 'Chưa phân công'}</dd>
            <dt>Người hướng dẫn</dt>
            <dd>{mentor?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Giảng viên</dt>
            <dd>{lecturer?.full_name ?? 'Chưa phân công'}</dd>
            <dt>Đề tài</dt>
            <dd>{topic?.topic_name ?? 'Chưa có'}</dd>
            <dt>Đợt thực tập</dt>
            <dd>{period?.period_name ?? '—'}</dd>
          </dl>
        </InfoCard>

        <InfoCard title={`Đánh giá của ${ROLE_LABEL[evaluation.evaluator_role]}: ${evaluatorName}`}>
          <EvaluationScoreList evaluation={evaluation} />
          <p className="form-hint">
            {evaluation.is_published
              ? `Đã công bố ngày ${evaluation.published_at}.`
              : 'Chưa công bố — sinh viên chưa xem được đánh giá này.'}
          </p>
          <Button onClick={handleTogglePublish} disabled={isMutating}>
            {evaluation.is_published ? 'Bỏ công bố' : 'Công bố'}
          </Button>
        </InfoCard>

        <InfoCard
          title="Điểm tổng hợp"
          isEmpty={!otherEvaluation}
          emptyMessage="Chưa có đánh giá từ phía còn lại để đối chiếu."
        >
          {otherEvaluation && (
            <>
              <p className="form-hint">
                Đánh giá của {ROLE_LABEL[otherEvaluation.evaluator_role]}:{' '}
                {otherEvaluation.evaluator_role === 'lecturer'
                  ? lecturer?.full_name
                  : mentor?.full_name}{' '}
                — điểm tổng <strong>{otherEvaluation.overall_score}</strong>
                {otherEvaluation.is_published ? ' (đã công bố)' : ' (chưa công bố)'}
              </p>
              <p className="form-hint">
                Hệ thống hiện chưa có công thức chính thức để gộp điểm Giảng viên + Doanh nghiệp thành 1 điểm tổng
                kết — hiển thị riêng từng đánh giá để Admin tự đối chiếu.
              </p>
            </>
          )}
        </InfoCard>
      </div>
    </div>
  )
}

export default AdminEvaluationDetailPage
