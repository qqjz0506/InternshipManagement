// meta: field phẳng bổ sung vào response (dùng cho phân trang — { total, page, pageSize }), chỉ xuất
// hiện khi caller thực sự truyền (undefined -> không đổi shape response cũ, không phá frontend nào
// đang đọc { success, message, data }).
function sendSuccess(res, { statusCode = 200, message, data, meta }) {
  res.status(statusCode).json({ success: true, message, data, ...(meta ?? {}) })
}

module.exports = { sendSuccess }
