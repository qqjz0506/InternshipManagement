const PDFDocument = require('pdfkit')
const path = require('path')

// Be Vietnam Pro (OFL — Open Font License, SIL) — tải từ Google Fonts, giấy phép đầy đủ ở
// server/assets/fonts/OFL.txt. Nhúng cả Regular + Bold để pdfkit vẽ được tiếng Việt có dấu (font
// mặc định của pdfkit — Helvetica — KHÔNG có glyph tiếng Việt, chữ có dấu sẽ hiện ô vuông/lỗi).
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts')
const FONT_REGULAR = path.join(FONT_DIR, 'BeVietnamPro-Regular.ttf')
const FONT_BOLD = path.join(FONT_DIR, 'BeVietnamPro-Bold.ttf')

const PAGE_WIDTH = 495 // A4 (595) - margin 50*2, dùng để center text thủ công

function createDocument() {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.registerFont('Regular', FONT_REGULAR)
  doc.registerFont('Bold', FONT_BOLD)
  doc.font('Regular')
  return doc
}

function centerText(doc, text, { font = 'Regular', size = 12 } = {}) {
  doc.font(font).fontSize(size).text(text, { align: 'center', width: PAGE_WIDTH })
}

function formatVietnameseDate(dateStr) {
  if (!dateStr) {
    return '......../......../..........'
  }
  const [year, month, day] = dateStr.split('-')
  return `ngày ${day} tháng ${month} năm ${year}`
}

// Dòng chấm trống thay thế khi Admin chưa cấu hình settings.school_name/faculty_name (Mục 16L
// README) — giữ đúng hình thức văn bản hành chính giấy thật (luôn có dòng để điền tay), không để
// trống/hiện "null" gây xấu PDF.
function blankLineIfEmpty(value) {
  return value && value.trim() !== '' ? value : '...........................................'
}

function drawLetterhead(doc, settings) {
  centerText(doc, blankLineIfEmpty(settings?.school_name).toUpperCase(), { font: 'Bold', size: 13 })
  centerText(doc, blankLineIfEmpty(settings?.faculty_name).toUpperCase(), { font: 'Bold', size: 12 })
  doc.moveDown(1.5)
  centerText(doc, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { font: 'Bold', size: 13 })
  centerText(doc, 'Độc lập - Tự do - Hạnh phúc', { font: 'Bold', size: 12 })
  doc.moveDown(0.3)
  centerText(doc, '---------------', { size: 11 })
  doc.moveDown(1)
}

function drawSignatureBlock(doc, { dateLabel, roleLabel }) {
  doc.moveDown(2)
  const x = 300
  doc.font('Regular').fontSize(11).text(dateLabel, x, doc.y, { width: 200, align: 'center' })
  doc.font('Bold').text(roleLabel, x, doc.y + 4, { width: 200, align: 'center' })
  doc.font('Regular').fontSize(10).text('(Ký, ghi rõ họ tên)', x, doc.y + 4, { width: 200, align: 'center' })
}

// Giấy giới thiệu thực tập — chỉ gọi khi internship.status đã 'approved' trở lên VÀ có company_id
// (kiểm tra ở controller/service gọi hàm này, KHÔNG kiểm tra lại ở đây — hàm này chỉ lo vẽ PDF).
function buildIntroductionLetterPdf({ internship, student, department, company, period, settings }) {
  const doc = createDocument()
  drawLetterhead(doc, settings)

  const letterNumber = `${String(internship.id).padStart(4, '0')}/GTTT`
  doc.font('Regular').fontSize(11).text(`Số: ${letterNumber}`, { align: 'left' })
  doc.moveDown(1)

  centerText(doc, 'GIẤY GIỚI THIỆU THỰC TẬP', { font: 'Bold', size: 16 })
  doc.moveDown(1.2)

  doc.font('Bold').fontSize(12).text(`Kính gửi: ${company?.company_name ?? ''}`)
  if (company?.address) {
    doc.font('Regular').fontSize(11).text(`Địa chỉ: ${company.address}`)
  }
  doc.moveDown(1)

  doc.font('Regular').fontSize(12).text(
    `${blankLineIfEmpty(settings?.school_name)} trân trọng giới thiệu sinh viên:`,
    { align: 'justify' },
  )
  doc.moveDown(0.5)
  doc.font('Bold').fontSize(12).text(student.full_name, { indent: 20 })
  doc.font('Regular').fontSize(11).text(`Mã số sinh viên: ${student.student_code}`, { indent: 20 })
  doc.text(`Lớp: ${student.class ?? '—'}    Ngành: ${student.major ?? '—'}`, { indent: 20 })
  doc.text(`Khoa: ${department?.department_name ?? '—'}`, { indent: 20 })
  doc.moveDown(1)

  doc.font('Regular').fontSize(12).text(
    `Đến thực tập tại Quý đơn vị trong khuôn khổ đợt thực tập "${period?.period_name ?? ''}", ` +
      `thời gian từ ${internship.start_date ?? '(chưa xác định)'} đến ${internship.end_date ?? '(chưa xác định)'}.`,
    { align: 'justify' },
  )
  doc.moveDown(0.8)
  doc.text(
    'Kính đề nghị Quý đơn vị tạo điều kiện giúp đỡ để sinh viên hoàn thành tốt nhiệm vụ thực tập. ' +
      'Chúng tôi xin chân thành cảm ơn.',
    { align: 'justify' },
  )

  drawSignatureBlock(doc, { dateLabel: `TP.HCM, ${formatVietnameseDate(internship.start_date)}`, roleLabel: 'TRƯỞNG KHOA' })

  return doc
}

