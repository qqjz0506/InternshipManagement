import InfoCard from '../../components/common/InfoCard'
import { useMyInternship } from '../../hooks/useMyInternship'
import { useEvaluations } from '../../context/EvaluationsContext'
import { useLecturers } from '../../context/LecturersContext'
import { useCompanyMentors } from '../../context/CompanyMentorsContext'
import { useFinalResult } from '../../hooks/useFinalResult'
import '../../components/common/ListPage.css'

// Chỉ hiển thị đánh giá đã is_published = true — sinh viên không được xem điểm chưa công bố (mục 2.2).
// Không cho sinh viên sửa điểm/kết quả ở trang này (toàn bộ chỉ đọc).
function StudentEvaluationsPage() {
  const internship = useMyInternship()
  const { items: evaluations, isLoading, error } = useEvaluations()
  const { items: lecturers } = useLecturers()
  const { items: mentors } = useCompanyMentors()
  const { finalResult } = useFinalResult(internship?.id)

  if (!internship) {
    return (
      <div className="list-page">
        <h2>Đánh giá</h2>
        <p>Bạn chưa có hồ sơ thực tập.</p>
      </div>
    )
  }

  const publishedEvaluations = evaluations.filter(
    (evaluation) => evaluation.internship_id === internship.id && evaluation.is_published,
  )

  function getEvaluatorName(evaluation) {
    if (evaluation.evaluator_role === 'lecturer') {
      return lecturers.find((lecturer) => lecturer.id === internship.lecturer_id)?.full_name ?? 'Giảng viên hướng dẫn'
    }
    return mentors.find((mentor) => mentor.id === internship.company_mentor_id)?.full_name ?? 'Người hướng dẫn doanh nghiệp'
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Đánh giá</h2>
      </div>

      {error && <p className="form-field-error">{error}</p>}

      {finalResult && (
        <InfoCard title="Điểm tổng kết thực tập">
          <dl>
            <dt>Điểm tổng kết</dt>
            <dd>
              <strong>{finalResult.finalScore}</strong>
            </dd>
            <dt>Xếp loại</dt>
            <dd>{finalResult.classification}</dd>
          </dl>
        </InfoCard>
      )}

      {isLoading ? (
        <p>Đang tải dữ liệu...</p>
      ) : publishedEvaluations.length === 0 ? (
        <InfoCard title="Kết quả đánh giá" isEmpty emptyMessage="Chưa có đánh giá nào được công bố." />
      ) : (
        publishedEvaluations.map((evaluation) => (
          <InfoCard
            key={evaluation.id}
            title={`Đánh giá từ ${evaluation.evaluator_role === 'lecturer' ? 'giảng viên' : 'doanh nghiệp'}: ${getEvaluatorName(evaluation)}`}
          >
            <dl>
              <dt>Thái độ</dt>
              <dd>{evaluation.attitude_score}</dd>
              <dt>Kỹ năng</dt>
              <dd>{evaluation.skill_score}</dd>
              <dt>Tiến độ</dt>
              <dd>{evaluation.progress_score}</dd>
              <dt>Kỷ luật</dt>
              <dd>{evaluation.discipline_score}</dd>
              <dt>Điểm tổng</dt>
              <dd>
                <strong>{evaluation.overall_score}</strong>
              </dd>
              <dt>Nhận xét</dt>
              <dd>{evaluation.comment}</dd>
              <dt>Ngày công bố</dt>
              <dd>{evaluation.published_at}</dd>
            </dl>
          </InfoCard>
        ))
      )}
    </div>
  )
}

export default StudentEvaluationsPage
