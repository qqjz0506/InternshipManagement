import InfoCard from '../../components/common/InfoCard'
import { useCurrentCompanyMentor } from '../../hooks/useCurrentCompanyMentor'
import { useCompanies } from '../../context/CompaniesContext'
import '../../components/common/ListPage.css'

// CompanyMentors chưa có cơ chế tự chỉnh sửa profile được xác lập — ưu tiên read-only,
// không tự thêm avatar/field mới chỉ để làm UI đẹp (mục 13).
function CompanyProfilePage() {
  const mentor = useCurrentCompanyMentor()
  const { items: companies } = useCompanies()

  if (!mentor) {
    return (
      <div className="list-page">
        <h2>Hồ sơ cá nhân</h2>
        <p>Không tìm thấy hồ sơ người hướng dẫn gắn với tài khoản này.</p>
      </div>
    )
  }

  const company = companies.find((item) => item.id === mentor.company_id)

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Hồ sơ cá nhân</h2>
      </div>

      <div className="card-grid">
        <InfoCard title="Thông tin người hướng dẫn">
          <dl>
            <dt>Họ tên</dt>
            <dd>{mentor.full_name}</dd>
            <dt>Chức vụ</dt>
            <dd>{mentor.position}</dd>
            <dt>Email</dt>
            <dd>{mentor.email}</dd>
            <dt>Số điện thoại</dt>
            <dd>{mentor.phone}</dd>
          </dl>
          <p className="form-hint">Liên hệ Admin nếu cần điều chỉnh thông tin trên.</p>
        </InfoCard>

        <InfoCard title="Thông tin doanh nghiệp" isEmpty={!company} emptyMessage="Chưa xác định doanh nghiệp.">
          <dl>
            <dt>Tên doanh nghiệp</dt>
            <dd>{company?.company_name}</dd>
            <dt>Mã doanh nghiệp</dt>
            <dd>{company?.company_code}</dd>
            <dt>Địa chỉ</dt>
            <dd>{company?.address}</dd>
            <dt>Email</dt>
            <dd>{company?.email}</dd>
            <dt>Số điện thoại</dt>
            <dd>{company?.phone}</dd>
            <dt>Website</dt>
            <dd>{company?.website}</dd>
          </dl>
        </InfoCard>
      </div>
    </div>
  )
}

export default CompanyProfilePage
