import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

// Sinh viên chỉ được chọn/đề xuất Doanh nghiệp — KHÔNG được chọn người hướng dẫn cụ thể,
// việc gán người hướng dẫn thuộc quyền Admin (mục 3: "không cho Student tự ý gán người hướng dẫn").
function StudentProposeCompanyModal({
  isOpen,
  onClose,
  onSubmit,
  companies,
  currentCompanyId,
  submitError,
  isSubmitting,
}) {
  const [companyId, setCompanyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCompanyId(currentCompanyId ? String(currentCompanyId) : '')
      setError('')
    }
  }, [isOpen, currentCompanyId])

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    if (!isRequired(companyId)) {
      setError('Vui lòng chọn doanh nghiệp.')
      return
    }

    onSubmit(Number(companyId))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chọn / đề xuất doanh nghiệp thực tập">
      <form onSubmit={handleSubmit}>
        <FormField label="Doanh nghiệp" htmlFor="company_id" error={error}>
          <select id="company_id" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">-- Chọn doanh nghiệp --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
        </FormField>

        <p className="form-hint">
          Người hướng dẫn tại doanh nghiệp sẽ được Admin phân công sau khi xác nhận.
        </p>

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi đề xuất'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default StudentProposeCompanyModal
