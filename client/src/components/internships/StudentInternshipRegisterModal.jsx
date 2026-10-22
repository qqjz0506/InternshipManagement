import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

// Sinh viên chỉ chọn Đợt thực tập — Doanh nghiệp/Giảng viên/Đề tài phân công/đề xuất sau,
// đúng luồng đã thống nhất ở module Hồ sơ thực tập bên Admin (progressive assignment).
function StudentInternshipRegisterModal({
  isOpen,
  onClose,
  onSubmit,
  periods,
  isDuplicateRegistration,
  defaultPeriodId,
  submitError,
  isSubmitting,
}) {
  const [periodId, setPeriodId] = useState('')
  const [error, setError] = useState('')

  const availablePeriods = periods.filter((period) => period.status !== 'closed')

  useEffect(() => {
    if (isOpen) {
      const hasDefault =
        defaultPeriodId && periods.some((period) => period.id === defaultPeriodId && period.status !== 'closed')
      setPeriodId(hasDefault ? String(defaultPeriodId) : '')
      setError('')
    }
  }, [isOpen, defaultPeriodId, periods])

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    if (!isRequired(periodId)) {
      setError('Vui lòng chọn đợt thực tập.')
      return
    }

    if (isDuplicateRegistration(Number(periodId))) {
      setError('Bạn đã có hồ sơ thực tập trong đợt này rồi.')
      return
    }

    onSubmit(Number(periodId))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đăng ký thực tập">
      <form onSubmit={handleSubmit}>
        <FormField label="Đợt thực tập" htmlFor="period_id" error={error}>
          <select id="period_id" value={periodId} onChange={(event) => setPeriodId(event.target.value)}>
            <option value="">-- Chọn đợt thực tập --</option>
            {availablePeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.period_name}
              </option>
            ))}
          </select>
        </FormField>

        {availablePeriods.length === 0 && (
          <p className="form-hint">Hiện chưa có đợt thực tập nào đang mở đăng ký.</p>
        )}

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default StudentInternshipRegisterModal
