// Test GET /api/statistics/summary — API tính thống kê bằng SQL GROUP BY (theo khoa, đợt, doanh
// nghiệp, trạng thái), thay cho cách tính cũ ở client (AdminStatisticsPage.jsx tải toàn bộ
// Context rồi tự reduce). Chỉ Admin được gọi. Verify bằng ground-truth baseline (giống
// tests/dbIntegrity.test.js) + 1 câu COUNT(*) trực tiếp để xác nhận filter hoạt động đúng.
require('dotenv').config()

const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool } = require('../config/database')

let server
let tokens

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA'])
})

test.after(async () => {
  await server.close()
})

test('Statistics summary: Admin gọi không filter -> KPI khớp đúng baseline (12 internships/14 students/4 reports/6 evaluations)', async () => {
  const res = await apiRequest(server.baseUrl, 'GET', '/statistics/summary', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  const { kpi, byStatus, byDepartment, byPeriod, byCompany, reports, evaluations } = res.body.data

  assert.equal(kpi.totalInternships, 12)
  assert.equal(kpi.totalStudents, 14)
  assert.equal(kpi.totalReports, 4)
  assert.equal(kpi.totalEvaluations, 6)

  const statusSum = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
  assert.equal(statusSum, kpi.totalInternships, 'Tổng theo trạng thái phải khớp đúng tổng hồ sơ')

  const deptStudentSum = byDepartment.reduce((sum, row) => sum + row.total_students, 0)
  assert.equal(deptStudentSum, kpi.totalStudents, 'Tổng sinh viên theo khoa phải khớp đúng tổng sinh viên')

  const periodTotalSum = byPeriod.reduce((sum, row) => sum + row.total, 0)
  assert.equal(periodTotalSum, kpi.totalInternships, 'Tổng theo đợt phải khớp đúng tổng hồ sơ')

  const companyStudentSum = byCompany.reduce((sum, row) => sum + row.student_count, 0)
  const [[{ assignedCount }]] = await pool.query(
    'SELECT COUNT(*) AS assignedCount FROM internships WHERE company_id IS NOT NULL',
  )
  assert.equal(companyStudentSum, assignedCount, 'Tổng theo doanh nghiệp chỉ tính hồ sơ ĐÃ gán doanh nghiệp')

  assert.equal(reports.total, 4)
  assert.equal(evaluations.total, 6)
})

test('Statistics summary: filter theo period_id khớp đúng COUNT(*) trực tiếp (không tin số liệu cứng)', async () => {
  const [[{ expected }]] = await pool.query('SELECT COUNT(*) AS expected FROM internships WHERE period_id = 1')

  const res = await apiRequest(server.baseUrl, 'GET', '/statistics/summary?period_id=1', { token: tokens.admin.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.kpi.totalInternships, expected)

  const matchingPeriodRow = res.body.data.byPeriod.find((row) => row.id === 1)
  assert.equal(matchingPeriodRow.total, expected)
  // Đợt KHÔNG khớp filter vẫn phải xuất hiện trong danh sách, với total = 0 (không bị rớt khỏi mảng).
  const otherPeriodRow = res.body.data.byPeriod.find((row) => row.id !== 1)
  assert.ok(otherPeriodRow, 'Đợt khác vẫn phải có mặt trong byPeriod')
  assert.equal(otherPeriodRow.total, 0)
})

test('Statistics summary: filter theo department_id — total_students theo khoa KHÔNG đổi, chỉ registered/in_progress/completed đổi', async () => {
  const unfiltered = await apiRequest(server.baseUrl, 'GET', '/statistics/summary', { token: tokens.admin.token })
  const filtered = await apiRequest(server.baseUrl, 'GET', '/statistics/summary?department_id=1', {
    token: tokens.admin.token,
  })
  assert.equal(filtered.status, 200)

  const deptRowUnfiltered = unfiltered.body.data.byDepartment.find((row) => row.id === 1)
  const deptRowFiltered = filtered.body.data.byDepartment.find((row) => row.id === 1)
  assert.equal(deptRowFiltered.total_students, deptRowUnfiltered.total_students)

  const otherDeptFiltered = filtered.body.data.byDepartment.find((row) => row.id !== 1)
  assert.equal(otherDeptFiltered.registered, 0, 'Khoa khác (không khớp filter) phải có registered = 0')
})

test('Statistics summary: Student/Lecturer không có quyền gọi (403)', async () => {
  const asStudent = await apiRequest(server.baseUrl, 'GET', '/statistics/summary', { token: tokens.studentA.token })
  assert.equal(asStudent.status, 403)
  const asLecturer = await apiRequest(server.baseUrl, 'GET', '/statistics/summary', { token: tokens.lecturerA.token })
  assert.equal(asLecturer.status, 403)
})
