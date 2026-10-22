const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { pool, rowCount } = require('./helpers/db')
const { buildReportFormData } = require('./helpers/fileFixtures')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp trước khi viết test (không đoán):
//   internship_periods: id=1 status='closed', id=2 status='ongoing' (2025-02-01..2025-06-15),
//                        id=3 status='upcoming' (2025-09-01..2026-01-15).
//   students.id=12 (user_id=8, login student4@example.com="studentD") -> KHÔNG có internship nào.
//   students.id=14 (Mai Thu Hằng) -> KHÔNG có internship nào, KHÔNG có login (chỉ dùng cho Admin tạo hộ).
//   students.id=1 (studentA) -> internships.id=1, status='in_progress', period_id=2,
//     start_date='2025-02-01', end_date='2025-06-15', company_id=1, company_mentor_id=1, lecturer_id=1.
//   internships.id=3 -> status='pending', period_id=2, chưa có company/mentor/lecturer/topic.
//   topics.id=10 status='rejected'; topics.id=4 status='approved' (suggested_by_student_id=NULL);
//     topics.id=6 status='proposed', suggested_by_student_id=7 (KHÔNG phải student 12).
//   companies.id=6 status='inactive'; lecturers.id=6 status='inactive'.
//   company_mentors.id=1 (company_id=1, active); company_mentors.id=3 (company_id=2, active, không có login).
//   settings.allow_student_registration=1 (mặc định bật).

function toSettingsPayload(row) {
  return {
    systemName: row.system_name,
    systemDescription: row.system_description,
    defaultInternshipPeriodId: row.default_internship_period_id,
    allowStudentRegistration: Boolean(row.allow_student_registration),
    // Rule mới (điểm tổng kết): lecturerWeight/companyWeight bắt buộc, tổng phải = 100 — phải gửi
    // kèm dù test này không liên quan trực tiếp, nếu không settingsService.update() reject 400.
    lecturerWeight: row.lecturer_weight,
    companyWeight: row.company_weight,
  }
}

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentD'])
})

test.after(async () => {
  await server.close()
})

// ---- Rule 1: khóa đăng ký (allow_student_registration / đợt closed / sinh viên inactive) ----

test('Rule 1: allow_student_registration=0 chặn Student tạo hồ sơ (403), Admin vẫn tạo được', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/settings', { token: tokens.admin.token })
  const original = before.body.data

  try {
    const toggleOff = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: { ...toSettingsPayload(original), allowStudentRegistration: false },
    })
    assert.equal(toggleOff.status, 200)

    const studentAttempt = await apiRequest(server.baseUrl, 'POST', '/internships', {
      token: tokens.studentD.token,
      body: { period_id: 3 },
    })
    assert.equal(studentAttempt.status, 403)

    const adminAttempt = await apiRequest(server.baseUrl, 'POST', '/internships', {
      token: tokens.admin.token,
      body: { student_id: 12, period_id: 3 },
    })
    assert.equal(adminAttempt.status, 201, 'Admin vẫn phải tạo được hồ sơ khi đăng ký bị khóa')

    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/internships/${adminAttempt.body.data.id}`, {
      token: tokens.admin.token,
    })
    assert.equal(cleanup.status, 200)
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/settings', {
      token: tokens.admin.token,
      body: toSettingsPayload(original),
    })
    assert.equal(restore.status, 200)
    assert.equal(
      Boolean(restore.body.data.allow_student_registration),
      Boolean(original.allow_student_registration),
      'Phải khôi phục đúng allow_student_registration gốc',
    )
  }
})

test('Rule 1: đợt thực tập đã "closed" chặn đăng ký mới, áp dụng cả Admin (409)', async () => {
  const before = await rowCount('internships')
  const res = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 1 },
  })
  assert.equal(res.status, 409)
  assert.equal(await rowCount('internships'), before)
})

test('Rule 1: hồ sơ sinh viên status="inactive" chặn Student tự đăng ký (403)', async () => {
  await pool.execute('UPDATE students SET status = ? WHERE id = 1', ['inactive'])
  try {
    const res = await apiRequest(server.baseUrl, 'POST', '/internships', {
      token: tokens.studentA.token,
      body: { period_id: 3 },
    })
    assert.equal(res.status, 403)
  } finally {
    await pool.execute('UPDATE students SET status = ? WHERE id = 1', ['active'])
    const [[row]] = await pool.query('SELECT status FROM students WHERE id = 1')
    assert.equal(row.status, 'active', 'Phải khôi phục students.id=1 về status=active')
  }
})

// ---- Rule 2: gán đề tài — Student chỉ 'approved' hoặc 'proposed' của chính mình, Admin không 'rejected' ----

test('Rule 2: Admin không gán được đề tài "rejected" (400), không ghi DB', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { topic_id: 10 },
  })
  assert.equal(res.status, 400)
  const check = await apiRequest(server.baseUrl, 'GET', '/internships/3', { token: tokens.admin.token })
  assert.equal(check.body.data.topic_id, null)
})

test('Rule 2: Student chỉ chọn được đề tài "approved" hoặc "proposed" do chính mình đề xuất', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 3 },
  })
  assert.equal(create.status, 201)
  const internshipId = create.body.data.id

  try {
    const rejected = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.studentD.token,
      body: { topic_id: 10 },
    })
    assert.equal(rejected.status, 400, 'Không được chọn đề tài rejected')

    const approvedOthers = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.studentD.token,
      body: { topic_id: 4 },
    })
    assert.equal(approvedOthers.status, 200, 'Đề tài approved thì ai cũng chọn được, không cần là của mình')

    const proposedOthers = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.studentD.token,
      body: { topic_id: 6 },
    })
    assert.equal(proposedOthers.status, 400, 'Không được chọn đề tài proposed của sinh viên khác')
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/internships/${internshipId}`, {
      token: tokens.admin.token,
    })
    assert.equal(cleanup.status, 200)
  }
})

