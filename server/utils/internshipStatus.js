// Đồng bộ chính xác với client/src/utils/internshipStatus.js — không tự tạo enum/luật chuyển trạng thái mới.
const STATUS_VALUES = ['pending', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled']

const ALLOWED_TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  rejected: ['pending'],
  cancelled: ['pending'],
}

module.exports = { STATUS_VALUES, ALLOWED_TRANSITIONS }
