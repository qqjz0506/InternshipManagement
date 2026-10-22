const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest, apiRequestMultipart } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')
const { rowCount } = require('./helpers/db')
const { buildReportFormData } = require('./helpers/fileFixtures')

let server
let tokens

// Ground truth verify qua SQL trước khi viết test:
//   internship_logs.id=1 (internship_id=1, status='reviewed') — thuộc Student A / Lecturer A
//   evaluations.id=1 (internship_id=1, evaluator_role='lecturer', is_published=1)
//   evaluations.id=2 (internship_id=4, evaluator_role='lecturer', is_published=0) — thuộc Student B / Lecturer B
//   internships.id=7,8 (status='in_progress', KHÔNG có evaluation nào, mọi role) — an toàn để
//     create+delete test evaluation mà không đụng dữ liệu seed thật.

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentB', 'lecturerA', 'lecturerB'])
})

test.after(async () => {
  await server.close()
})

// ---- Logs ----

test('Business rule: Log đã reviewed -> edit content bị chặn (409)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/1', {
    token: tokens.studentA.token,
    body: { content: 'Sửa nội dung sau khi đã reviewed' },
  })
  assert.equal(res.status, 409)
})

test('Business rule: Log đã reviewed -> delete bị chặn (409)', async () => {
  const before = await rowCount('internship_logs')
  const res = await apiRequest(server.baseUrl, 'DELETE', '/internship-logs/1', {
    token: tokens.studentA.token,
  })
  assert.equal(res.status, 409)
  assert.equal(await rowCount('internship_logs'), before, 'Không được xóa log đã reviewed')
})

test('Business rule: Log reviewed -> submitted (one-way) bị chặn ngay cả với Admin', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/1', {
    token: tokens.admin.token,
    body: { status: 'submitted' },
  })
  assert.equal(res.status, 409)
})

// ---- Reports ----

test('Business rule: submitted_at do server tự sinh, client gửi kèm -> 400, không tạo report', async () => {
  const before = await rowCount('reports')
  // Rule mới (upload file thật): POST /reports giờ là multipart/form-data, field "file" bắt buộc —
  // vẫn đính kèm 1 file hợp lệ để request tới được đúng tầng validate submitted_at (không bị chặn
  // sớm hơn vì "thiếu file").
  const formData = buildReportFormData({ internship_id: 1, report_type: 'weekly', submitted_at: '2026-01-01' })
  const res = await apiRequestMultipart(server.baseUrl, 'POST', '/reports', {
    token: tokens.admin.token,
    formData,
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('reports'), before)
})

// ---- Evaluations ----

test('Business rule: điểm đánh giá ngoài khoảng 0-10 -> 400, không tạo row', async () => {
  const before = await rowCount('evaluations')
  const res = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.admin.token,
    body: {
      internship_id: 7,
      evaluator_role: 'company',
      attitude_score: 11,
      skill_score: 8,
      progress_score: 8,
      discipline_score: 8,
      overall_score: 8,
    },
  })
  assert.equal(res.status, 400)
  assert.equal(await rowCount('evaluations'), before)
})

test('Business rule: unique (internship_id, evaluator_role) — tạo trùng -> 409, cleanup', async () => {
  // Phase "Business Rules V2": overall_score không còn là field client gửi được (server tự tính từ
  // 4 điểm thành phần) — bỏ khỏi payload, không còn gửi ở đây.
  const create = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
    token: tokens.admin.token,
    body: {
      internship_id: 8,
      evaluator_role: 'company',
      attitude_score: 8,
      skill_score: 8,
      progress_score: 8,
      discipline_score: 8,
    },
  })
  assert.equal(create.status, 201)
  const createdId = create.body.data.id

  try {
    const duplicate = await apiRequest(server.baseUrl, 'POST', '/evaluations', {
      token: tokens.admin.token,
      body: {
        internship_id: 8,
        evaluator_role: 'company',
        attitude_score: 7,
        skill_score: 7,
        progress_score: 7,
        discipline_score: 7,
      },
    })
    assert.equal(duplicate.status, 409)
  } finally {
    const del = await apiRequest(server.baseUrl, 'DELETE', `/evaluations/${createdId}`, { token: tokens.admin.token })
    assert.equal(del.status, 200, 'cleanup DELETE phải thành công, không để lại dữ liệu test')
  }
})

test('Business rule: evaluation đã công bố -> không sửa được điểm/nhận xét (409)', async () => {
  // Trước "Business Rules V2" test này gửi { overall_score: 9.9 } — overall_score giờ bị reject 400
  // ngay từ đầu update() (không còn là field client gửi được), nên test sẽ nhận 400 thay vì 409 nếu
  // giữ nguyên, che mất đúng hành vi cần kiểm tra ở đây (khóa field do ĐÃ CÔNG BỐ). Đổi sang
  // attitude_score — 1 field thành phần thật client vẫn được gửi — để tiếp tục đúng mục tiêu test.
  const res = await apiRequest(server.baseUrl, 'PUT', '/evaluations/1', {
    token: tokens.lecturerA.token,
    body: { attitude_score: 9.9 },
  })
  assert.equal(res.status, 409)
})

test('Business rule: Student không có quyền publish/unpublish evaluation (403, route-level)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/evaluations/2', {
    token: tokens.studentB.token,
    body: { is_published: true },
  })
  assert.equal(res.status, 403)
})

test('Business rule: Lecturer publish là one-way — publish được, unpublish bị chặn', async () => {
  try {
    const publish = await apiRequest(server.baseUrl, 'PUT', '/evaluations/2', {
      token: tokens.lecturerB.token,
      body: { is_published: true },
    })
    assert.equal(publish.status, 200)
    assert.equal(Boolean(publish.body.data.is_published), true)

    const unpublishAttempt = await apiRequest(server.baseUrl, 'PUT', '/evaluations/2', {
      token: tokens.lecturerB.token,
      body: { is_published: false },
    })
    assert.equal(unpublishAttempt.status, 403)
  } finally {
    // Khôi phục đúng trạng thái seed gốc (is_published=0) bằng Admin (được cả 2 chiều) — không để
    // lại mutation vĩnh viễn trên seed data, chạy trong finally để luôn thực hiện kể cả khi assertion
    // phía trên fail (mục 4/15 Phase 6B: không mutate seed data vĩnh viễn chỉ để test).
    const restore = await apiRequest(server.baseUrl, 'PUT', '/evaluations/2', {
      token: tokens.admin.token,
      body: { is_published: false },
    })
    assert.equal(restore.status, 200, 'Phải khôi phục được is_published=0 cho evaluations.id=2')
  }
})
