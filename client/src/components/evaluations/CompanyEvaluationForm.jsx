import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { useEvaluations } from '../../context/EvaluationsContext'

// Mirror của LecturerEvaluationForm nhưng evaluator_role='company' — dùng đúng model Evaluation
// hiện có (attitude/skill/progress/discipline/overall + comment), không tạo tiêu chí mới,
// không tạo evaluator_id trỏ Users.
const EMPTY_SCORES = {
  attitude_score: '',
  skill_score: '',
  progress_score: '',
  discipline_score: '',
}

// overall_score KHÔNG còn là field client gửi được (rule "Business Rules V2" — server tự tính từ 4
// điểm thành phần, reject 400 nếu gửi kèm) — chỉ còn 4 field thành phần thật sự editable, điểm tổng
// hiển thị read-only, tính lại tại chỗ mỗi khi 1 trong 4 ô này đổi (computeOverallScore).
const SCORE_FIELDS = [
  { key: 'attitude_score', label: 'Thái độ làm việc (0-10)' },
  { key: 'skill_score', label: 'Chuyên môn (0-10)' },
  { key: 'progress_score', label: 'Tiến độ (0-10)' },
  { key: 'discipline_score', label: 'Kỷ luật / khả năng phối hợp (0-10)' },
]

// Khớp đúng công thức backend (evaluationService.computeOverallScore): trung bình 4 điểm thành phần,
// làm tròn 1 chữ số thập phân — chỉ để HIỂN THỊ preview, giá trị thật do server tính khi lưu.
function computeOverallScore(formData) {
  const hasEmpty = SCORE_FIELDS.some(({ key }) => formData[key] === '')
  const values = SCORE_FIELDS.map(({ key }) => Number(formData[key]))
  if (hasEmpty || values.some((value) => Number.isNaN(value))) {
    return ''
  }
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

function CompanyEvaluationForm({ isOpen, onClose, internshipId, studentName }) {
  const { items: evaluations, isMutating, addItem, updateItem } = useEvaluations()
  const existing = evaluations.find(
    (evaluation) => evaluation.internship_id === internshipId && evaluation.evaluator_role === 'company',
  )
  // is_published trả về từ MySQL dạng 0/1 (TINYINT), không phải boolean thật — so sánh == thay vì ===.
  const isPublished = Boolean(existing?.is_published)

  const [formData, setFormData] = useState(EMPTY_SCORES)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData(
        existing
          ? {
              attitude_score: existing.attitude_score,
              skill_score: existing.skill_score,
              progress_score: existing.progress_score,
              discipline_score: existing.discipline_score,
            }
          : EMPTY_SCORES,
      )
      setComment(existing?.comment ?? '')
      setError('')
    }
  }, [isOpen, existing])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const invalid = SCORE_FIELDS.some(({ key }) => {
      const value = Number(formData[key])
      return formData[key] === '' || Number.isNaN(value) || value < 0 || value > 10
    })
    if (invalid) {
      setError('Vui lòng nhập đủ điểm thành phần, giá trị từ 0 đến 10.')
      return false
    }
    return true
  }

  async function handleSave(event) {
    event.preventDefault()
    if (isPublished || isMutating || !validate()) {
      return
    }

    // overall_score KHÔNG gửi lên server (rule mới — server tự tính, reject 400 nếu gửi kèm).
    const scores = {
      attitude_score: Number(formData.attitude_score),
      skill_score: Number(formData.skill_score),
      progress_score: Number(formData.progress_score),
      discipline_score: Number(formData.discipline_score),
      comment,
    }

    // UPDATE: internship_id/evaluator_role là immutable ở backend — KHÔNG gửi lại khi sửa bản ghi đã
    // tồn tại (mismatch phát hiện ở Phase 4E-1, giống LecturerEvaluationForm.jsx).
    const result = existing
      ? await updateItem(existing.id, scores)
      : await addItem({
          internship_id: internshipId,
          evaluator_role: 'company',
          ...scores,
          is_published: false,
          published_at: null,
        })

    if (!result.success) {
      setError(result.message)
      return
    }
    onClose()
  }

  async function handlePublish() {
    if (!existing || isMutating) {
      return
    }
    const confirmed = window.confirm(
      'Công bố đánh giá để sinh viên xem được? Sau khi công bố sẽ không thể sửa điểm nữa.',
    )
    if (!confirmed) {
      return
    }
    // published_at do server tự tính (theo múi giờ APP_TIMEZONE) ngay khi is_published đổi — gửi
    // kèm từ client vừa dư thừa vừa sai lệch múi giờ (server luôn overwrite giá trị này).
    const result = await updateItem(existing.id, { is_published: true })
    if (!result.success) {
      setError(result.message)
      return
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Đánh giá sinh viên: ${studentName}`}>
      <form onSubmit={handleSave}>
        {isPublished && <p className="form-hint">Đánh giá đã công bố, không thể chỉnh sửa.</p>}

        {SCORE_FIELDS.map(({ key, label }) => (
          <FormField key={key} label={label} htmlFor={key}>
            <input
              id={key}
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={formData[key]}
              disabled={isPublished}
              onChange={(event) => handleChange(key, event.target.value)}
            />
          </FormField>
        ))}

        <FormField label="Điểm tổng (0-10)" htmlFor="overall_score" error={error}>
          <input id="overall_score" type="number" value={computeOverallScore(formData)} disabled readOnly />
        </FormField>

        <FormField label="Nhận xét chung" htmlFor="comment">
          <textarea
            id="comment"
            rows={3}
            value={comment}
            disabled={isPublished}
            onChange={(event) => setComment(event.target.value)}
          />
        </FormField>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isMutating}>
            Đóng
          </Button>
          {!isPublished && (
            <Button type="submit" disabled={isMutating}>
              {isMutating ? 'Đang lưu...' : 'Lưu nháp'}
            </Button>
          )}
          {!isPublished && existing && (
            <Button type="button" onClick={handlePublish} disabled={isMutating}>
              Công bố
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default CompanyEvaluationForm
