const test = require('node:test')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')
const { buildStudentImportBuffer, buildImportFormData } = require('./helpers/excelFixtures')

let server
let tokens

// Ground truth (không đoán): departments.id=1 có department_code='CNTT' (server/db/seed.sql).
// student_code/email dùng tiền tố "99..."/"import." — không trùng bất kỳ dòng seed nào (seed chỉ
// dùng 211100xx / *.edu.vn), an toàn dọn dẹp bằng điều kiện LIKE riêng, không đụng seed.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA'])
})

async function cleanupImportedStudents() {
  const [rows] = await pool.execute("SELECT id, user_id FROM students WHERE student_code LIKE '99%'")
  for (const row of rows) {
    await pool.execute('DELETE FROM students WHERE id = ?', [row.id])
    if (row.user_id) {
      await pool.execute('DELETE FROM users WHERE id = ?', [row.user_id])
    }
  }
}

test.after(async () => {
  await cleanupImportedStudents()
  await server.close()
})

test('GET /imports/templates/students.xlsx — Admin tải được, sai role bị 403', async () => {
  const forbidden = await fetch(`${server.baseUrl}/imports/templates/students.xlsx`, {
    headers: { Authorization: `Bearer ${tokens.lecturerA.token}` },
  })
  assert.equal(forbidden.status, 403)

  const ok = await fetch(`${server.baseUrl}/imports/templates/students.xlsx`, {
    headers: { Authorization: `Bearer ${tokens.admin.token}` },
  })
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('Content-Type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await ok.arrayBuffer())
  assert.ok(workbook.getWorksheet('Dữ liệu'), 'Phải có sheet Dữ liệu')
  assert.ok(workbook.getWorksheet('Hướng dẫn'), 'Phải có sheet Hướng dẫn')
})

test('Preview + Commit file hợp lệ -> ghi đúng số dòng, không tạo tài khoản khi không chọn', async () => {
  const before = await rowCount('students')
  const buffer = await buildStudentImportBuffer([
    ['99110001', 'Nguyễn Văn Test1', 'Nam', '2003-01-15', '0911110001', 'import.sv1@example.com', 'Hà Nội', 'CNTT', 'CNTT', 'DH01', 'active'],
    ['99110002', 'Trần Thị Test2', 'Nữ', new Date(Date.UTC(2003, 5, 20)), '', 'import.sv2@example.com', '', 'KTPM', '', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 200)
  assert.equal(preview.body.data.totalRows, 2)
  assert.equal(preview.body.data.invalidRows.length, 0)
  assert.equal(preview.body.data.validRows.length, 2)
  assert.equal(preview.body.data.validRows[1].date_of_birth, '2003-06-20', 'Ô ngày dạng Date của Excel phải đọc đúng ngày (UTC)')
  assert.equal(preview.body.data.validRows[1].status, 'active', 'Bỏ trống trạng thái phải tự là active')

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer, { create_accounts: 'false' }),
  })
  assert.equal(commit.status, 200)
  assert.equal(commit.body.data.committed, true)
  assert.equal(commit.body.data.insertedCount, 2)
  assert.equal(commit.body.data.accountsFileToken, undefined, 'Không chọn tạo tài khoản thì không có token file')
  assert.equal(await rowCount('students'), before + 2)

  const [[imported]] = await pool.execute('SELECT user_id FROM students WHERE student_code = ?', ['99110001'])
  assert.equal(imported.user_id, null, 'Không chọn tạo tài khoản thì user_id phải NULL')
})

