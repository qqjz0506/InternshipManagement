const { pool } = require('../config/database')
const AppError = require('../utils/AppError')
const scopeService = require('./scopeService')
const notificationService = require('./notificationService')
const settingsService = require('./settingsService')
const { todayDateString } = require('../utils/dateTime')

// overall_score KHÔNG còn nhận từ client (rule mới) — server tự tính = trung bình 4 điểm thành phần,
// làm tròn 1 chữ số thập phân. Nếu client gửi overall_score (create hoặc update): CHỌN PHƯƠNG ÁN
// REJECT 400 (không silently ignore) — nhất quán với convention "reject cứng field không được client
// set" đã áp dụng xuyên suốt dự án (role/profile_id/student_id/evaluator_role...).
const COMPONENT_SCORE_FIELDS = ['attitude_score', 'skill_score', 'progress_score', 'discipline_score']
const EVALUATOR_ROLES = ['lecturer', 'company']
// Map role tài khoản -> evaluator_role tương ứng (đúng business rule: evaluator suy ra từ Internship,
// không có evaluator_id riêng — mục 3 Phase 3B).
const ROLE_TO_EVALUATOR_ROLE = { lecturer: 'lecturer', company_mentor: 'company' }

function resolveOptionalText(value) {
  return value === undefined || value === null || value === '' ? null : value
}

function validateScore(field, value) {
  const num = Number(value)
  if (Number.isNaN(num) || num < 0 || num > 10) {
    throw new AppError(400, `${field} phải nằm trong khoảng 0-10.`)
  }
  return num
}

// components: object { attitude_score, skill_score, progress_score, discipline_score } (số, không
// phải string DECIMAL từ DB) -> overall_score = trung bình, làm tròn 1 chữ số thập phân.
function computeOverallScore(components) {
  const sum = COMPONENT_SCORE_FIELDS.reduce((acc, field) => acc + Number(components[field]), 0)
  return Math.round((sum / COMPONENT_SCORE_FIELDS.length) * 10) / 10
}

async function getAll({ internship_id, evaluator_role, is_published }, currentUser) {
  const conditions = []
  const params = []
  if (internship_id) {
    conditions.push('e.internship_id = ?')
    params.push(internship_id)
  }
  if (evaluator_role) {
    conditions.push('e.evaluator_role = ?')
    params.push(evaluator_role)
  }
  if (is_published !== undefined) {
    conditions.push('e.is_published = ?')
    params.push(is_published === 'true' || is_published === true ? 1 : 0)
  }

  let join = ''
  if (currentUser.role === 'student') {
    // Student chỉ xem đánh giá ĐÃ CÔNG BỐ của chính mình (mục 7 Phase 3B + is_published rule Phase 2F).
    const own = await scopeService.getStudentProfile(currentUser.id)
    join = 'JOIN internships i ON i.id = e.internship_id'
    conditions.push('i.student_id = ?', 'e.is_published = 1')
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    join = 'JOIN internships i ON i.id = e.internship_id'
    conditions.push('i.lecturer_id = ?', "e.evaluator_role = 'lecturer'")
    params.push(own?.id ?? 0)
  } else if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    join = 'JOIN internships i ON i.id = e.internship_id'
    conditions.push('i.company_mentor_id = ?', "e.evaluator_role = 'company'")
    params.push(own?.id ?? 0)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await pool.execute(`SELECT e.* FROM evaluations e ${join} ${where} ORDER BY e.id`, params)
  return rows
}

async function getById(id) {
  const [rows] = await pool.execute('SELECT * FROM evaluations WHERE id = ?', [id])
  return rows[0] ?? null
}

// Kiểm tra currentUser có quyền xem evaluation `id` hay không (admin luôn true).
async function canAccessEvaluation(evaluation, currentUser) {
  if (currentUser.role === 'admin') return true
  const internship = await scopeService.getInternshipOrThrow(evaluation.internship_id)
  if (currentUser.role === 'student') {
    const own = await scopeService.getStudentProfile(currentUser.id)
    return evaluation.is_published === 1 && internship.student_id === (own?.id ?? -1)
  }
  if (currentUser.role === 'lecturer') {
    const own = await scopeService.getLecturerProfile(currentUser.id)
    return evaluation.evaluator_role === 'lecturer' && internship.lecturer_id === (own?.id ?? -1)
  }
  if (currentUser.role === 'company_mentor') {
    const own = await scopeService.getCompanyMentorProfile(currentUser.id)
    return evaluation.evaluator_role === 'company' && internship.company_mentor_id === (own?.id ?? -1)
  }
  return false
}

