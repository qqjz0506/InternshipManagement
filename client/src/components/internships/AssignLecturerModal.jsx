import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'

// Mặc định chỉ gợi ý giảng viên cùng khoa với sinh viên, có thể mở rộng xem tất cả khoa
function AssignLecturerModal({
  isOpen,
  onClose,
  onSubmit,
  lecturers,
  currentLecturerId,
  studentDepartmentId,
  // lecturerCounts: { [lecturerId]: số hồ sơ đang hướng dẫn (pending/approved/in_progress) trong
  // CÙNG đợt của hồ sơ đang xem } — tính CLIENT-SIDE từ InternshipsContext đã tải sẵn (chỉ hiển thị
  // tham khảo, server vẫn là nguồn chặn thật qua lecturers.max_students, xem internshipService.js).
  lecturerCounts = {},
  submitError,
  isSubmitting,
}) {
  const [lecturerId, setLecturerId] = useState('')
  const [showAllDepartments, setShowAllDepartments] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLecturerId(currentLecturerId ? String(currentLecturerId) : '')
      setShowAllDepartments(false)
    }
  }, [isOpen, currentLecturerId])

  const visibleLecturers = showAllDepartments
    ? lecturers
    : lecturers.filter((lecturer) => lecturer.department_id === studentDepartmentId)

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onSubmit(lecturerId ? Number(lecturerId) : null)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân công giảng viên hướng dẫn">
      <form onSubmit={handleSubmit}>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={showAllDepartments}
            onChange={(event) => setShowAllDepartments(event.target.checked)}
          />
          Hiển thị giảng viên tất cả các khoa
        </label>

        <FormField label="Giảng viên hướng dẫn" htmlFor="lecturer_id">
          <select id="lecturer_id" value={lecturerId} onChange={(event) => setLecturerId(event.target.value)}>
            <option value="">-- Bỏ phân công --</option>
            {visibleLecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.lecturer_code} - {lecturer.full_name} (đang hướng dẫn {lecturerCounts[lecturer.id] ?? 0}/{lecturer.max_students})
              </option>
            ))}
          </select>
        </FormField>

        {visibleLecturers.length === 0 && (
          <p className="form-hint">Không có giảng viên nào phù hợp trong khoa này.</p>
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

export default AssignLecturerModal
