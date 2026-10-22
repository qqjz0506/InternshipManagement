const { pool } = require('../config/database')
const AppError = require('../utils/AppError')

const TYPE_VALUES = ['internship', 'assignment', 'report', 'reminder', 'evaluation', 'log']

// KHÔNG tin user_id từ query string (mục 14 Phase 3B — IDOR test bắt buộc): non-admin luôn bị ép
// user_id = req.user.id bất kể client gửi gì trong query.
async function getAll({ user_id }, currentUser) {
  const effectiveUserId = currentUser.role === 'admin' ? user_id : currentUser.id

  const conditions = []
  const params = []
  if (effectiveUserId) {
    conditions.push('user_id = ?')
    params.push(effectiveUserId)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT * FROM notifications ${where} ORDER BY id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [id])
  return rows[0] ?? null
}

async function getByIdForUser(id, currentUser) {
  const notification = await getById(id)
  if (!notification) {
    return null
  }
  if (currentUser.role !== 'admin' && notification.user_id !== currentUser.id) {
    throw new AppError(403, 'Bạn không có quyền xem thông báo này.')
  }
  return notification
}

async function userExists(id) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id])
  return rows.length > 0
}

// CREATE: chỉ Admin (route-level) — KHÔNG có UI nào tạo notification (chỉ static seed +
// mark-as-read) — endpoint cung cấp cho đủ REST convention/schema, KHÔNG tự động sinh từ resource
// khác (không event engine, đúng yêu cầu).
async function create({ user_id, title, content, type }) {
  if (!(await userExists(user_id))) {
    throw new AppError(400, 'Người dùng không tồn tại.')
  }
  if (!TYPE_VALUES.includes(type)) {
    throw new AppError(400, `type phải là một trong: ${TYPE_VALUES.join(', ')}.`)
  }

  const [result] = await pool.execute(
    `INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, ?, ?, ?, 0)`,
    [user_id, title, content ?? null, type],
  )
  return getById(result.insertId)
}

// UPDATE: chỉ Frontend dùng đúng 1 hành động — updateItem(id, { is_read: true }) (mark as read).
// Chỉ CHỦ SỞ HỮU (user_id = req.user.id) hoặc Admin được đánh dấu — IDOR protection bắt buộc.
// user_id/title/content/type immutable sau khi tạo — không UI nào sửa.
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy thông báo.')
  }

  if (currentUser.role !== 'admin' && existing.user_id !== currentUser.id) {
    throw new AppError(403, 'Bạn không có quyền sửa thông báo này.')
  }

  ;['user_id', 'title', 'content', 'type'].forEach((field) => {
    if (field in payload) {
      throw new AppError(400, `${field} là immutable — không được gửi field này khi cập nhật thông báo.`)
    }
  })

  if (!('is_read' in payload)) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  await pool.execute('UPDATE notifications SET is_read = ? WHERE id = ?', [payload.is_read ? 1 : 0, id])
  return getById(id)
}

async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy thông báo.')
  }
  await pool.execute('DELETE FROM notifications WHERE id = ?', [id])
}

// Admin đánh dấu đã đọc TOÀN BỘ thông báo của CHÍNH MÌNH (PUT /api/notifications/read-all) — chỉ
// tác động tới user_id = currentUser.id, không có cách nào đánh dấu cho người khác.
async function markAllAsRead(currentUser) {
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [currentUser.id])
}

// Thông báo tự động — gọi SAU KHI nghiệp vụ chính đã thành công (business event ghi xong), KHÔNG
// phải 1 event engine/queue thật (không retry, không hàng đợi) — chỉ 1 INSERT đơn giản theo đúng yêu
// cầu "đơn giản, không cần event engine/queue".
//
// userId null/undefined (profile chưa liên kết tài khoản đăng nhập) -> bỏ qua êm, KHÔNG throw — đây
// là tình huống hợp lệ (vd. company_mentors.user_id NULL), không phải lỗi.
//
// conn (tùy chọn): nếu caller đang chạy trong 1 transaction (connection.beginTransaction()) và muốn
// thông báo là 1 phần ATOMIC của transaction đó (hiếm, chỉ dùng khi thật cần), truyền connection vào
// — lỗi khi đó sẽ ĐƯỢC NÉM LẠI để caller rollback đúng. Mặc định (không có conn, tức notify() tự
// chạy ngoài transaction của nghiệp vụ chính — đúng đa số trường hợp hiện tại): lỗi tạo thông báo
// KHÔNG được làm fail nghiệp vụ chính đã thành công trước đó — chỉ log lại qua console.error.
async function notify({ userId, type, title, content }, conn) {
  if (!userId) {
    return
  }
  if (!TYPE_VALUES.includes(type)) {
    throw new Error(`notify(): type không hợp lệ: ${type}`)
  }

  const executor = conn || pool
  try {
    await executor.execute(
      'INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, ?, ?, ?, 0)',
      [userId, title, content ?? null, type],
    )
  } catch (error) {
    if (conn) {
      throw error
    }
    console.error('notify() thất bại (không làm fail nghiệp vụ chính):', error)
  }
}

module.exports = { getAll, getById, getByIdForUser, create, update, remove, markAllAsRead, notify }
