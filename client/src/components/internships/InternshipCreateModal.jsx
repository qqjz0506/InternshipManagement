import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = { student_id: '', period_id: '' }

// isDuplicateRegistration: kiểm tra ràng buộc UNIQUE(student_id, period_id)
function InternshipCreateModal({
  isOpen,
  onClose,
  onSubmit,
  students,
  periods,
  isDuplicateRegistration,
  defaultPeriodId,
  submitError,
  isSubmitting,
}) {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      const hasDefault = defaultPeriodId && periods.some((period) => period.id === defaultPeriodId)
      setFormData({ ...EMPTY_FORM, period_id: hasDefault ? String(defaultPeriodId) : '' })
      setErrors({})
    }
  }, [isOpen, defaultPeriodId, periods])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.student_id)) {
      nextErrors.student_id = 'Vui lòng chọn sinh viên.'
    }

    if (!isRequired(formData.period_id)) {
      nextErrors.period_id = 'Vui lòng chọn đợt thực tập.'
    }

    if (
      isRequired(formData.student_id) &&
      isRequired(formData.period_id) &&
      isDuplicateRegistration(Number(formData.student_id), Number(formData.period_id))
    ) {
      nextErrors.period_id = 'Sinh viên này đã có hồ sơ trong đợt thực tập đã chọn.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    if (!validate()) {
      return
    }
    onSubmit({
      student_id: Number(formData.student_id),
      period_id: Number(formData.period_id),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo hồ sơ thực tập">
      <form onSubmit={handleSubmit}>
        <FormField label="Sinh viên" htmlFor="student_id" error={errors.student_id}>
          <select
            id="student_id"
            value={formData.student_id}
            onChange={(event) => handleChange('student_id', event.target.value)}
          >
            <option value="">-- Chọn sinh viên --</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_code} - {student.full_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Đợt thực tập" htmlFor="period_id" error={errors.period_id}>
          <select
            id="period_id"
            value={formData.period_id}
            onChange={(event) => handleChange('period_id', event.target.value)}
          >
            <option value="">-- Chọn đợt thực tập --</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.period_name}
              </option>
            ))}
          </select>
        </FormField>

        <p className="form-hint">
          Doanh nghiệp, giảng viên hướng dẫn và đề tài sẽ được phân công sau, ở trang chi tiết hồ sơ.
        </p>

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang tạo...' : 'Tạo hồ sơ'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default InternshipCreateModal
