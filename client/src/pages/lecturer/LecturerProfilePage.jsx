import InfoCard from '../../components/common/InfoCard'
import { useCurrentLecturer } from '../../hooks/useCurrentLecturer'
import { useDepartments } from '../../context/DepartmentsContext'
import '../../components/common/ListPage.css'

// Lecturers chưa có cơ chế tự chỉnh sửa profile được xác lập (khác Students) —
// ưu tiên read-only, không tự thêm quyền/field mới chỉ để có UI đẹp (mục 10).
function LecturerProfilePage() {
  const lecturer = useCurrentLecturer()
  const { items: departments } = useDepartments()

  if (!lecturer) {
    return (
      <div className="list-page">
        <h2>Hồ sơ cá nhân</h2>
        <p>Không tìm thấy hồ sơ giảng viên gắn với tài khoản này.</p>
      </div>
    )
  }

  const department = departments.find((item) => item.id === lecturer.department_id)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Hồ sơ cá nhân</h2>
      </div>

      <InfoCard title="Thông tin giảng viên">
        <dl>
          <dt>Mã giảng viên</dt>
          <dd>{lecturer.lecturer_code}</dd>
          <dt>Họ tên</dt>
          <dd>{lecturer.full_name}</dd>
          <dt>Email</dt>
          <dd>{lecturer.email}</dd>
          <dt>Số điện thoại</dt>
          <dd>{lecturer.phone}</dd>
          <dt>Khoa</dt>
          <dd>{department?.department_name ?? '—'}</dd>
          <dt>Học hàm / Học vị</dt>
          <dd>{lecturer.position}</dd>
        </dl>
        <p className="form-hint">Liên hệ Admin nếu cần điều chỉnh thông tin trên.</p>
      </InfoCard>
    </div>
  )
}

export default LecturerProfilePage