test('Preview báo đúng lỗi: thiếu họ tên, email sai, mã khoa không tồn tại, trùng trong file', async () => {
  const buffer = await buildStudentImportBuffer([
    ['99110010', '', 'Nam', '', '', 'import.sv10@example.com', '', 'CNTT', '', '', ''],
    ['99110011', 'Lê Văn Test11', 'Nam', '', '', 'khong-hop-le', '', 'CNTT', '', '', ''],
    ['99110012', 'Phạm Văn Test12', 'Nam', '', '', 'import.sv12@example.com', '', 'KHOA_LA', '', '', ''],
    ['99110013', 'Vũ Văn Test13', 'Nam', '', '', 'import.dup@example.com', '', 'CNTT', '', '', ''],
    ['99110013', 'Vũ Văn Test13b', 'Nam', '', '', 'import.dup@example.com', '', 'CNTT', '', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 200)
  assert.equal(preview.body.data.totalRows, 5)
  // Dòng 5 là LẦN ĐẦU xuất hiện mã/email đó -> hợp lệ; dòng 6 (lặp lại) mới bị báo trùng trong file.
  assert.equal(preview.body.data.validRows.length, 1)
  assert.equal(preview.body.data.invalidRows.length, 4)

  const byRow = new Map(preview.body.data.invalidRows.map((entry) => [entry.row, entry.errors]))
  assert.ok(byRow.get(2).some((err) => err.column === 'Họ tên'), 'Thiếu họ tên')
  assert.ok(byRow.get(3).some((err) => err.column === 'Email' && err.message === 'Email không hợp lệ.'))
  assert.ok(byRow.get(4).some((err) => err.column === 'Mã khoa' && err.message.includes('không tồn tại')))
  assert.ok(byRow.get(6).some((err) => err.message.includes('trùng trong file')), 'Dòng sau phải báo trùng mã VÀ trùng email trong file')
})

test('Trùng mã sinh viên/email đã có trong DB (seed) -> preview báo lỗi', async () => {
  const buffer = await buildStudentImportBuffer([
    ['21110001', 'Trùng Mã Seed', 'Nam', '', '', 'import.trungma@example.com', '', 'CNTT', '', '', ''],
    ['99110020', 'Trùng Email Seed', 'Nam', '', '', 'minhanh.nguyen@student.edu.vn', '', 'CNTT', '', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 200)
  const byRow = new Map(preview.body.data.invalidRows.map((entry) => [entry.row, entry.errors]))
  assert.ok(byRow.get(2).some((err) => err.message.includes('đã tồn tại trong hệ thống')), 'Mã SV 21110001 đã có trong seed')
  assert.ok(byRow.get(3).some((err) => err.message.includes('đã tồn tại trong hệ thống')), 'Email seed đã có')
})

test('Commit rollback toàn bộ khi file còn dòng lỗi — không ghi dòng hợp lệ đi kèm', async () => {
  const before = await rowCount('students')
  const buffer = await buildStudentImportBuffer([
    ['99110030', 'Dòng Hợp Lệ', 'Nam', '', '', 'import.sv30@example.com', '', 'CNTT', '', '', ''],
    ['99110031', '', 'Nam', '', '', 'import.sv31@example.com', '', 'CNTT', '', '', ''], // thiếu họ tên
  ])

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(commit.status, 200)
  assert.equal(commit.body.data.committed, false)
  assert.equal(commit.body.data.invalidRows.length, 1)
  assert.equal(await rowCount('students'), before, 'Dòng hợp lệ đi kèm KHÔNG được ghi khi file còn lỗi')
})

test('Vượt 1000 dòng -> 400, không ghi gì', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => [
    `99${String(index).padStart(6, '0')}`,
    `Sinh Viên ${index}`,
    'Nam',
    '',
    '',
    `import.bulk${index}@example.com`,
    '',
    'CNTT',
    '',
    '',
    '',
  ])
  const buffer = await buildStudentImportBuffer(rows)

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 400)
  assert.match(preview.body.message, /1000 dòng/)
})

test('Không phải Admin -> 403 trên preview/commit', async () => {
  const buffer = await buildStudentImportBuffer([
    ['99110040', 'Không Có Quyền', 'Nam', '', '', 'import.sv40@example.com', '', 'CNTT', '', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/preview', {
    token: tokens.studentA.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 403)

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/commit', {
    token: tokens.lecturerA.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(commit.status, 403)
})

test('Commit với "Tạo luôn tài khoản" -> must_change_password=1, tải file tài khoản đúng 1 lần, đăng nhập được bằng mật khẩu tạm', async () => {
  const before = await rowCount('users')
  const buffer = await buildStudentImportBuffer([
    ['99110050', 'Có Tài Khoản', 'Nữ', '', '', 'import.account50@example.com', '', 'CNTT', '', '', ''],
  ])

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/students/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer, { create_accounts: 'true' }),
  })
  assert.equal(commit.status, 200)
  assert.equal(commit.body.data.committed, true)
  assert.ok(commit.body.data.accountsFileToken, 'Phải có token file tài khoản')
  assert.equal(await rowCount('users'), before + 1)

  const [[student]] = await pool.execute('SELECT user_id FROM students WHERE student_code = ?', ['99110050'])
  assert.ok(student.user_id, 'Phải được link user_id')
  const [[user]] = await pool.execute('SELECT must_change_password, role FROM users WHERE id = ?', [student.user_id])
  assert.equal(user.must_change_password, 1)
  assert.equal(user.role, 'student')

  const token = commit.body.data.accountsFileToken
  const download = await fetch(`${server.baseUrl}/imports/accounts-file/${token}`, {
    headers: { Authorization: `Bearer ${tokens.admin.token}` },
  })
  assert.equal(download.status, 200)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await download.arrayBuffer())
  const sheet = workbook.getWorksheet('Tài khoản')
  const emailCell = sheet.getRow(2).getCell(1).value
  const passwordCell = sheet.getRow(2).getCell(2).value
  assert.equal(emailCell, 'import.account50@example.com')
  assert.ok(passwordCell && String(passwordCell).length >= 8)

  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'import.account50@example.com', password: String(passwordCell) },
  })
  assert.equal(login.status, 200)
  assert.equal(login.body.data.user.mustChangePassword, true)

  const second = await fetch(`${server.baseUrl}/imports/accounts-file/${token}`, {
    headers: { Authorization: `Bearer ${tokens.admin.token}` },
  })
  assert.equal(second.status, 404, 'Token chỉ dùng được đúng 1 lần')
})