// Phiếu kết quả thực tập — chỉ gọi khi internship.status === 'completed' (tại thời điểm đó, theo
// đúng bất biến Business Rules V2/16F, finalResult LUÔN tồn tại và evaluations LUÔN đã công bố —
// không cần kiểm tra lại is_published ở đây).
function buildResultSheetPdf({ internship, student, department, company, period, lecturerEval, companyEval, finalResult, settings }) {
  const doc = createDocument()
  drawLetterhead(doc, settings)

  centerText(doc, 'PHIẾU KẾT QUẢ THỰC TẬP TỐT NGHIỆP', { font: 'Bold', size: 16 })
  doc.moveDown(1.2)

  doc.font('Regular').fontSize(11)
  doc.text(`Họ tên sinh viên: ${student.full_name}        Mã số sinh viên: ${student.student_code}`)
  doc.text(`Khoa: ${department?.department_name ?? '—'}        Lớp: ${student.class ?? '—'}`)
  doc.text(`Doanh nghiệp thực tập: ${company?.company_name ?? '—'}`)
  doc.text(`Đợt thực tập: ${period?.period_name ?? '—'} (${internship.start_date ?? '—'} → ${internship.end_date ?? '—'})`)
  doc.moveDown(1)

  const columns = [
    { label: 'Tiêu chí', x: 50, width: 180 },
    { label: 'Điểm GVHD', x: 260, width: 110 },
    { label: 'Điểm DN', x: 400, width: 110 },
  ]
  const rows = [
    ['Thái độ', lecturerEval?.attitude_score, companyEval?.attitude_score],
    ['Kỹ năng', lecturerEval?.skill_score, companyEval?.skill_score],
    ['Tiến độ', lecturerEval?.progress_score, companyEval?.progress_score],
    ['Kỷ luật', lecturerEval?.discipline_score, companyEval?.discipline_score],
    ['Điểm tổng (đánh giá)', lecturerEval?.overall_score, companyEval?.overall_score],
  ]

  const tableTop = doc.y + 4
  doc.font('Bold').fontSize(11)
  columns.forEach((col) => doc.text(col.label, col.x, tableTop, { width: col.width }))
  doc.moveDown(0.5)
  doc.font('Regular')
  let rowY = doc.y
  rows.forEach((row) => {
    doc.text(row[0], columns[0].x, rowY, { width: columns[0].width })
    doc.text(row[1] !== undefined && row[1] !== null ? String(row[1]) : '—', columns[1].x, rowY, { width: columns[1].width })
    doc.text(row[2] !== undefined && row[2] !== null ? String(row[2]) : '—', columns[2].x, rowY, { width: columns[2].width })
    rowY = doc.y + 4
  })
  doc.y = rowY + 10

  doc.font('Bold').fontSize(13).text(`Điểm tổng kết thực tập: ${finalResult?.finalScore ?? '—'}`)
  doc.text(`Xếp loại: ${finalResult?.classification ?? '—'}`)
  doc.moveDown(1)

  doc.font('Bold').fontSize(11).text('Nhận xét của Giảng viên hướng dẫn:')
  doc.font('Regular').text(lecturerEval?.comment || '(không có)', { align: 'justify' })
  doc.moveDown(0.6)
  doc.font('Bold').fontSize(11).text('Nhận xét của Doanh nghiệp:')
  doc.font('Regular').text(companyEval?.comment || '(không có)', { align: 'justify' })

  drawSignatureBlock(doc, { dateLabel: `TP.HCM, ${formatVietnameseDate(internship.end_date)}`, roleLabel: 'TRƯỞNG KHOA' })

  return doc
}

module.exports = { buildIntroductionLetterPdf, buildResultSheetPdf }
