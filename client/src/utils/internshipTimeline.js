// Sinh danh sách bước timeline từ CHÍNH dữ liệu Internship/Logs/Reports/Evaluations hiện có —
// dùng chung cho Student Progress và Lecturer Student Detail, không tạo trạng thái tiến độ thứ hai.
export function buildInternshipTimelineSteps(internship, { hasLogs, hasReports, hasPublishedEvaluation }) {
  const rawSteps = [
    { label: 'Đăng ký thực tập', done: true },
    { label: 'Chọn doanh nghiệp', done: Boolean(internship.company_id) },
    { label: 'Đề xuất đề tài', done: Boolean(internship.topic_id) },
    { label: 'Chờ duyệt', done: internship.status !== 'pending' },
    { label: 'Đã được phân công giảng viên', done: Boolean(internship.lecturer_id) },
    { label: 'Bắt đầu thực tập', done: ['in_progress', 'completed'].includes(internship.status) },
    { label: 'Đang thực tập', done: internship.status === 'completed' || hasLogs },
    { label: 'Nộp báo cáo', done: hasReports },
    { label: 'Đánh giá', done: hasPublishedEvaluation },
    { label: 'Hoàn thành', done: internship.status === 'completed' },
  ]

  const firstPendingIndex = rawSteps.findIndex((step) => !step.done)

  return rawSteps.map((step, index) => ({
    ...step,
    current: index === firstPendingIndex,
  }))
}
