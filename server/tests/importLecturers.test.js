const test = require('node:test')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')
const { buildLecturerImportBuffer, buildImportFormData } = require('./helpers/excelFixtures')

let server
let tokens

// Ground truth: departments.id=1 có department_code='CNTT'. lecturer_code/email dùng tiền tố
// "GVIMPORT"/"import." — không trùng seed (seed chỉ dùng GV00x / *.edu.vn thuần, không có "import.").

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA'])
})

async function cleanupImportedLecturers() {
  const [rows] = await pool.execute("SELECT id, user_id FROM lecturers WHERE lecturer_code LIKE 'GVIMPORT%'")
  for (const row of rows) {
    await pool.execute('DELETE FROM lecturers WHERE id = ?', [row.id])
    if (row.user_id) {
      await pool.execute('DELETE FROM users WHERE id = ?', [row.user_id])
    }
  }
}

test.after(async () => {
  await cleanupImportedLecturers()
  await server.close()
})

test('GET /imports/templates/lecturers.xlsx — Admin tải được, sai role bị 403', async () => {
  const forbidden = await fetch(`${server.baseUrl}/imports/templates/lecturers.xlsx`, {
    headers: { Authorization: `Bearer ${tokens.studentA.token}` },
  })
  assert.equal(forbidden.status, 403)

  const ok = await fetch(`${server.baseUrl}/imports/templates/lecturers.xlsx`, {
    headers: { Authorization: `Bearer ${tokens.admin.token}` },
  })
  assert.equal(ok.status, 200)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await ok.arrayBuffer())
  assert.ok(workbook.getWorksheet('Dữ liệu'))
  assert.ok(workbook.getWorksheet('Hướng dẫn'))
})

test('Preview + Commit file hợp lệ -> ghi đúng số dòng', async () => {
  const before = await rowCount('lecturers')
  const buffer = await buildLecturerImportBuffer([
    ['GVIMPORT01', 'Giảng Viên Test1', 'import.gv1@example.com', '0911220001', 'CNTT', 'Thạc sĩ', 'active'],
    ['GVIMPORT02', 'Giảng Viên Test2', 'import.gv2@example.com', '', 'KTPM', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 200)
  assert.equal(preview.body.data.invalidRows.length, 0)
  assert.equal(preview.body.data.validRows.length, 2)
  assert.equal(preview.body.data.validRows[1].status, 'active')

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer, { create_accounts: 'false' }),
  })
  assert.equal(commit.status, 200)
  assert.equal(commit.body.data.committed, true)
  assert.equal(commit.body.data.insertedCount, 2)
  assert.equal(await rowCount('lecturers'), before + 2)
})

test('Preview báo đúng lỗi: thiếu họ tên, email sai, mã khoa không tồn tại, trùng trong file, trùng DB', async () => {
  const buffer = await buildLecturerImportBuffer([
    ['GVIMPORT10', '', 'import.gv10@example.com', '', 'CNTT', '', ''],
    ['GVIMPORT11', 'Lỗi Email', 'khong-hop-le', '', 'CNTT', '', ''],
    ['GVIMPORT12', 'Khoa Không Tồn Tại', 'import.gv12@example.com', '', 'KHOA_LA', '', ''],
    ['GVIMPORT13', 'Trùng File', 'import.dupgv@example.com', '', 'CNTT', '', ''],
    ['GVIMPORT13', 'Trùng File 2', 'import.dupgv@example.com', '', 'CNTT', '', ''],
    ['GV001', 'Trùng Mã Seed', 'import.gv14@example.com', '', 'CNTT', '', ''],
    ['GVIMPORT15', 'Trùng Email Seed', 'lecturer@example.com', '', 'CNTT', '', ''],
  ])

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 200)
  // Dòng 5 (GVIMPORT13 lần đầu) hợp lệ; dòng 6 (lặp lại), 7 (mã trùng seed), 8 (email trùng seed) đều lỗi.
  assert.equal(preview.body.data.validRows.length, 1)
  assert.equal(preview.body.data.invalidRows.length, 6)

  const byRow = new Map(preview.body.data.invalidRows.map((entry) => [entry.row, entry.errors]))
  assert.ok(byRow.get(2).some((err) => err.column === 'Họ tên'))
  assert.ok(byRow.get(3).some((err) => err.column === 'Email' && err.message === 'Email không hợp lệ.'))
  assert.ok(byRow.get(4).some((err) => err.column === 'Mã khoa' && err.message.includes('không tồn tại')))
  assert.ok(byRow.get(6).some((err) => err.message.includes('trùng trong file')))
  assert.ok(byRow.get(7).some((err) => err.message.includes('đã tồn tại trong hệ thống')), 'GV001 đã có trong seed')
  assert.ok(byRow.get(8).some((err) => err.message.includes('đã tồn tại trong hệ thống')), 'Email seed đã có')
})

test('Commit rollback toàn bộ khi file còn dòng lỗi', async () => {
  const before = await rowCount('lecturers')
  const buffer = await buildLecturerImportBuffer([
    ['GVIMPORT20', 'Dòng Hợp Lệ', 'import.gv20@example.com', '', 'CNTT', '', ''],
    ['GVIMPORT21', '', 'import.gv21@example.com', '', 'CNTT', '', ''],
  ])

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(commit.body.data.committed, false)
  assert.equal(await rowCount('lecturers'), before)
})

test('Vượt 1000 dòng -> 400', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => [
    `GVIMPORTX${index}`,
    `Giảng Viên ${index}`,
    `import.bulkgv${index}@example.com`,
    '',
    'CNTT',
    '',
    '',
  ])
  const buffer = await buildLecturerImportBuffer(rows)

  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/preview', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 400)
  assert.match(preview.body.message, /1000 dòng/)
})

test('Không phải Admin -> 403', async () => {
  const buffer = await buildLecturerImportBuffer([
    ['GVIMPORT30', 'Không Có Quyền', 'import.gv30@example.com', '', 'CNTT', '', ''],
  ])
  const preview = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/preview', {
    token: tokens.studentA.token,
    formData: buildImportFormData(buffer),
  })
  assert.equal(preview.status, 403)
})

test('Commit với "Tạo luôn tài khoản" -> must_change_password=1, đăng nhập được bằng mật khẩu tạm', async () => {
  const buffer = await buildLecturerImportBuffer([
    ['GVIMPORT40', 'Có Tài Khoản', 'import.account40@example.com', '', 'CNTT', '', ''],
  ])

  const commit = await apiRequestMultipart(server.baseUrl, 'POST', '/imports/lecturers/commit', {
    token: tokens.admin.token,
    formData: buildImportFormData(buffer, { create_accounts: 'true' }),
  })
  assert.equal(commit.body.data.committed, true)
  assert.ok(commit.body.data.accountsFileToken)

  const [[lecturer]] = await pool.execute('SELECT user_id FROM lecturers WHERE lecturer_code = ?', ['GVIMPORT40'])
  const [[user]] = await pool.execute('SELECT must_change_password, role FROM users WHERE id = ?', [lecturer.user_id])
  assert.equal(user.must_change_password, 1)
  assert.equal(user.role, 'lecturer')

  const download = await fetch(`${server.baseUrl}/imports/accounts-file/${commit.body.data.accountsFileToken}`, {
    headers: { Authorization: `Bearer ${tokens.admin.token}` },
  })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await download.arrayBuffer())
  const sheet = workbook.getWorksheet('Tài khoản')
  const password = sheet.getRow(2).getCell(2).value

  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'import.account40@example.com', password: String(password) },
  })
  assert.equal(login.status, 200)
  assert.equal(login.body.data.user.mustChangePassword, true)
})
