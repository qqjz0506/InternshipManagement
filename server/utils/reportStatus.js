// Đồng bộ với client/src/utils/reportStatus.js — không tự tạo enum mới.
const STATUS_VALUES = ['draft', 'submitted', 'approved', 'rejected']
const REPORT_TYPE_VALUES = ['weekly', 'final']

// 'draft' tồn tại trong ENUM (Database Design) nhưng KHÔNG có UI nào (Student/Lecturer/Admin) cho set
// giá trị này — LecturerReportReviewModal.jsx và AdminReportDetailPage.jsx chỉ cho chọn 3 giá trị này.
const SETTABLE_STATUSES = ['submitted', 'approved', 'rejected']

module.exports = { STATUS_VALUES, REPORT_TYPE_VALUES, SETTABLE_STATUSES }
