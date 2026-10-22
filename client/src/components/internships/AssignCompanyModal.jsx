import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'

// Cascading select: người hướng dẫn chỉ được chọn trong số mentor thuộc đúng doanh nghiệp đã chọn
function AssignCompanyModal({
  isOpen,
  onClose,
  onSubmit,
  companies,
  companyMentors,
  currentCompanyId,
  currentMentorId,
  submitError,
  isSubmitting,
}) {
  const [companyId, setCompanyId] = useState('')
  const [mentorId, setMentorId] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCompanyId(currentCompanyId ? String(currentCompanyId) : '')
      setMentorId(currentMentorId ? String(currentMentorId) : '')
    }
  }, [isOpen, currentCompanyId, currentMentorId])

  function handleCompanyChange(value) {
    setCompanyId(value)
    setMentorId('')
  }

  const mentorsOfCompany = companyMentors.filter(
    (mentor) => companyId && mentor.company_id === Number(companyId),
  )

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onSubmit({
      company_id: companyId ? Number(companyId) : null,
      company_mentor_id: mentorId ? Number(mentorId) : null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân công doanh nghiệp">
      <form onSubmit={handleSubmit}>
        <FormField label="Doanh nghiệp" htmlFor="company_id">
          <select id="company_id" value={companyId} onChange={(event) => handleCompanyChange(event.target.value)}>
            <option value="">-- Bỏ phân công --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_code} - {company.company_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Người hướng dẫn tại doanh nghiệp" htmlFor="mentor_id">
          <select
            id="mentor_id"
            value={mentorId}
            onChange={(event) => setMentorId(event.target.value)}
            disabled={!companyId}
          >
            <option value="">-- Chưa chọn --</option>
            {mentorsOfCompany.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.full_name} ({mentor.position})
              </option>
            ))}
          </select>
        </FormField>

        {companyId && mentorsOfCompany.length === 0 && (
          <p className="form-hint">Doanh nghiệp này chưa có người hướng dẫn nào.</p>
        )}

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AssignCompanyModal