// ---- Rule 3: company/lecturer/company_mentor phải đang 'active' khi gán ----

test('Rule 3: gán company/lecturer/mentor không "active" -> 400, không ghi DB', async () => {
  const inactiveCompany = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { company_id: 6 },
  })
  assert.equal(inactiveCompany.status, 400, 'companies.id=6 đang inactive')

  const inactiveLecturer = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { lecturer_id: 6 },
  })
  assert.equal(inactiveLecturer.status, 400, 'lecturers.id=6 đang inactive')

  await pool.execute('UPDATE company_mentors SET status = ? WHERE id = 3', ['inactive'])
  try {
    const inactiveMentor = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { company_id: 2, company_mentor_id: 3 },
    })
    assert.equal(inactiveMentor.status, 400, 'company_mentors.id=3 vừa bị set inactive')
  } finally {
    await pool.execute('UPDATE company_mentors SET status = ? WHERE id = 3', ['active'])
  }

  const check = await apiRequest(server.baseUrl, 'GET', '/internships/3', { token: tokens.admin.token })
  assert.equal(check.body.data.company_id, null, 'internships.id=3 phải vẫn chưa có company sau các request bị reject')
})

// ---- Rule 4a: approved -> in_progress bắt buộc đủ lecturer/company/mentor ----

test('Rule 4a: approved -> in_progress khi chưa đủ phân công -> 409', async () => {
  try {
    const toApproved = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'approved' },
    })
    assert.equal(toApproved.status, 200)

    const toInProgress = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'in_progress' },
    })
    assert.equal(toInProgress.status, 409, 'Chưa có lecturer/company/mentor -> không chuyển in_progress được')
  } finally {
    // approved không có đường quay lại pending trực tiếp (ALLOWED_TRANSITIONS.approved = [in_progress, cancelled])
    // -> khôi phục qua 2 bước: approved -> cancelled -> pending.
    const toCancelled = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'cancelled' },
    })
    assert.equal(toCancelled.status, 200)
    const toPending = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'pending' },
    })
    assert.equal(toPending.status, 200)
    assert.equal(toPending.body.data.status, 'pending', 'Phải khôi phục internships.id=3 về pending')
  }
})

// ---- Rule 4b: in_progress -> completed bắt buộc có báo cáo final+approved VÀ đủ 2 evaluator_role ĐÃ CÔNG BỐ ----

