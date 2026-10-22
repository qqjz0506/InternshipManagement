// Luật role-aware loading cho các Provider CÓ ngoại lệ so với default "bất kỳ ai đã đăng nhập"
// (Phase 6A). Tách riêng thành module JS thuần (không JSX) để có thể test tự động bằng node:test
// mà không cần render React — đây là phần logic nhạy cảm nhất (sai 1 role là lộ/thiếu dữ liệu),
// nên đáng được test trực tiếp, tách khỏi phần component.
//
// Các Context dùng createApiResourceContext mà KHÔNG truyền shouldLoad riêng (Departments,
// InternshipPeriods, Students, Lecturers, Companies, CompanyMentors, Topics, InternshipLogs,
// Reports, Evaluations) đều rơi vào default của factory (bất kỳ ai đã đăng nhập) — không cần khai
// báo gì ở đây, vì đó không phải "ngoại lệ".

export function canLoadUsers(currentUser) {
  return currentUser?.role === 'admin'
}

export function canLoadSettings(currentUser) {
  return currentUser?.role === 'admin' || currentUser?.role === 'student'
}

// Admin bổ sung sau (thông báo tự động + AdminNotificationsPage.jsx) — trước đó Admin không có
// trang Notifications nào tiêu thụ, giờ có nên thêm vào danh sách role được load.
export function canLoadNotifications(currentUser) {
  return ['admin', 'student', 'lecturer', 'company_mentor'].includes(currentUser?.role)
}
