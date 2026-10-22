const test = require('node:test')
const assert = require('node:assert/strict')
const { startTestServer } = require('./helpers/testServer')
const { apiRequest } = require('./helpers/http')
const { loginAll, SEED_ACCOUNTS } = require('./helpers/auth')
const { pool } = require('./helpers/db')

let server
let tokens

// Ground truth verify bằng SQL trực tiếp (không đoán):
//   internship_logs.id=2 -> internship_id=1 (Student A / Lecturer A / Mentor B qua company2), lecturer_comment=''.
//   internships.id=8 -> student_id=11 (Lý Gia Bảo, user_id=6 -> login student3@example.com), status='in_progress',
//     KHÔNG có evaluation nào (an toàn để tạo/xóa evaluation test).
//   students.id=12 (user_id=8 -> studentD) -> KHÔNG có internship nào.
//   lecturers.id=3 (Phạm Văn Sơn, user_id=7 -> lecturerB).

test.before(async () => {
  server = await startTestServer()
  tokens = await loginAll(server.baseUrl, ['admin', 'studentA', 'studentB', 'studentD', 'lecturerA', 'lecturerB'])
})

test.after(async () => {
  await server.close()
})

// Tìm thông báo MỚI NHẤT của 1 user khớp type (để xác định đúng notification vừa được tạo bởi hành
// động test, không giả định ID cố định).
async function findLatestNotification(token, type) {
  const res = await apiRequest(server.baseUrl, 'GET', '/notifications', { token })
  const matches = res.body.data.filter((n) => n.type === type)
  return matches.sort((a, b) => b.id - a.id)[0] ?? null
}

async function deleteNotification(id) {
  if (id) {
    await pool.execute('DELETE FROM notifications WHERE id = ?', [id])
  }
}

test('Notifications: Giảng viên nhận xét nhật ký -> Sinh viên nhận thông báo (log), Sinh viên khác không đọc được', async () => {
  const [[before]] = await pool.query('SELECT lecturer_comment FROM internship_logs WHERE id = 2')
  const originalComment = before.lecturer_comment

  let notification = null
  try {
    const update = await apiRequest(server.baseUrl, 'PUT', '/internship-logs/2', {
      token: tokens.lecturerA.token,
      body: { lecturer_comment: 'Nhận xét test thông báo tự động' },
    })
    assert.equal(update.status, 200)

    notification = await findLatestNotification(tokens.studentA.token, 'log')
    assert.ok(notification, 'Student A phải nhận được thông báo type=log')
    assert.equal(notification.is_read, 0)
    assert.ok(notification.content.includes('#2'), 'Nội dung phải nêu mã nhật ký')

    // Student B (không liên quan) không đọc được thông báo của Student A.
    const forbidden = await apiRequest(server.baseUrl, 'GET', `/notifications/${notification.id}`, {
      token: tokens.studentB.token,
    })
    assert.equal(forbidden.status, 403)
  } finally {
    await pool.execute('UPDATE internship_logs SET lecturer_comment = ? WHERE id = 2', [originalComment])
    await deleteNotification(notification?.id)
  }
})