async function getByIdForUser(id, currentUser) {
  const evaluation = await getById(id)
  if (!evaluation) {
    return null
  }
  if (!(await canAccessEvaluation(evaluation, currentUser))) {
    throw new AppError(403, 'Bạn không có quyền xem đánh giá này.')
  }
  return evaluation
}

async function getInternshipById(id) {
  const [rows] = await pool.execute('SELECT * FROM internships WHERE id = ?', [id])
  return rows[0] ?? null
}

async function isDuplicate(internshipId, evaluatorRole, ignoreId) {
  const params = [internshipId, evaluatorRole]
  let query = 'SELECT id FROM evaluations WHERE internship_id = ? AND evaluator_role = ?'
  if (ignoreId) {
    query += ' AND id != ?'
    params.push(ignoreId)
  }
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

// CREATE: khớp LecturerEvaluationForm.jsx/CompanyEvaluationForm.jsx — is_published/published_at luôn
// mặc định false/null lúc tạo (chỉ đổi qua hành động publish riêng). canEvaluate: chỉ tạo mới khi
// Internship đang 'in_progress' hoặc 'completed' (đúng LecturerEvaluationsPage.jsx/CompanyEvaluationsPage.jsx).
async function create(payload, currentUser) {
  const { internship_id, comment, is_published, published_at } = payload
  let { evaluator_role } = payload

  const internship = await getInternshipById(internship_id)
  if (!internship) {
    throw new AppError(400, 'Hồ sơ thực tập không tồn tại.')
  }

  // Lecturer/Company Mentor: KHÔNG tin evaluator_role từ client — suy ra từ chính role tài khoản
  // (mục 24 Phase 3B), và internship phải thuộc đúng phạm vi của mình.
  if (currentUser.role === 'lecturer' || currentUser.role === 'company_mentor') {
    const forcedRole = ROLE_TO_EVALUATOR_ROLE[currentUser.role]
    if (evaluator_role !== undefined && evaluator_role !== forcedRole) {
      throw new AppError(403, `Tài khoản này chỉ được tạo đánh giá với evaluator_role = "${forcedRole}".`)
    }
    evaluator_role = forcedRole

    const own =
      currentUser.role === 'lecturer'
        ? await scopeService.getLecturerProfile(currentUser.id)
        : await scopeService.getCompanyMentorProfile(currentUser.id)
    const ownColumn = currentUser.role === 'lecturer' ? internship.lecturer_id : internship.company_mentor_id
    if (!own || ownColumn !== own.id) {
      throw new AppError(403, 'Bạn không được tạo đánh giá cho hồ sơ thực tập ngoài phạm vi phụ trách.')
    }
  }

  if (!EVALUATOR_ROLES.includes(evaluator_role)) {
    throw new AppError(400, `evaluator_role phải là một trong: ${EVALUATOR_ROLES.join(', ')}.`)
  }
  if (!['in_progress', 'completed'].includes(internship.status)) {
    throw new AppError(409, 'Chỉ được tạo đánh giá khi hồ sơ thực tập đang "in_progress" hoặc đã "completed".')
  }
  if (await isDuplicate(internship_id, evaluator_role)) {
    throw new AppError(409, `Hồ sơ này đã có đánh giá từ "${evaluator_role}".`)
  }
  if (is_published !== undefined && is_published !== false) {
    throw new AppError(400, 'is_published không được set khi tạo mới — đánh giá luôn bắt đầu ở dạng nháp.')
  }
  if (published_at !== undefined && published_at !== null) {
    throw new AppError(400, 'published_at không được set khi tạo mới.')
  }
  if ('overall_score' in payload) {
    throw new AppError(400, 'overall_score do hệ thống tự tính từ 4 điểm thành phần, không được gửi khi tạo đánh giá.')
  }

  const scores = {}
  COMPONENT_SCORE_FIELDS.forEach((field) => {
    if (payload[field] === undefined) {
      throw new AppError(400, `Vui lòng nhập ${field}.`)
    }
    scores[field] = validateScore(field, payload[field])
  })
  const overallScore = computeOverallScore(scores)

  const [result] = await pool.execute(
    `INSERT INTO evaluations
      (internship_id, evaluator_role, attitude_score, skill_score, progress_score, discipline_score, overall_score, comment, is_published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      internship_id,
      evaluator_role,
      scores.attitude_score,
      scores.skill_score,
      scores.progress_score,
      scores.discipline_score,
      overallScore,
      resolveOptionalText(comment),
    ],
  )
  return getById(result.insertId)
}

// UPDATE: partial. internship_id/evaluator_role immutable. Điểm/nhận xét khóa khi đã is_published=true
// (đúng disabled={isPublished} trong 2 Form). is_published có thể đổi CẢ 2 CHIỀU (Admin unpublish được,
// Lecturer/Company chỉ publish) — không phân biệt được ở tầng API vì chưa có Auth/RBAC, nên cho phép cả
// 2 chiều (đúng năng lực rộng nhất hiện có là Admin), publish/unpublish luôn tự đồng bộ published_at.
async function update(id, payload, currentUser) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đánh giá.')
  }

  if ('internship_id' in payload) {
    throw new AppError(400, 'internship_id là immutable — không được gửi field này khi cập nhật đánh giá.')
  }
  if ('evaluator_role' in payload) {
    throw new AppError(400, 'evaluator_role là immutable — không được gửi field này khi cập nhật đánh giá.')
  }
  if ('overall_score' in payload) {
    throw new AppError(400, 'overall_score do hệ thống tự tính, không được gửi khi cập nhật đánh giá.')
  }

  // Bất biến hồ sơ 'completed' (đợt kiểm tra trước bảo vệ): KHÔNG cho bỏ công bố đánh giá thuộc hồ
  // sơ đã hoàn thành — kể cả Admin (Admin vốn được unpublish cả 2 chiều, xem comment dưới, nhưng
  // không áp dụng được nữa 1 khi hồ sơ đã completed, vì điểm tổng kết đã chốt theo đúng 2 đánh giá đó
  // — xem evaluationService.computeFinalResult + internships.final_score).
  if ('is_published' in payload && existing.is_published && !payload.is_published) {
    const internshipForLockCheck = await scopeService.getInternshipOrThrow(existing.internship_id)
    if (internshipForLockCheck.status === 'completed') {
      throw new AppError(409, 'Không thể bỏ công bố đánh giá của hồ sơ đã hoàn thành (completed).')
    }
  }

  // Lecturer/Company Mentor: chỉ sửa ĐÚNG đánh giá do role của mình tạo (evaluator_role tương ứng)
  // và thuộc internship mình phụ trách; chỉ publish được (1 chiều), không unpublish — đúng
  // Database Design mục H.11 + LecturerEvaluationForm.jsx/CompanyEvaluationForm.jsx (handlePublish
  // không có chiều ngược). Admin bypass scope, được cả 2 chiều (AdminEvaluationDetailPage.jsx).
  if (currentUser.role === 'lecturer' || currentUser.role === 'company_mentor') {
    const expectedRole = ROLE_TO_EVALUATOR_ROLE[currentUser.role]
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const own =
      currentUser.role === 'lecturer'
        ? await scopeService.getLecturerProfile(currentUser.id)
        : await scopeService.getCompanyMentorProfile(currentUser.id)
    const ownColumn = currentUser.role === 'lecturer' ? internship.lecturer_id : internship.company_mentor_id
    if (existing.evaluator_role !== expectedRole || !own || ownColumn !== own.id) {
      throw new AppError(403, 'Bạn không có quyền sửa đánh giá này.')
    }
    if ('is_published' in payload && existing.is_published && !payload.is_published) {
      throw new AppError(403, 'Bạn không có quyền bỏ công bố đánh giá đã công bố — chỉ Admin được phép.')
    }
  }

  const changes = {}
  const touchesScoreOrComment = [...COMPONENT_SCORE_FIELDS, 'comment'].some((field) => field in payload)
  if (touchesScoreOrComment && existing.is_published) {
    throw new AppError(409, 'Đánh giá đã công bố — không thể sửa điểm/nhận xét.')
  }

  COMPONENT_SCORE_FIELDS.forEach((field) => {
    if (field in payload) {
      changes[field] = validateScore(field, payload[field])
    }
  })
  // Rule mới: bất kỳ điểm thành phần nào đổi -> tính lại overall_score từ giá trị HIỆU LỰC (mới nếu
  // có đổi, cũ nếu không) — existing[field] là DECIMAL trả về dạng string từ mysql2 nên phải Number().
  const touchesComponent = COMPONENT_SCORE_FIELDS.some((field) => field in changes)
  if (touchesComponent) {
    const effective = {}
    COMPONENT_SCORE_FIELDS.forEach((field) => {
      effective[field] = field in changes ? changes[field] : Number(existing[field])
    })
    changes.overall_score = computeOverallScore(effective)
  }
  if ('comment' in payload) {
    changes.comment = resolveOptionalText(payload.comment)
  }

  if ('is_published' in payload) {
    const nextPublished = Boolean(payload.is_published)
    changes.is_published = nextPublished ? 1 : 0
    changes.published_at = nextPublished ? todayDateString() : null
  } else if ('published_at' in payload) {
    throw new AppError(400, 'published_at chỉ được đổi cùng với is_published.')
  }

  const fields = Object.keys(changes)
  if (fields.length === 0) {
    throw new AppError(400, 'Không có trường nào để cập nhật.')
  }

  const setClause = fields.map((field) => `${field} = ?`).join(', ')
  const values = fields.map((field) => changes[field])
  await pool.execute(`UPDATE evaluations SET ${setClause} WHERE id = ?`, [...values, id])

  const updated = await getById(id)

  // Thông báo: đánh giá vừa được công bố (0 -> 1, KHÔNG báo khi unpublish) -> báo Sinh viên.
  if (changes.is_published === 1) {
    const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
    const studentInfo = await scopeService.getStudentBasicInfo(internship.student_id)
    await notificationService.notify({
      userId: studentInfo?.user_id,
      type: 'evaluation',
      title: 'Có đánh giá thực tập mới được công bố',
      content: `Đánh giá (${existing.evaluator_role === 'lecturer' ? 'Giảng viên' : 'Doanh nghiệp'}) cho hồ sơ thực tập #${existing.internship_id} của bạn đã được công bố.`,
    })
  }

  return updated
}