test('Rule 4b: in_progress -> completed khi thiếu báo cáo/đánh giá -> 409 (internships.id=1)', async () => {
  // internships.id=1: chỉ có report weekly (không phải final) + 1 evaluation lecturer (thiếu company,
  // và evaluation đó cũng chưa công bố — cả 2 lý do đều đủ để chặn).
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.admin.token,
    body: { status: 'completed' },
  })
  assert.equal(res.status, 409)
})

test('Rule 4b: hoàn thành đủ báo cáo final+approved và 2 đánh giá ĐÃ CÔNG BỐ -> completed thành công (200)', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 2 },
  })
  assert.equal(create.status, 201)
  const internshipId = create.body.data.id
  let reportId = null
  const evaluationIds = []

  try {
    const assign = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { company_id: 1, lecturer_id: 2, company_mentor_id: 1 },
    })
    assert.equal(assign.status, 200)

    const toApproved = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { status: 'approved' },
    })
    assert.equal(toApproved.status, 200)

    const toInProgress = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { status: 'in_progress' },
    })
    assert.equal(toInProgress.status, 200, 'Đã đủ lecturer/company/mentor -> phải chuyển in_progress được')

    const blockedCompleted = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { status: 'completed' },
    })
    assert.equal(blockedCompleted.status, 409, 'Chưa có báo cáo/đánh giá -> chưa completed được')

    const report = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
      token: tokens.studentD.token,
      formData: buildReportFormData(
        { internship_id: internshipId, report_type: 'final' },
        { filename: 'bao-cao-tong-ket-test.pdf' },
      ),
    })
    assert.equal(report.status, 201)
    reportId = report.body.data.id

    const approveReport = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportId}`, {
      token: tokens.admin.token,
      body: { status: 'approved' },
    })
    assert.equal(approveReport.status, 200)

    for (const evaluatorRole of ['lecturer', 'company']) {
      const evaluation = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
        token: tokens.admin.token,
        body: {
          internship_id: internshipId,
          evaluator_role: evaluatorRole,
          attitude_score: 8,
          skill_score: 8,
          progress_score: 8,
          discipline_score: 8,
        },
      })
      assert.equal(evaluation.status, 201)
      evaluationIds.push(evaluation.body.data.id)
    }

    // Rule siết chặt (đợt kiểm tra trước bảo vệ): có đủ 2 evaluator_role nhưng CHƯA công bố -> vẫn
    // phải 409 — "tồn tại" không còn đủ, phải "đã công bố" (để hồ sơ completed luôn có điểm tổng kết
    // tính được ngay, xem README Mục 16C).
    const blockedUnpublished = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { status: 'completed' },
    })
    assert.equal(blockedUnpublished.status, 409, 'Có đủ 2 đánh giá nhưng CHƯA công bố -> chưa completed được')

    for (const evaluationId of evaluationIds) {
      const publish = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
        token: tokens.admin.token,
        body: { is_published: true },
      })
      assert.equal(publish.status, 200)
    }

    const completed = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { status: 'completed' },
    })
    assert.equal(completed.status, 200, 'Đã đủ báo cáo final+approved và 2 đánh giá ĐÃ CÔNG BỐ -> phải completed được')
    assert.equal(completed.body.data.status, 'completed')
  } finally {
    for (const evaluationId of evaluationIds) {
      await apiRequest(server.baseUrl, 'DELETE', `/evaluations/${evaluationId}`, { token: tokens.admin.token })
    }
    if (reportId) {
      await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
    }
    // internship đã 'completed' (trạng thái cuối, không có API chuyển lùi) -> remove() qua API chỉ
    // cho phép khi 'pending' -> dọn fixture test bằng SQL trực tiếp (đây là dữ liệu test mới tạo
    // trong chính test này, không phải seed data thật).
    await pool.execute('DELETE FROM internships WHERE id = ?', [internshipId])
  }
})

// ---- Rule 5a: start_date/end_date của internship phải nằm trong khoảng của đợt ----

test('Rule 5a: start_date/end_date ngoài khoảng của đợt -> 400, không ghi DB', async () => {
  const before = await rowCount('internships')

  const beforeStart = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 14, period_id: 2, start_date: '2025-01-01' },
  })
  assert.equal(beforeStart.status, 400, 'period_id=2 bắt đầu từ 2025-02-01')

  const afterEnd = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 14, period_id: 2, end_date: '2025-07-01' },
  })
  assert.equal(afterEnd.status, 400, 'period_id=2 kết thúc lúc 2025-06-15')

  assert.equal(await rowCount('internships'), before)

  const updateAttempt = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { start_date: '2025-01-01' },
  })
  assert.equal(updateAttempt.status, 400)
})

// ---- Rule 5b: log_date không ở tương lai, phải nằm trong khoảng thực tập ----

test('Rule 5b: log_date ở tương lai hoặc ngoài khoảng thực tập -> 400, không ghi DB', async () => {
  const before = await rowCount('internship_logs')

  const future = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.studentA.token,
    body: { internship_id: 1, log_date: '2026-10-14', title: 'Test', content: 'Test' },
  })
  assert.equal(future.status, 400, 'log_date ở tương lai (hôm nay là 2026-10-13)')

  const beforeStart = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.studentA.token,
    body: { internship_id: 1, log_date: '2025-01-01', title: 'Test', content: 'Test' },
  })
  assert.equal(beforeStart.status, 400, 'internships.id=1 start_date=2025-02-01')

  const afterEnd = await apiRequest(server.baseUrl, 'POST', '/internship-logs', {
    token: tokens.studentA.token,
    body: { internship_id: 1, log_date: '2025-07-01', title: 'Test', content: 'Test' },
  })
  assert.equal(afterEnd.status, 400, 'internships.id=1 end_date=2025-06-15')

  assert.equal(await rowCount('internship_logs'), before)

  const updateAttempt = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
    token: tokens.studentA.token,
    body: { log_date: '2099-01-01' },
  })
  assert.equal(updateAttempt.status, 400)
})

// ---- Rule 6: báo cáo chỉ nộp khi in_progress/completed; tối đa 1 'final' active; nộp lại khi rejected ----

test('Rule 6a: nộp báo cáo khi internship chưa in_progress/completed -> 409, không ghi DB', async () => {
  const before = await rowCount('reports')
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.admin.token,
    formData: buildReportFormData({ internship_id: 3, report_type: 'weekly' }, { filename: 'test.pdf' }),
  })
  assert.equal(res.status, 409)
  assert.equal(await rowCount('reports'), before)
})

test('Rule 6b: tạo báo cáo "final" lần 2 khi bản đầu chưa bị rejected -> 409, cleanup', async () => {
  const first = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData({ internship_id: 1, report_type: 'final' }, { filename: 'final-v1.pdf' }),
  })
  assert.equal(first.status, 201)
  const firstId = first.body.data.id

  try {
    const second = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
      token: tokens.studentA.token,
      formData: buildReportFormData({ internship_id: 1, report_type: 'final' }, { filename: 'final-v2.pdf' }),
    })
    assert.equal(second.status, 409)
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/reports/${firstId}`, { token: tokens.admin.token })
    assert.equal(cleanup.status, 200)
  }
})