test('Notifications: Sinh viên tự đăng ký thực tập -> mọi Admin nhận thông báo (internship)', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.studentD.token,
    body: { period_id: 3 },
  })
  assert.equal(create.status, 201)
  const internshipId = create.body.data.id

  let notification = null
  try {
    notification = await findLatestNotification(tokens.admin.token, 'internship')
    assert.ok(notification, 'Admin phải nhận được thông báo type=internship')
    assert.ok(notification.content.includes(`#${internshipId}`), 'Nội dung phải nêu mã hồ sơ thực tập')
    assert.ok(notification.content.includes('Trịnh Thảo My'), 'Nội dung phải nêu tên sinh viên (studentD = students.id=12)')
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/internships/${internshipId}`, { token: tokens.admin.token })
    await deleteNotification(notification?.id)
  }
})

test('Notifications: Phân công giảng viên mới -> cả Sinh viên và Giảng viên nhận thông báo (assignment)', async () => {
  const create = await apiRequest(server.baseUrl, 'POST', '/internships', {
    token: tokens.admin.token,
    body: { student_id: 12, period_id: 3 },
  })
  assert.equal(create.status, 201)
  const internshipId = create.body.data.id

  let studentNotification = null
  let lecturerNotification = null
  try {
    const assign = await apiRequest(server.baseUrl, 'PUT', `/internships/${internshipId}`, {
      token: tokens.admin.token,
      body: { lecturer_id: 3 },
    })
    assert.equal(assign.status, 200)

    studentNotification = await findLatestNotification(tokens.studentD.token, 'assignment')
    assert.ok(studentNotification, 'Sinh viên phải nhận được thông báo phân công giảng viên')

    lecturerNotification = await findLatestNotification(tokens.lecturerB.token, 'assignment')
    assert.ok(lecturerNotification, 'Giảng viên vừa được phân công phải nhận được thông báo')
    assert.ok(lecturerNotification.content.includes('Trịnh Thảo My'), 'Nội dung phải nêu tên sinh viên')

    // Sinh viên không đọc được thông báo của giảng viên và ngược lại.
    const studentReadLecturerOne = await apiRequest(server.baseUrl, 'GET', `/notifications/${lecturerNotification.id}`, {
      token: tokens.studentD.token,
    })
    assert.equal(studentReadLecturerOne.status, 403)
  } finally {
    await deleteNotification(studentNotification?.id)
    await deleteNotification(lecturerNotification?.id)
    await apiRequest(server.baseUrl, 'DELETE', `/internships/${internshipId}`, { token: tokens.admin.token })
  }
})

test('Notifications: Đánh giá được công bố -> Sinh viên nhận thông báo (evaluation), Sinh viên khác không đọc được', async () => {
  const login = await apiRequest(server.baseUrl, 'POST', '/auth/login', {
    body: { email: 'student3@example.com', password: 'student123' },
  })
  assert.equal(login.status, 200)
  const studentCToken = login.body.data.accessToken

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
  const evaluationId = create.body.data.id

  let notification = null
  try {
    const publish = await apiRequest(server.baseUrl, 'PUT', `/evaluations/${evaluationId}`, {
      token: tokens.admin.token,
      body: { is_published: true },
    })
    assert.equal(publish.status, 200)

    notification = await findLatestNotification(studentCToken, 'evaluation')
    assert.ok(notification, 'Sinh viên (chủ hồ sơ) phải nhận được thông báo công bố đánh giá')

    const forbidden = await apiRequest(server.baseUrl, 'GET', `/notifications/${notification.id}`, {
      token: tokens.studentA.token,
    })
    assert.equal(forbidden.status, 403)
  } finally {
    await apiRequest(server.baseUrl, 'DELETE', `/evaluations/${evaluationId}`, { token: tokens.admin.token })
    await deleteNotification(notification?.id)
  }
})

test('Notifications: PUT /notifications/read-all chỉ đánh dấu đã đọc thông báo của CHÍNH MÌNH', async () => {
  // Tạo 2 thông báo test: 1 cho Student A, 1 cho Student B — cả 2 chưa đọc.
  const [resultA] = await pool.execute(
    "INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, 'Test read-all A', 'noi dung test', 'reminder', 0)",
    [tokens.studentA.user.id],
  )
  const [resultB] = await pool.execute(
    "INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, 'Test read-all B', 'noi dung test', 'reminder', 0)",
    [tokens.studentB.user.id],
  )
  const notificationAId = resultA.insertId
  const notificationBId = resultB.insertId

  try {
    const readAll = await apiRequest(server.baseUrl, 'PUT', '/notifications/read-all', { token: tokens.studentA.token })
    assert.equal(readAll.status, 200)

    const [[rowA]] = await pool.query('SELECT is_read FROM notifications WHERE id = ?', [notificationAId])
    assert.equal(rowA.is_read, 1, 'Thông báo của Student A phải thành đã đọc')

    const [[rowB]] = await pool.query('SELECT is_read FROM notifications WHERE id = ?', [notificationBId])
    assert.equal(rowB.is_read, 0, 'Thông báo của Student B KHÔNG được bị ảnh hưởng')
  } finally {
    await deleteNotification(notificationAId)
    await deleteNotification(notificationBId)
  }
})