// DELETE: không có UI nào xóa Evaluation — cung cấp cho đủ REST convention. Bất biến hồ sơ
// 'completed' (đợt kiểm tra trước bảo vệ): không xóa đánh giá thuộc hồ sơ đã hoàn thành.
async function remove(id) {
  const existing = await getById(id)
  if (!existing) {
    throw new AppError(404, 'Không tìm thấy đánh giá.')
  }
  const internship = await scopeService.getInternshipOrThrow(existing.internship_id)
  if (internship.status === 'completed') {
    throw new AppError(409, 'Không thể xóa đánh giá của hồ sơ đã hoàn thành (completed).')
  }
  await pool.execute('DELETE FROM evaluations WHERE id = ?', [id])
}

// Xếp loại điểm tổng kết thực tập — mảng sắp xếp giảm dần theo `min`, match đầu tiên thắng.
const CLASSIFICATION_BANDS = [
  { min: 9, label: 'Xuất sắc' },
  { min: 8, label: 'Giỏi' },
  { min: 6.5, label: 'Khá' },
  { min: 5, label: 'Trung bình' },
  { min: 0, label: 'Không đạt' },
]

function classify(score) {
  const band = CLASSIFICATION_BANDS.find((b) => score >= b.min)
  return band.label
}

// Điểm tổng kết thực tập = overall_score(lecturer) * lecturer_weight + overall_score(company) * company_weight,
// chia 100, làm tròn 1 chữ số thập phân — CHỈ tính khi CẢ HAI đánh giá (lecturer + company) của internship
// đã is_published=1. Đây là data-availability gate áp dụng ĐỒNG NHẤT cho mọi role (kể cả Admin) — không
// phải permission check riêng cho sinh viên, vì giá trị thực sự chưa tồn tại khi chưa đủ 2 đánh giá công bố.
//
// Bất biến hồ sơ 'completed' (đợt kiểm tra trước bảo vệ): nếu hồ sơ ĐÃ 'completed' VÀ đã có
// internships.final_score (chốt lúc chuyển sang completed — xem internshipService.update()), LUÔN trả
// về đúng giá trị ĐÃ CHỐT đó, KHÔNG tính lại — đảm bảo đổi trọng số ở Settings sau này không làm đổi
// điểm của các hồ sơ đã hoàn thành. Hồ sơ chưa completed (hoặc completed nhưng chưa backfill — xem
// migrations/005) vẫn tính "sống" theo trọng số HIỆN TẠI như trước đây.
async function computeFinalResult(internshipId) {
  const [[internship]] = await pool.execute(
    'SELECT status, final_score, final_classification FROM internships WHERE id = ?',
    [internshipId],
  )
  if (internship?.status === 'completed' && internship.final_score !== null) {
    return { finalScore: Number(internship.final_score), classification: internship.final_classification }
  }

  const [rows] = await pool.execute(
    `SELECT evaluator_role, overall_score, is_published FROM evaluations
     WHERE internship_id = ? AND evaluator_role IN ('lecturer', 'company')`,
    [internshipId],
  )
  const lecturerEval = rows.find((r) => r.evaluator_role === 'lecturer')
  const companyEval = rows.find((r) => r.evaluator_role === 'company')
  if (!lecturerEval?.is_published || !companyEval?.is_published) {
    return null
  }

  const settings = await settingsService.get()
  const lecturerWeight = Number(settings.lecturer_weight)
  const companyWeight = Number(settings.company_weight)
  const sum = Number(lecturerEval.overall_score) * lecturerWeight + Number(companyEval.overall_score) * companyWeight
  const finalScore = Math.round(sum / 10) / 10
  return { finalScore, classification: classify(finalScore) }
}

