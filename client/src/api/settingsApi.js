import { apiClient } from './apiClient'

// MISMATCH phát hiện ở Phase 4E-3: backend GET trả snake_case (SELECT * trực tiếp từ MySQL:
// system_name, system_description, default_internship_period_id, allow_student_registration), còn
// PUT lại destructure CAMELCASE (settingsService.update()). Settings là entity DUY NHẤT trong toàn
// dự án có khác biệt casing 2 chiều này — xử lý bằng 1 mapper DUY NHẤT ở đây (API boundary), không
// rải rác trong Context/Page, đúng nguyên tắc mapping đã áp dụng từ Phase 4B-1 (mục 5: "mapper tại
// API boundary, không rải trong component"). FRONTEND_VERSION KHÔNG map vì không tồn tại trong DB
// (hằng số hiển thị thuần frontend, xem SettingsContext.jsx).
function toCamelCase(row) {
  if (!row) {
    return row
  }
  return {
    systemName: row.system_name,
    systemDescription: row.system_description,
    defaultInternshipPeriodId: row.default_internship_period_id,
    // allow_student_registration trả về 0/1 (TINYINT qua mysql2) — ép Boolean() tường minh để tránh
    // lặp lại lỗi so sánh `=== true` đã gặp với is_published ở Phase 4E-1.
    allowStudentRegistration: Boolean(row.allow_student_registration),
    // lecturer_weight/company_weight: trọng số (%) tính điểm tổng kết thực tập — TINYINT qua mysql2
    // trả về number sẵn, Number() chỉ để tường minh/an toàn (đúng convention field số khác).
    lecturerWeight: Number(row.lecturer_weight),
    companyWeight: Number(row.company_weight),
  }
}

export async function getSettings() {
  const row = await apiClient.get('/settings')
  return toCamelCase(row)
}

export async function updateSettings(payload) {
  const row = await apiClient.put('/settings', payload)
  return toCamelCase(row)
}
