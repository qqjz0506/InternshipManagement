const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

// Resolve đúng 1 lần "profile tương ứng với user đang đăng nhập" — dùng chung cho mọi resource
// cần ownership, tránh lặp lại query giống nhau ở 10 chỗ (mục 17: không duplicate logic).
// users 1:0..1 students/lecturers/company_mentors — nếu user có role tương ứng nhưng CHƯA được
// Admin liên kết profile (user_id chưa gán), trả về null — nghĩa là không sở hữu gì cả (mọi check
// ownership sẽ tự nhiên fail, không throw ở đây để controller/service tự quyết định message phù hợp).
async function getStudentProfile(userId) {
  const [rows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [userId])
  return rows[0] ?? null
}

async function getLecturerProfile(userId) {
  const [rows] = await pool.execute('SELECT * FROM lecturers WHERE user_id = ?', [userId])
  return rows[0] ?? null
}

async function getCompanyMentorProfile(userId) {
  const [rows] = await pool.execute('SELECT * FROM company_mentors WHERE user_id = ?', [userId])
  return rows[0] ?? null
}

// Trả về { studentId, lecturerId, companyMentorId } ứng với currentUser — field không áp dụng cho
// role hiện tại (hoặc chưa liên kết profile) sẽ là null.
async function resolveOwnProfileIds(currentUser) {
  if (currentUser.role === 'student') {
    const profile = await getStudentProfile(currentUser.id)
    return { studentId: profile?.id ?? null, lecturerId: null, companyMentorId: null }
  }
  if (currentUser.role === 'lecturer') {
    const profile = await getLecturerProfile(currentUser.id)
    return { studentId: null, lecturerId: profile?.id ?? null, companyMentorId: null }
  }
  if (currentUser.role === 'company_mentor') {
    const profile = await getCompanyMentorProfile(currentUser.id)
    return { studentId: null, lecturerId: null, companyMentorId: profile?.id ?? null }
  }
  return { studentId: null, lecturerId: null, companyMentorId: null }
}

// Kiểm tra 1 Internship có thuộc scope của currentUser hay không (admin luôn true).
function isOwnInternship(internship, currentUser, ownIds) {
  if (currentUser.role === 'admin') return true
  if (currentUser.role === 'student') return internship.student_id === ownIds.studentId
  if (currentUser.role === 'lecturer') return internship.lecturer_id === ownIds.lecturerId
  if (currentUser.role === 'company_mentor') return internship.company_mentor_id === ownIds.companyMentorId
  return false
}

// Dùng cho thông báo tự động (notificationService.notify) — cần user_id + tên hiển thị từ 1 profile
// ID (students/lecturers/company_mentors.id), KHÔNG PHẢI từ currentUser.id như các hàm *Profile ở
// trên (những hàm đó đi theo chiều ngược: user_id -> profile). user_id có thể NULL (profile chưa
// liên kết tài khoản đăng nhập) — caller tự xử lý qua notify() (bỏ qua nếu userId rỗng, không throw).
async function getStudentBasicInfo(id) {
  if (!id) return null
  const [rows] = await pool.execute('SELECT user_id, full_name, student_code FROM students WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getLecturerBasicInfo(id) {
  if (!id) return null
  const [rows] = await pool.execute('SELECT user_id, full_name FROM lecturers WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getCompanyMentorBasicInfo(id) {
  if (!id) return null
  const [rows] = await pool.execute('SELECT user_id, full_name FROM company_mentors WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getAdminUserIds() {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin'")
  return rows.map((row) => row.id)
}

async function getInternshipOrThrow(internshipId) {
  const [rows] = await pool.execute('SELECT * FROM internships WHERE id = ?', [internshipId])
  const internship = rows[0]
  if (!internship) {
    throw new AppError(404, 'Internship not found')
  }
  return internship
}

// Dùng cho mọi resource con của Internship (logs/reports/evaluations): load Internship cha rồi
// chặn 403 nếu currentUser không sở hữu — convention thống nhất 403 (đã biết danh tính, sai phạm vi).
async function assertOwnInternshipById(internshipId, currentUser) {
  const internship = await getInternshipOrThrow(internshipId)
  const ownIds = await resolveOwnProfileIds(currentUser)
  if (!isOwnInternship(internship, currentUser, ownIds)) {
    throw new AppError(403, 'Bạn không có quyền truy cập hồ sơ thực tập này.')
  }
  return internship
}

module.exports = {
  getStudentProfile,
  getLecturerProfile,
  getCompanyMentorProfile,
  resolveOwnProfileIds,
  isOwnInternship,
  getInternshipOrThrow,
  assertOwnInternshipById,
  getStudentBasicInfo,
  getLecturerBasicInfo,
  getCompanyMentorBasicInfo,
  getAdminUserIds,
}
