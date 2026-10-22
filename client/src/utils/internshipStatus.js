export const STATUS_META = {
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'info' },
  in_progress: { label: 'Đang thực tập', tone: 'success' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
}

// Chỉ cho phép chuyển đúng thứ tự nghiệp vụ, tránh nhảy cóc (mục 10)
export const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  rejected: ['pending'],
  cancelled: ['pending'],
}
