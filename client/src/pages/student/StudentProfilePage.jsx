import { useState } from 'react'
import Button from '../../components/common/Button'
import FormField from '../../components/common/FormField'
import InfoCard from '../../components/common/InfoCard'
import { useCurrentStudent } from '../../hooks/useCurrentStudent'
import { useStudents } from '../../context/StudentsContext'
import { useDepartments } from '../../context/DepartmentsContext'
import { isRequired, isValidEmail, isValidPhone } from '../../utils/validators'
import '../../components/common/ListPage.css'
import './StudentProfilePage.css'

// Sinh viên chỉ được tự sửa thông tin liên hệ (email/SĐT/địa chỉ/giới tính/ngày sinh).
// MSSV, họ tên, khoa, lớp, ngành là dữ liệu học vụ do Admin quản lý — không cho tự sửa.
function StudentProfilePage() {
  const student = useCurrentStudent()
  const { updateItem, isMutating } = useStudents()
  const { items: departments } = useDepartments()

  const [formData, setFormData] = useState(() => ({
    phone: student?.phone ?? '',
    email: student?.email ?? '',
    address: student?.address ?? '',
    gender: student?.gender ?? 'Nam',
    date_of_birth: student?.date_of_birth ?? '',
  }))
  const [errors, setErrors] = useState({})
  const [savedMessage, setSavedMessage] = useState('')
  const [submitError, setSubmitError] = useState('')

  if (!student) {
    return (
      <div className="list-page">
        <h2>Hồ sơ cá nhân</h2>
        <p>Không tìm thấy hồ sơ sinh viên gắn với tài khoản này.</p>
      </div>
    )
  }

  const department = departments.find((item) => item.id === student.department_id)

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSavedMessage('')
  }

  function validate() {
    const nextErrors = {}

    if (!isRequired(formData.email)) {
      nextErrors.email = 'Vui lòng nhập email.'
    } else if (!isValidEmail(formData.email)) {
      nextErrors.email = 'Email không hợp lệ.'
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      nextErrors.phone = 'Số điện thoại không hợp lệ.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSavedMessage('')
    setSubmitError('')
    if (!validate()) {
      return
    }
    const result = await updateItem(student.id, formData)
    if (result.success) {
      setSavedMessage('Đã lưu thông tin cá nhân.')
    } else {
      setSubmitError(result.message)
    }
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Hồ sơ cá nhân</h2>
      </div>

      <InfoCard title="Thông tin học vụ (Admin quản lý)">
        <dl>
          <dt>MSSV</dt>
          <dd>{student.student_code}</dd>
          <dt>Họ tên</dt>
          <dd>{student.full_name}</dd>
          <dt>Khoa</dt>
          <dd>{department?.department_name ?? '—'}</dd>
          <dt>Lớp</dt>
          <dd>{student.class}</dd>
          <dt>Ngành</dt>
          <dd>{student.major}</dd>
        </dl>
        <p className="form-hint">Liên hệ Admin nếu cần điều chỉnh các thông tin trên.</p>
      </InfoCard>

      <InfoCard title="Thông tin liên hệ (bạn có thể tự cập nhật)">
        <form onSubmit={handleSubmit} className="profile-form">
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(event) => handleChange('email', event.target.value)}
            />
          </FormField>

          <FormField label="Số điện thoại" htmlFor="phone" error={errors.phone}>
            <input
              id="phone"
              value={formData.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
            />
          </FormField>

          <FormField label="Giới tính" htmlFor="gender">
            <select
              id="gender"
              value={formData.gender}
              onChange={(event) => handleChange('gender', event.target.value)}
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </FormField>

          <FormField label="Ngày sinh" htmlFor="date_of_birth">
            <input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(event) => handleChange('date_of_birth', event.target.value)}
            />
          </FormField>

          <FormField label="Địa chỉ" htmlFor="address">
            <input
              id="address"
              value={formData.address}
              onChange={(event) => handleChange('address', event.target.value)}
            />
          </FormField>

          {savedMessage && <p className="profile-saved">{savedMessage}</p>}
          {submitError && <p className="form-field-error">{submitError}</p>}

          <Button type="submit" disabled={isMutating}>
            {isMutating ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </form>
      </InfoCard>
    </div>
  )
}

export default StudentProfilePage
