const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// Không truyền `page` trong query -> trả null -> caller GIỮ NGUYÊN hành vi cũ (trả toàn bộ, không
// phân trang) — yêu cầu rõ: không phá bất kỳ nơi nào đang gọi API theo hành vi cũ (frontend hiện tại
// chưa gửi page/pageSize). `page` có mặt (bất kể giá trị) mới coi là "có yêu cầu phân trang".
function parsePagination({ page, pageSize } = {}) {
  if (page === undefined || page === null || page === '') {
    return null
  }
  const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1)
  const parsedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE))
  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    offset: (parsedPage - 1) * parsedPageSize,
  }
}

module.exports = { parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE }
