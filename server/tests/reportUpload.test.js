const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')
const { buildReportFormData } = require('./helpers/fileFixtures')
const { UPLOAD_DIR } = require('../config/upload')

let server
let tokens

// Ground truth (không đoán):
//   internships.id=1 -> student_id=1 (Student A), status='in_progress' -> đủ điều kiện nộp báo cáo.
//   reports.id=1 (internship_id=1) -> stored_file_name=NULL (seed cũ, trước khi có upload thật) —
//     dùng để test "report có nhưng chưa có file đính kèm" (404 riêng, khác 403 scope).

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentB'])
})

test.after(async () => {
  await server.close()
})

function countUploadedFiles() {
  return fs.readdirSync(UPLOAD_DIR).length
}

test('Upload hợp lệ (.pdf) -> 201, lưu đúng stored_file_name/file_size/mime_type, tải xuống thành công', async () => {
  const before = await rowCount('reports')
  const filesBefore = countUploadedFiles()

  const create = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'bao-cao-tuan-upload-test.pdf', content: '%PDF-1.4 noi dung test co dau', mimeType: 'application/pdf' },
    ),
  })
  assert.equal(create.status, 201)
  assert.equal(await rowCount('reports'), before + 1)
  assert.equal(create.body.data.file_name, 'bao-cao-tuan-upload-test.pdf')
  assert.ok(create.body.data.stored_file_name, 'Phải có stored_file_name (tên ngẫu nhiên trên đĩa)')
  assert.notEqual(create.body.data.stored_file_name, 'bao-cao-tuan-upload-test.pdf', 'Tên trên đĩa KHÔNG được là tên gốc')
  assert.equal(create.body.data.mime_type, 'application/pdf')
  assert.ok(create.body.data.file_size > 0)
  assert.equal(countUploadedFiles(), filesBefore + 1, 'Phải có đúng 1 file mới trên đĩa')

  const reportId = create.body.data.id
  try {
    // apiRequest luôn gọi res.json() — download trả file nhị phân thật (không phải JSON), nên phải
    // dùng fetch trực tiếp ở đây, không dùng helper chung (sẽ throw SyntaxError khi parse JSON).
    const download = await fetch(`${server.baseUrl}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${tokens.studentA.token}` },
    })
    assert.equal(download.status, 200)
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
    assert.equal(cleanup.status, 200)
    assert.equal(await rowCount('reports'), before, 'Phải khôi phục đúng số lượng reports')
    assert.equal(countUploadedFiles(), filesBefore, 'Xóa report phải xóa luôn file vật lý, không để lại mồ côi')
  }
})

test('Tải xuống thật qua fetch trực tiếp -> 200, đúng Content-Disposition tên gốc, đúng nội dung', async () => {
  const create = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'bao-cao-tai-xuong.pdf', content: '%PDF-1.4 kiem tra noi dung tai ve', mimeType: 'application/pdf' },
    ),
  })
  assert.equal(create.status, 201)
  const reportId = create.body.data.id

  try {
    const res = await fetch(`${server.baseUrl}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${tokens.studentA.token}` },
    })
    assert.equal(res.status, 200)
    const disposition = res.headers.get('content-disposition') || ''
    assert.ok(disposition.includes('bao-cao-tai-xuong.pdf'), `Content-Disposition phải chứa tên gốc, nhận: ${disposition}`)
    const text = await res.text()
    assert.equal(text, '%PDF-1.4 kiem tra noi dung tai ve', 'Nội dung tải về phải khớp đúng file đã upload')
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
  }
})

test('Upload tên file tiếng Việt có dấu -> KHÔNG bị mojibake (file_name lưu đúng, Content-Disposition tải về đúng tên)', async () => {
  // Phát hiện ở đợt kiểm tra trước bảo vệ: busboy (dùng trong multer) mặc định decode filename
  // multipart bằng latin1 -> tên tiếng Việt có dấu bị lưu sai (mojibake). Fix: defParamCharset:'utf8'
  // ở server/config/upload.js.
  const vietnameseFilename = 'Báo cáo thực tập tuần 1.pdf'
  const create = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: vietnameseFilename, content: '%PDF-1.4 noi dung test ten tieng Viet', mimeType: 'application/pdf' },
    ),
  })
  assert.equal(create.status, 201, `Upload thất bại: ${JSON.stringify(create.body)}`)
  const reportId = create.body.data.id
  assert.equal(create.body.data.file_name, vietnameseFilename, 'file_name lưu trong DB phải đúng tiếng Việt, không mojibake')

  try {
    const [[row]] = await pool.query('SELECT file_name FROM reports WHERE id = ?', [reportId])
    assert.equal(row.file_name, vietnameseFilename, 'Đọc trực tiếp từ DB cũng phải đúng (không chỉ đúng ở response)')

    const res = await fetch(`${server.baseUrl}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${tokens.studentA.token}` },
    })
    assert.equal(res.status, 200)
    const disposition = res.headers.get('content-disposition') || ''
    // content-disposition package mã hóa tên không-ASCII dạng filename*=UTF-8''<percent-encoded> —
    // decode lại và so sánh, không so sánh chuỗi thô (phần filename="..." ASCII-fallback có thể chứa "?").
    const match = disposition.match(/filename\*=UTF-8''([^;]+)/)
    assert.ok(match, `Content-Disposition phải có phần filename*=UTF-8'' cho tên có dấu, nhận: ${disposition}`)
    assert.equal(decodeURIComponent(match[1]), vietnameseFilename)
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
  }
})

test('Sai định dạng (.txt khai mimetype text/plain) -> 400, không tạo report, không để lại file', async () => {
  const before = await rowCount('reports')
  const filesBefore = countUploadedFiles()

  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'khong-hop-le.txt', content: 'noi dung van ban thuong', mimeType: 'text/plain' },
    ),
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('reports'), before)
  assert.equal(countUploadedFiles(), filesBefore, 'fileFilter phải reject TRƯỚC khi ghi file xuống đĩa')
})

test('File .pdf giả mạo bằng cách khai mimetype sai (application/x-msdownload) -> 400', async () => {
  // Đuôi file .pdf nhưng mimetype khai báo không khớp — phải reject vì kiểm tra CẢ 2 (rule #2).
  const before = await rowCount('reports')
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'gia-mao.pdf', content: 'MZ fake binary', mimeType: 'application/x-msdownload' },
    ),
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('reports'), before)
})

test('Quá dung lượng (>10MB) -> 400, không tạo report', async () => {
  const before = await rowCount('reports')
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1024, 'a') // 10MB + 1KB, vượt MAX_FILE_SIZE
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData(
      { internship_id: 1, report_type: 'weekly' },
      { filename: 'qua-lon.pdf', content: oversized, mimeType: 'application/pdf' },
    ),
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('reports'), before)
})

test('Download: người ngoài scope (Student khác) bị 403, không lộ nội dung', async () => {
  const create = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData({ internship_id: 1, report_type: 'weekly' }, { filename: 'rieng-tu.pdf' }),
  })
  assert.equal(create.status, 201)
  const reportId = create.body.data.id

  try {
    const forbidden = await apiRequest(server.baseUrl, 'GET', `/reports/${reportId}/download`, {
      token: tokens.studentB.token,
    })
    assert.equal(forbidden.status, 403)
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
  }
})

test('Download: report seed cũ chưa có file đính kèm -> 404 (khác 403 scope)', async () => {
  // reports.id=1 (internship_id=1, thuộc Student A) -> stored_file_name=NULL (seed trước khi có
  // upload thật) — chủ sở hữu vẫn KHÔNG tải được vì chưa từng có file thật nào, không phải vì sai scope.
  const res = await apiRequest(server.baseUrl, 'GET', '/reports/1/download', { token: tokens.studentA.token })
  assert.equal(res.status, 404)
})

test('Download: không yêu cầu token -> 401 (không serve static, luôn qua requireAuth)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/reports/1/download', {})
  assert.equal(res.status, 401)
})