// Bulk version cho exportService (tránh N+1 query khi export toàn bộ đánh giá) — dùng giá trị ĐÃ CHỐT
// cho hồ sơ 'completed' có final_score, chỉ tính "sống" cho phần còn lại (giống computeFinalResult()).
async function computeFinalResultsBulk(internshipIds) {
  const result = new Map()
  if (!internshipIds || internshipIds.length === 0) {
    return result
  }

  const placeholders = internshipIds.map(() => '?').join(', ')
  const [internshipRows] = await pool.execute(
    `SELECT id, status, final_score, final_classification FROM internships WHERE id IN (${placeholders})`,
    internshipIds,
  )
  const idsNeedingLiveComputation = []
  internshipRows.forEach((row) => {
    if (row.status === 'completed' && row.final_score !== null) {
      result.set(row.id, { finalScore: Number(row.final_score), classification: row.final_classification })
    } else {
      idsNeedingLiveComputation.push(row.id)
    }
  })
  if (idsNeedingLiveComputation.length === 0) {
    return result
  }

  const livePlaceholders = idsNeedingLiveComputation.map(() => '?').join(', ')
  const [rows] = await pool.execute(
    `SELECT internship_id,
        MAX(CASE WHEN evaluator_role = 'lecturer' AND is_published = 1 THEN overall_score END) AS lecturer_score,
        MAX(CASE WHEN evaluator_role = 'company' AND is_published = 1 THEN overall_score END) AS company_score
     FROM evaluations
     WHERE internship_id IN (${livePlaceholders})
     GROUP BY internship_id
     HAVING lecturer_score IS NOT NULL AND company_score IS NOT NULL`,
    idsNeedingLiveComputation,
  )
  if (rows.length === 0) {
    return result
  }

  const settings = await settingsService.get()
  const lecturerWeight = Number(settings.lecturer_weight)
  const companyWeight = Number(settings.company_weight)
  rows.forEach((row) => {
    const sum = Number(row.lecturer_score) * lecturerWeight + Number(row.company_score) * companyWeight
    const finalScore = Math.round(sum / 10) / 10
    result.set(row.internship_id, { finalScore, classification: classify(finalScore) })
  })
  return result
}

// Lấy CẢ 2 đánh giá (lecturer + company) ĐÃ CÔNG BỐ của 1 internship — dùng cho phiếu kết quả PDF
// (Mục 16L README). CHỈ gọi khi internship.status === 'completed' (bất biến 16F đảm bảo cả 2 đã công
// bố tại thời điểm đó và không thể bỏ công bố lại — không cần tự validate is_published ở đây).
async function getPublishedPair(internshipId) {
  const [rows] = await pool.execute(
    `SELECT * FROM evaluations WHERE internship_id = ? AND evaluator_role IN ('lecturer', 'company') AND is_published = 1`,
    [internshipId],
  )
  return {
    lecturer: rows.find((row) => row.evaluator_role === 'lecturer') ?? null,
    company: rows.find((row) => row.evaluator_role === 'company') ?? null,
  }
}

module.exports = {
  getAll,
  getById,
  getByIdForUser,
  create,
  update,
  remove,
  classify,
  computeFinalResult,
  computeFinalResultsBulk,
  getPublishedPair,
}