test('Rule 6c: Student nộp lại báo cáo "rejected" — bắt buộc kèm file mới, tự reset về submitted', async () => {
  const create = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData({ internship_id: 1, report_type: 'weekly' }, { filename: 'tuan-x-v1.pdf' }),
  })
  assert.equal(create.status, 201)
  const reportId = create.body.data.id

  try {
    const reject = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportId}`, {
      token: tokens.admin.token,
      body: { status: 'rejected', reviewer_comment: 'Cần sửa lại định dạng.' },
    })
    assert.equal(reject.status, 200)

    // Gửi JSON thường (KHÔNG multipart, không có req.file) kèm field "status" ngoài whitelist ->
    // vẫn đúng 403 ngay tại check field-whitelist của service, không cần file thật để kiểm tra case này.
    const extraField = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportId}`, {
      token: tokens.studentA.token,
      body: { file_name: 'tuan-x-v2.pdf', status: 'approved' },
    })
    assert.equal(extraField.status, 403, 'Khi nộp lại chỉ được thay file mới')

    // Rule mới (upload file thật): nộp lại KHÔNG kèm file thật (chỉ gửi text file_name) phải bị 400 —
    // không còn cách "chỉ sửa tên file" như trước khi có upload thật.
    const withoutRealFile = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportId}`, {
      token: tokens.studentA.token,
      body: { file_name: 'tuan-x-v2.pdf' },
    })
    assert.equal(withoutRealFile.status, 400, 'Nộp lại phải kèm file thật, không chỉ gửi tên file')

    const resubmit = await apiRequestMultipart(server.baseUrl, 'PUT', `/reports/${reportId}`, {
      token: tokens.studentA.token,
      formData: buildReportFormData({}, { filename: 'tuan-x-v2.pdf' }),
    })
    assert.equal(resubmit.status, 200)
    assert.equal(resubmit.body.data.file_name, 'tuan-x-v2.pdf')
    assert.equal(resubmit.body.data.status, 'submitted', 'Nộp lại phải tự reset status về submitted')
    assert.equal(resubmit.body.data.reviewer_comment, null, 'Nộp lại phải xóa reviewer_comment cũ')
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportId}`, { token: tokens.admin.token })
    assert.equal(cleanup.status, 200)
  }
})

