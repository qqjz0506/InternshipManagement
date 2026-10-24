const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

const IMMUTABLE_FIELDS = ['id', 'version', 'FRONTEND_VERSION', 'frontend_version']

async function get() {
  const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1')
  return rows[0] ?? null
}

async function periodExists(id) {
  const [rows] = await pool.execute('SELECT id FROM internship_periods WHERE id = ?', [id])
  return rows.length > 0
}

// UPDATE: khớp đúng AdminSettingsPage.jsx — Save gửi TOÀN BỘ draft object 1 lần (không phải partial
// merge như Internships/Logs/Reports), vì chỉ có đúng 1 form duy nhất cho toàn bộ Settings.
// FRONTEND_VERSION là hằng số hiển thị, KHÔNG thuộc object settings — từ chối rõ nếu client gửi.
async function update(payload) {
  IMMUTABLE_FIELDS.forEach((field) => {
    if (field in payload) {
      throw new AppError(400, `${field} không được phép sửa qua API (immutable / display-only).`)
    }
  })

  const {
    systemName, systemDescription, schoolName, facultyName, defaultInternshipPeriodId, allowStudentRegistration,
    lecturerWeight, companyWeight,
  } = payload

  if (typeof systemName !== 'string' || systemName.trim() === '') {
    throw new AppError(400, 'Vui lòng nhập tên hệ thống.')
  }
  if (systemDescription !== undefined && systemDescription !== null && typeof systemDescription !== 'string') {
    throw new AppError(400, 'systemDescription không hợp lệ.')
  }
  // schoolName/facultyName: optional — in lên giấy giới thiệu/phiếu kết quả thực tập (PDF, Mục 16L
  // README), không bắt buộc như systemName (hệ thống vẫn chạy được nếu Admin chưa cấu hình).
  if (schoolName !== undefined && schoolName !== null && typeof schoolName !== 'string') {
    throw new AppError(400, 'schoolName không hợp lệ.')
  }
  if (facultyName !== undefined && facultyName !== null && typeof facultyName !== 'string') {
    throw new AppError(400, 'facultyName không hợp lệ.')
  }

  let resolvedPeriodId = null
  if (defaultInternshipPeriodId !== undefined && defaultInternshipPeriodId !== null && defaultInternshipPeriodId !== '') {
    resolvedPeriodId = Number(defaultInternshipPeriodId)
    if (!(await periodExists(resolvedPeriodId))) {
      throw new AppError(400, 'Đợt thực tập mặc định không tồn tại.')
    }
  }

  if (typeof allowStudentRegistration !== 'boolean') {
    throw new AppError(400, 'allowStudentRegistration phải là boolean.')
  }

  // Trọng số tính điểm tổng kết (evaluationService.computeFinalResult) — bắt buộc số nguyên không âm
  // VÀ tổng phải đúng 100 (validate ở đây, lặp lại ở CHECK constraint DB — 2 lớp độc lập, đúng
  // convention invariant khác trong dự án, không tin riêng 1 lớp).
  if (lecturerWeight === undefined || companyWeight === undefined) {
    throw new AppError(400, 'Vui lòng nhập đầy đủ trọng số Giảng viên và Doanh nghiệp.')
  }
  const resolvedLecturerWeight = Number(lecturerWeight)
  const resolvedCompanyWeight = Number(companyWeight)
  if (
    !Number.isInteger(resolvedLecturerWeight) ||
    !Number.isInteger(resolvedCompanyWeight) ||
    resolvedLecturerWeight < 0 ||
    resolvedCompanyWeight < 0
  ) {
    throw new AppError(400, 'Trọng số phải là số nguyên không âm.')
  }
  if (resolvedLecturerWeight + resolvedCompanyWeight !== 100) {
    throw new AppError(400, 'Tổng trọng số Giảng viên và Doanh nghiệp phải bằng 100.')
  }

  await pool.execute(
    `UPDATE settings SET
      system_name = ?, system_description = ?, school_name = ?, faculty_name = ?,
      default_internship_period_id = ?, allow_student_registration = ?,
      lecturer_weight = ?, company_weight = ?
     WHERE id = 1`,
    [
      systemName,
      systemDescription ?? null,
      schoolName || null,
      facultyName || null,
      resolvedPeriodId,
      allowStudentRegistration ? 1 : 0,
      resolvedLecturerWeight,
      resolvedCompanyWeight,
    ],
  )

  return get()
}

module.exports = { get, update }
