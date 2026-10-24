import { createContext, useContext, useEffect, useState } from 'react'
import * as settingsApi from '../api/settingsApi'
import { useAuth } from './AuthContext'
import { canLoadSettings } from './providerAccess'

// Settings là 1 bản ghi cấu hình DUY NHẤT, không phải danh sách nhiều item — nên dùng pattern
// context đơn (giống AuthContext: 1 object + hàm cập nhật), KHÔNG dùng createApiResourceContext
// (factory đó dành cho collection có id, add/update/delete từng phần tử — không phù hợp single-row).
//
// Phase 4E-3: migrate sang GET/PUT /api/settings thật. Giá trị dưới đây chỉ còn dùng làm:
//   (a) shape mặc định an toàn trước khi GET đầu tiên trả về (tránh crash truy cập property khi
//       settings còn null, giống pattern "items mặc định []" của các Context khác),
//   (b) payload gửi lên khi bấm "Khôi phục mặc định" (xem resetSettings()).
const DEFAULT_SETTINGS = {
  systemName: 'Hệ thống quản lý thực tập tốt nghiệp',
  systemDescription:
    'Hệ thống hỗ trợ quản lý quy trình thực tập giữa sinh viên, giảng viên, doanh nghiệp và khoa.',
  // schoolName/facultyName: in lên giấy giới thiệu/phiếu kết quả thực tập (PDF, Mục 16L README) —
  // '' (không phải null) để input controlled không bị warning value={null}.
  schoolName: '',
  facultyName: '',
  defaultInternshipPeriodId: null,
  allowStudentRegistration: true,
  // Trọng số tính điểm tổng kết thực tập — phải khớp DEFAULT ở server/db/schema.sql (settings table)
  // vì resetSettings() PUT thẳng object này lên API, và settingsService.update() bắt buộc 2 field này
  // (tổng phải = 100), không gửi sẽ bị reject 400.
  lecturerWeight: 60,
  companyWeight: 40,
}

// Version của bản frontend hiện tại — hiển thị thông tin, không phải config Admin chỉnh sửa được.
// KHÔNG tồn tại trong DB (không có cột frontend_version) — backend reject cứng nếu field này có mặt
// trong payload PUT (xem IMMUTABLE_FIELDS trong settingsService.js) — không bao giờ được gửi lên API.
export const FRONTEND_VERSION = '1.0.0'

const SettingsContext = createContext(null)

// GET /api/settings thật ra mở cho MỌI role đã đăng nhập ở backend (không đổi) — nhưng actual usage
// ở frontend (grep xác nhận) chỉ có AdminSettingsPage/InternshipsPage (admin) và StudentInternshipPage
// (student) gọi useSettings(). Lecturer/Company Mentor không có trang nào cần — Phase 6A: không fetch
// cho 2 role đó để tránh request thừa, KHÔNG phải vì backend chặn (vẫn 200 nếu họ tự gọi).
// Xem client/src/context/providerAccess.js (canLoadSettings).

export function SettingsProvider({ children }) {
  const { currentUser } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!canLoadSettings(currentUser)) {
      setSettings(DEFAULT_SETTINGS)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    settingsApi
      .getSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role])

  async function updateSettings(changes) {
    setIsMutating(true)
    setError(null)
    try {
      const updated = await settingsApi.updateSettings(changes)
      setSettings(updated)
      return { success: true, settings: updated }
    } catch (err) {
      setError(err.message)
      return { success: false, message: err.message, status: err.status }
    } finally {
      setIsMutating(false)
    }
  }

  // "Khôi phục mặc định": UI hiện tại áp dụng thay đổi này NGAY LẬP TỨC (không cần bấm Lưu riêng) —
  // giữ đúng semantics đó bằng cách PUT thẳng DEFAULT_SETTINGS lên /api/settings (endpoint có sẵn,
  // không tạo endpoint reset mới, không phải "database reset" toàn hệ thống — chỉ là 1 lần gọi PUT
  // với giá trị mặc định, giống hệt một lần Save bình thường).
  async function resetSettings() {
    return updateSettings(DEFAULT_SETTINGS)
  }

  return (
    <SettingsContext.Provider
      value={{ settings, isLoading, isMutating, error, updateSettings, resetSettings, defaultSettings: DEFAULT_SETTINGS }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings phải được dùng bên trong SettingsProvider')
  }
  return context
}
