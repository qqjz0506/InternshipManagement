import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const EMPTY_FORM = {
  topic_code: '',
  topic_name: '',
  description: '',
  suggested_by_student_id: '',
  company_id: '',
  status: 'proposed',
}

function TopicFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isCodeTaken,
  students,
  companies,
  submitError,
  isSubmitting,
}) {
  const isEditMode = Boolean(initialData)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData
          ? {
              ...initialData,
              suggested_by_student_id: initialData.suggested_by_student_id ?? '',
              company_id: initialData.company_id ?? '',
            }
          : EMPTY_FORM,
      )
      setErrors({})
    }
  }, [isOpen, initialData])

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.topic_code)) {
      nextErrors.topic_code = 'Vui lòng nhập mã đề tài.'
    } else if (isCodeTaken(formData.topic_code, initialData?.id)) {
      nextErrors.topic_code = 'Mã đề tài đã tồn tại.'
    }

    if (!isRequired(formData.topic_name)) {
      nextErrors.topic_name = 'Vui lòng nhập tên đề tài.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onSubmit({
      ...formData,
      suggested_by_student_id: formData.suggested_by_student_id
        ? Number(formData.suggested_by_student_id)
        : null,
      company_id: formData.company_id ? Number(formData.company_id) : null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Cập nhật đề tài' : 'Thêm đề tài'}>
      <form onSubmit={handleSubmit}>
        <FormField label="Mã đề tài" htmlFor="topic_code" error={errors.topic_code}>
          <input
            id="topic_code"
            value={formData.topic_code}
            onChange={(event) => handleChange('topic_code', event.target.value)}
          />
        </FormField>

        <FormField label="Tên đề tài" htmlFor="topic_name" error={errors.topic_name}>
          <input
            id="topic_name"
            value={formData.topic_name}
            onChange={(event) => handleChange('topic_name', event.target.value)}
          />
        </FormField>

        <FormField label="Mô tả" htmlFor="description">
          <textarea
            id="description"
            rows={3}
            value={formData.description}
            onChange={(event) => handleChange('description', event.target.value)}
          />
        </FormField>

        <FormField label="Sinh viên đề xuất (nếu có)" htmlFor="suggested_by_student_id">
          <select
            id="suggested_by_student_id"
            value={formData.suggested_by_student_id}
            onChange={(event) => handleChange('suggested_by_student_id', event.target.value)}
          >
            <option value="">-- Không có --</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_code} - {student.full_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Doanh nghiệp đề xuất (nếu có)" htmlFor="company_id">
          <select
            id="company_id"
            value={formData.company_id}
            onChange={(event) => handleChange('company_id', event.target.value)}
          >
            <option value="">-- Không có --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Trạng thái" htmlFor="status">
          <select id="status" value={formData.status} onChange={(event) => handleChange('status', event.target.value)}>
            <option value="proposed">Đề xuất</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </FormField>

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

export default TopicFormModal
