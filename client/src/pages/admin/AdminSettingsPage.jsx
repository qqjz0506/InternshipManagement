import { useEffect, useState } from 'react'
import Button from '../../components/common/Button'
import FormField from '../../components/common/FormField'
import InfoCard from '../../components/common/InfoCard'
import { useSettings, FRONTEND_VERSION } from '../../context/SettingsContext'
import { useInternshipPeriods } from '../../context/InternshipPeriodsContext'
import '../../components/common/ListPage.css'
import './AdminSettingsPage.css'

// Settings chỉ lưu CẤU HÌNH (tên hệ thống, đợt mặc định, hành vi bật/tắt) — không quản lý dữ liệu
// nghiệp vụ. defaultInternshipPeriodId chỉ lưu ID, tham chiếu InternshipPeriodsContext, không copy
// dữ liệu đợt thực tập sang đây.
function AdminSettingsPage() {
  const { settings, isLoading, isMutating, error, updateSettings, resetSettings } = useSettings()
  const { items: periods } = useInternshipPeriods()

  const [draft, setDraft] = useState(settings)
  const [savedMessage, setSavedMessage] = useState('')
  const [formError, setFormError] = useState('')

  // settings chỉ có giá trị THẬT sau khi GET /api/settings trả về (bất đồng bộ) — đồng bộ draft lại
  // mỗi khi settings (nguồn dữ liệu đã lưu trên server) thay đổi, để form không hiển thị shape mặc
  // định tạm thời rồi "nhảy" sang giá trị thật.
  useEffect(() => {
    setDraft(settings)
  }, [settings])

  function handleChange(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setSavedMessage('')
    setFormError('')
  }

  // Trọng số (%) tính điểm tổng kết thực tập — tổng PHẢI = 100 (rule giống hệt server, xem
  // settingsService.update()). Chặn ở client trước (UX tức thì) nhưng server vẫn là nguồn validate
  // thật — không tin riêng client.
  const weightSum = Number(draft.lecturerWeight) + Number(draft.companyWeight)
  const weightSumValid = weightSum === 100

  async function handleSave(event) {
    event.preventDefault()
    if (isMutating) {
      return
    }
    if (!weightSumValid) {
      setFormError('Tổng trọng số Giảng viên và Doanh nghiệp phải bằng 100.')
      return
    }
    setFormError('')
    const result = await updateSettings(draft)
    if (result.success) {
      setSavedMessage('Đã lưu thay đổi.')
    } else {
      setFormError(result.message)
    }
  }

  function handleCancel() {
    setDraft(settings)
    setSavedMessage('')
    setFormError('')
  }

  async function handleReset() {
    if (isMutating) {
      return
    }
    const confirmed = window.confirm(
      'Khôi phục cấu hình về mặc định? Thao tác này chỉ ảnh hưởng cấu hình hệ thống, không xóa/đổi dữ liệu sinh viên, hồ sơ, báo cáo, tài khoản...',
    )
    if (!confirmed) {
      return
    }
    setFormError('')
    const result = await resetSettings()
    if (result.success) {
      setSavedMessage('Đã khôi phục cấu hình mặc định.')
    } else {
      setFormError(result.message)
    }
  }

  if (isLoading) {
    return (
      <div className="list-page">
        <div className="page-header">
          <h2>Cài đặt hệ thống</h2>
        </div>
        <p>Đang tải dữ liệu...</p>
      </div>
    )
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <h2>Cài đặt hệ thống</h2>
      </div>
      <p className="form-hint">Cấu hình chung của hệ thống.</p>

      {error && <p className="form-field-error">{error}</p>}

      <form onSubmit={handleSave} className="settings-form">
        <InfoCard title="Thông tin hệ thống">
          <FormField label="Tên hệ thống" htmlFor="systemName">
            <input
              id="systemName"
              value={draft.systemName}
              onChange={(event) => handleChange('systemName', event.target.value)}
            />
          </FormField>

          <FormField label="Mô tả hệ thống" htmlFor="systemDescription">
            <textarea
              id="systemDescription"
              rows={3}
              value={draft.systemDescription}
              onChange={(event) => handleChange('systemDescription', event.target.value)}
            />
          </FormField>

          <FormField label="Tên trường (in trên giấy tờ PDF)" htmlFor="schoolName">
            <input
              id="schoolName"
              value={draft.schoolName ?? ''}
              onChange={(event) => handleChange('schoolName', event.target.value)}
              placeholder="VD: TRƯỜNG ĐẠI HỌC ..."
            />
          </FormField>

          <FormField label="Tên khoa (in trên giấy tờ PDF)" htmlFor="facultyName">
            <input
              id="facultyName"
              value={draft.facultyName ?? ''}
              onChange={(event) => handleChange('facultyName', event.target.value)}
              placeholder="VD: KHOA CÔNG NGHỆ THÔNG TIN"
            />
          </FormField>
          <p className="form-hint">
            Dùng để in lên Giấy giới thiệu thực tập và Phiếu kết quả thực tập (PDF) — để trống nếu chưa cấu hình.
          </p>

          <FormField label="Phiên bản" htmlFor="version">
            <input id="version" value={FRONTEND_VERSION} disabled />
          </FormField>
          <p className="form-hint">Phiên bản frontend hiện tại — chỉ mang tính hiển thị, chưa phải bản phát hành chính thức.</p>
        </InfoCard>

        <InfoCard title="Đợt thực tập">
          <FormField label="Đợt thực tập mặc định" htmlFor="defaultInternshipPeriodId">
            <select
              id="defaultInternshipPeriodId"
              value={draft.defaultInternshipPeriodId ?? ''}
              onChange={(event) =>
                handleChange('defaultInternshipPeriodId', event.target.value ? Number(event.target.value) : null)
              }
              disabled={periods.length === 0}
            >
              <option value="">-- Không đặt mặc định --</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_name}
                </option>
              ))}
            </select>
          </FormField>
          {periods.length === 0 ? (
            <p className="form-hint">Chưa có đợt thực tập nào trong hệ thống.</p>
          ) : (
            <p className="form-hint">
              Đợt này sẽ được gợi ý sẵn khi Sinh viên đăng ký thực tập hoặc Admin tạo hồ sơ thực tập mới.
            </p>
          )}
        </InfoCard>

        <InfoCard title="Trọng số điểm tổng kết thực tập">
          <FormField label="Trọng số Giảng viên (%)" htmlFor="lecturerWeight">
            <input
              id="lecturerWeight"
              type="number"
              min={0}
              max={100}
              value={draft.lecturerWeight}
              onChange={(event) => handleChange('lecturerWeight', Number(event.target.value))}
            />
          </FormField>
          <FormField label="Trọng số Doanh nghiệp (%)" htmlFor="companyWeight">
            <input
              id="companyWeight"
              type="number"
              min={0}
              max={100}
              value={draft.companyWeight}
              onChange={(event) => handleChange('companyWeight', Number(event.target.value))}
            />
          </FormField>
          <p className={weightSumValid ? 'form-hint' : 'form-field-error'}>
            Tổng hiện tại: {weightSum}% — {weightSumValid ? 'hợp lệ.' : 'phải bằng 100% mới lưu được.'}
          </p>
          <p className="form-hint">
            Điểm tổng kết thực tập = Điểm giảng viên × trọng số + Điểm doanh nghiệp × trọng số, tính khi cả 2 đánh
            giá đã công bố.
          </p>
        </InfoCard>

        <InfoCard title="Hành vi hệ thống">
          <label className="checkbox-field" htmlFor="allowStudentRegistration">
            <input
              id="allowStudentRegistration"
              type="checkbox"
              checked={draft.allowStudentRegistration}
              onChange={(event) => handleChange('allowStudentRegistration', event.target.checked)}
            />
            Cho phép sinh viên đăng ký thực tập mới
          </label>
          <p className="form-hint">
            Khi tắt, trang "Đăng ký thực tập" của Sinh viên sẽ ẩn nút đăng ký và hiển thị thông báo tạm khóa.
          </p>
        </InfoCard>

        {formError && <p className="form-field-error">{formError}</p>}
        {savedMessage && <p className="settings-saved">{savedMessage}</p>}

        <div className="settings-actions">
          <Button type="submit" disabled={isMutating || !weightSumValid}>
            Lưu thay đổi
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={isMutating}>
            Hủy
          </Button>
          <Button type="button" variant="danger" onClick={handleReset} disabled={isMutating}>
            Khôi phục mặc định
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AdminSettingsPage
