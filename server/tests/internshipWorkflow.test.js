const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll } = require('./helpers/auth')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp trước khi viết test (Phase 7B, không đoán):
//   internships.id=3  -> status='pending', không có company/mentor/lecturer
//   internships.id=9  -> status='completed' (trạng thái cuối, ALLOWED_TRANSITIONS.completed = [])
//   internships.id=1  -> status='in_progress', company_id=1, company_mentor_id=1 (thuộc company 1),
//                         student_id=1 (Student A), lecturer_id=1 (Lecturer A)
// ALLOWED_TRANSITIONS thật (server/utils/internshipStatus.js, KHÔNG tự suy diễn):
//   pending: [approved, rejected, cancelled]
//   approved: [in_progress, cancelled]
//   in_progress: [completed, cancelled]
//   completed: []
//   rejected: [pending]
//   cancelled: [pending]

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'lecturerA'])
})

test.after(async () => {
  await server.close()
})

test('Workflow: transition không hợp lệ (pending -> in_progress, bỏ qua approved) -> 409', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { status: 'in_progress' },
  })
  assert.equal(res.status, 409)
})

test('Workflow: completed là trạng thái cuối — không chuyển sang bất kỳ trạng thái nào khác, kể cả Admin', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/9', {
    token: tokens.admin.token,
    body: { status: 'in_progress' },
  })
  assert.equal(res.status, 409)
})

test('Workflow: round-trip hợp lệ pending -> rejected -> pending (đúng ALLOWED_TRANSITIONS thật)', async () => {
  try {
    const toRejected = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'rejected' },
    })
    assert.equal(toRejected.status, 200)
    assert.equal(toRejected.body.data.status, 'rejected')
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { status: 'pending' },
    })
    assert.equal(restore.status, 200, 'Phải khôi phục được internships.id=3 về status=pending')
    assert.equal(restore.body.data.status, 'pending')
  }
})

test('Workflow: Lecturer/Company Mentor không có quyền PUT /internships (403 route-level)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.lecturerA.token,
    body: { progress: 50 },
  })
  assert.equal(res.status, 403)
})

test('Workflow: Student không được tự đổi status (ngoài 3 field whitelist company_id/company_mentor_id/topic_id)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.studentA.token,
    body: { status: 'completed' },
  })
  assert.equal(res.status, 403)
})

test('Workflow: Student bị khóa sửa company/mentor/topic khi internship không còn ở pending/approved', async () => {
  // internships.id=1 (của Student A) đang 'in_progress' — ngoài EDITABLE_STATUSES ['pending','approved']
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.studentA.token,
    body: { topic_id: 2 },
  })
  assert.equal(res.status, 409)
})

test('Workflow: Student không sửa được internship của người khác (403, không phải 404 — không lộ tồn tại)', async () => {
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/4', {
    token: tokens.studentA.token,
    body: { topic_id: 2 },
  })
  assert.equal(res.status, 403)
})

test('Assignment: company_mentor không thuộc company đã chọn -> 400, không ghi DB', async () => {
  // company_mentors.id=7 thuộc company_id=4, KHÔNG thuộc company_id=1
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
    token: tokens.admin.token,
    body: { company_id: 1, company_mentor_id: 7 },
  })
  assert.equal(res.status, 400)

  const check = await apiRequest(server.baseUrl, 'GET', '/internships/3', { token: tokens.admin.token })
  assert.equal(check.body.data.company_id, null, 'internships.id=3 phải vẫn chưa có company sau request bị reject')
})

test('Assignment: đổi company_id mà không gửi company_mentor_id mới -> 400 nếu mentor hiện tại không còn thuộc company mới', async () => {
  // internships.id=1: company_mentor_id=1 (thuộc company_id=1 hiện tại). Đổi company_id=4 mà không
  // gửi company_mentor_id mới -> mentor cũ (company_id=1) không còn khớp company mới (4).
  const res = await apiRequest(server.baseUrl, 'PUT', '/internships/1', {
    token: tokens.admin.token,
    body: { company_id: 4 },
  })
  assert.equal(res.status, 400)

  const check = await apiRequest(server.baseUrl, 'GET', '/internships/1', { token: tokens.admin.token })
  assert.equal(check.body.data.company_id, 1, 'internships.id=1 phải vẫn giữ company_id=1 sau request bị reject')
})

test('Assignment: gán company+mentor hợp lệ (mentor thuộc đúng company) -> 200, khôi phục lại null', async () => {
  // internships.id=3 hiện chưa có company/mentor — company_mentors.id=7 thuộc company_id=4 (khớp).
  try {
    const assign = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { company_id: 4, company_mentor_id: 7 },
    })
    assert.equal(assign.status, 200)
    assert.equal(assign.body.data.company_id, 4)
    assert.equal(assign.body.data.company_mentor_id, 7)
  } finally {
    const restore = await apiRequest(server.baseUrl, 'PUT', '/internships/3', {
      token: tokens.admin.token,
      body: { company_id: null, company_mentor_id: null },
    })
    assert.equal(restore.status, 200)
    assert.equal(restore.body.data.company_id, null, 'Phải khôi phục internships.id=3 về chưa có company')
    assert.equal(restore.body.data.company_mentor_id, null)
  }
})