test('Rule 6d: nộp lại báo cáo "final" đã rejected -> 409 nếu ĐÃ CÓ báo cáo final KHÁC đang active', async () => {
  // Kịch bản lỗ hổng cũ: final A bị reject -> tạo MỚI final B (hợp lệ, vì A rejected không tính active)
  // -> quay lại nộp LẠI chính A -> nếu không check, A chuyển về 'submitted', có 2 final active cùng lúc.
  const createA = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.studentA.token,
    formData: buildReportFormData({ internship_id: 1, report_type: 'final' }, { filename: 'final-a-v1.pdf' }),
  })
  assert.equal(createA.status, 201)
  const reportAId = createA.body.data.id
  let reportBId = null

  try {
    const rejectA = await apiRequest(server.baseUrl, 'PUT', `/reports/${reportAId}`, {
      token: tokens.admin.token,
      body: { status: 'rejected', reviewer_comment: 'Chưa đạt yêu cầu.' },
    })
    assert.equal(rejectA.status, 200)

    const createB = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
      token: tokens.studentA.token,
      formData: buildReportFormData({ internship_id: 1, report_type: 'final' }, { filename: 'final-b-v1.pdf' }),
    })
    assert.equal(createB.status, 201, 'Tạo final B phải thành công vì A đã rejected (không tính active)')
    reportBId = createB.body.data.id

    const resubmitA = await apiRequestMultipart(server.baseUrl, 'PUT', `/reports/${reportAId}`, {
      token: tokens.studentA.token,
      formData: buildReportFormData({}, { filename: 'final-a-v2.pdf' }),
    })
    assert.equal(
      resubmitA.status,
      409,
      'Nộp lại A phải bị chặn vì B đang active — nếu không sẽ có 2 báo cáo final active cùng lúc',
    )

    const [[rowA]] = await pool.query('SELECT status, file_name FROM reports WHERE id = ?', [reportAId])
    assert.equal(rowA.status, 'rejected', 'A phải vẫn giữ nguyên rejected, không bị đổi')
    assert.equal(rowA.file_name, 'final-a-v1.pdf', 'File của A không được đổi')
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportAId}`, { token: tokens.admin.token })
    if (reportBId) {
      await apiRequest(server.baseUrl, 'DELETE', `/reports/${reportBId}`, { token: tokens.admin.token })
    }
  }
})

// ---- Rule 7: overall_score do server tự tính, reject nếu client gửi ----

test('Rule 7: overall_score tự tính = trung bình 4 điểm thành phần, reject nếu client gửi kèm', async () => {
  const rejectedCreate = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.admin.token,
    body: {
      internship_id: 8,
      evaluator_role: 'company',
      attitude_score: 8,
      skill_score: 7,
      progress_score: 9,
      discipline_score: 7,
      overall_score: 5,
    },
  })
  assert.equal(rejectedCreate.status, 400, 'Gửi overall_score khi tạo phải bị reject')

  const create = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.admin.token,
    body: {
      internship_id: 8,
      evaluator_role: 'company',
      attitude_score: 8,
      skill_score: 7,
      progress_score: 9,
      discipline_score: 7,
    },
  })
  assert.equal(create.status, 201)
  assert.equal(Number(create.body.data.overall_score), 7.8, '(8+7+9+7)/4 = 7.75 -> round 1 chữ số thập phân = 7.8')
  const evaluationId = create.body.data.id

  try {
    const rejectedUpdate = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
      token: tokens.admin.token,
      body: { overall_score: 9 },
    })
    assert.equal(rejectedUpdate.status, 400, 'Gửi overall_score khi update phải bị reject')

    const update = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
      token: tokens.admin.token,
      body: { attitude_score: 10, skill_score: 10, progress_score: 10, discipline_score: 10 },
    })
    assert.equal(update.status, 200)
    assert.equal(Number(update.body.data.overall_score), 10, 'Đổi cả 4 điểm thành phần -> overall_score tính lại')
  } finally {
    const cleanup = await apiRequest(server.baseUrl, 'DELETE', `/evaluations/${evaluationId}`, {
      token: tokens.admin.token,
    })
    assert.equal(cleanup.status, 200)
  }
})

// ---- Rule 8: Student tự sửa email -> đồng bộ users.email, check trùng ở bảng users ----

test('Rule 8: Student tự sửa email -> users.email đồng bộ theo, khôi phục lại giá trị cũ', async () => {
  // QUAN TRỌNG: students.email (contact info, seed='minhanh.nguyen@student.edu.vn') và users.email
  // (login credential, seed='student@example.com') là 2 giá trị KHÁC NHAU ngay từ đầu — phải lưu lại
  // VÀ khôi phục riêng từng bảng, không dùng chung 1 "originalEmail" cho cả 2 (nếu không sẽ làm hỏng
  // users.email, khiến mọi test đăng nhập studentA sau đó fail 401 — đã gặp lỗi này khi viết test).
  const before = await apiRequest(server.baseUrl, 'GET', '/students/1', { token: tokens.studentA.token })
  assert.equal(before.status, 200)
  const originalStudentEmail = before.body.data.email
  const [[originalUserRow]] = await pool.query('SELECT email FROM users WHERE id = 2')
  const originalUserEmail = originalUserRow.email

  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
      token: tokens.studentA.token,
      body: { email: 'minhanh.updated.test@student.edu.vn' },
    })
    assert.equal(update.status, 200)
    assert.equal(update.body.data.email, 'minhanh.updated.test@student.edu.vn')

    const [[userRow]] = await pool.query('SELECT email FROM users WHERE id = 2')
    assert.equal(userRow.email, 'minhanh.updated.test@student.edu.vn', 'users.email phải đồng bộ theo')
  } finally {
    // Khôi phục qua SQL trực tiếp (KHÔNG qua API): nếu khôi phục qua PUT /students/1 {email: originalStudentEmail}
    // thì users.email sẽ bị đồng bộ theo students.email — SAI, vì 2 giá trị gốc khác nhau. Phải set
    // riêng từng bảng để khôi phục đúng byte-for-byte cả 2.
    await pool.execute('UPDATE students SET email = ? WHERE id = 1', [originalStudentEmail])
    await pool.execute('UPDATE users SET email = ? WHERE id = 2', [originalUserEmail])
    const [[studentRow]] = await pool.query('SELECT email FROM students WHERE id = 1')
    const [[userRow]] = await pool.query('SELECT email FROM users WHERE id = 2')
    assert.equal(studentRow.email, originalStudentEmail, 'Phải khôi phục đúng students.email gốc')
    assert.equal(userRow.email, originalUserEmail, 'Phải khôi phục đúng users.email gốc')
  }
})

test('Rule 8: Student đổi email trùng với email đã dùng ở bảng users -> 409, không đổi', async () => {
  const before = await apiRequest(server.baseUrl, 'GET', '/students/1', { token: tokens.studentA.token })
  const originalStudentEmail = before.body.data.email

  const res = await apiRequest(server.baseUrl, 'PUT', '/students/1', {
    token: tokens.studentA.token,
    body: { email: 'lecturer@example.com' },
  })
  assert.equal(res.status, 409)

  const check = await apiRequest(server.baseUrl, 'GET', '/students/1', { token: tokens.studentA.token })
  assert.equal(check.body.data.email, originalStudentEmail, 'Không được đổi email khi bị trùng')
})
