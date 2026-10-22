// MOCK_USERS đã bị loại bỏ ở Phase 4F-2 — UsersContext giờ lấy dữ liệu thật từ GET /api/users,
// bảng `users` trong MySQL là source of truth duy nhất cho tài khoản. File này chỉ còn giữ các hằng
// số label/routing thuần túy (không phải dữ liệu tài khoản), vẫn được dùng bởi AdminAccountsPage,
// AccountFormModal, LoginPage.
export const ROLE_LABELS = {
  admin: 'Quản trị viên',
  student: 'Sinh viên',
  lecturer: 'Giảng viên',
  company_mentor: 'Doanh nghiệp',
}

export const ROLE_HOME_PATH = {
  admin: '/admin/dashboard',
  student: '/student/dashboard',
  lecturer: '/lecturer/dashboard',
  company_mentor: '/company/dashboard',
}

// Dùng bởi Topbar.jsx (badge thông báo) — mỗi role có đúng 1 trang Notifications riêng.
export const NOTIFICATIONS_PATH_BY_ROLE = {
  admin: '/admin/notifications',
  student: '/student/notifications',
  lecturer: '/lecturer/notifications',
  company_mentor: '/company/notifications',
}
