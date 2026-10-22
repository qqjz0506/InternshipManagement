// Smoke test giao diện — luồng nghiệp vụ chính xuyên suốt 4 role, chạy trên backend + frontend THẬT
// (không mock), trên DB test sạch (global-setup.js chạy server/db/testSetup.js trước khi vào file
// này). Dùng student4@example.com (students.id=12, KHÔNG có internship nào trong seed — xem
// server/tests/helpers/auth.js) làm nhân vật chính xuyên suốt, tự đăng ký từ đầu.
//
// Đây là smoke test (đi qua được luồng, không lỗi 500/crash UI) — KHÔNG thay thế automated test suite
// server/tests/*.test.js (đã test chi tiết từng business rule). Dùng test.describe.serial(): các bước
// phụ thuộc lẫn nhau (phải đăng ký xong mới phân công được, phân công xong mới log/report được...).
const { test, expect } = require('@playwright/test')

const ADMIN = { email: 'admin@example.com', password: 'admin123' }
const STUDENT = { email: 'student4@example.com', password: 'student123' } // studentD, chưa có internship
// lecturer2@example.com (lecturers.id=3) — ĐÚNG giảng viên sẽ được chọn ở Bước 2 (department_id=2,
// khớp studentD; AssignLecturerModal lọc theo khoa, option đầu tiên sau placeholder = lecturer id=3,
// đã verify trực tiếp qua DB trước khi viết test này — không đoán).
const LECTURER = { email: 'lecturer2@example.com', password: 'lecturer123' }
const MENTOR = { email: 'company@example.com', password: 'company123' } // company_mentors.id=7, company_id=4 (DN004)
const STUDENT_CODE = '21110012'
const STUDENT_NAME = 'Trịnh Thảo My'
// company_mentors.id=7 (mentor của "company@example.com") thuộc company_id=4 — PHẢI chọn đúng công ty
// này ở Bước 2, nếu không mentor được phân công sẽ KHÔNG phải tài khoản dùng để đăng nhập ở Bước 6.
const TARGET_COMPANY_LABEL = 'DN004 - Công ty Cổ phần Giải pháp Phần mềm XYZ'

// Nhiều trang danh sách phía Lecturer/Mentor (logs/reports/evaluations) đã có SẴN dữ liệu seed của
// SINH VIÊN KHÁC do cùng giảng viên/mentor phụ trách — không được dùng .first() cho các nút hành
// động trùng tên ("Nhận xét"/"Đánh giá"/"Xem / Sửa"), PHẢI scope theo tên sinh viên qua dòng <tr>.
function studentRow(page) {
  return page.locator('tr', { hasText: STUDENT_NAME })
}

async function login(page, { email, password }) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function logout(page) {
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/login/)
}

test.describe.serial('Luồng nghiệp vụ chính: đăng ký -> phân công -> log/report -> đánh giá -> hoàn thành', () => {
  test('Bước 1 — Sinh viên đăng ký thực tập', async ({ page }) => {
    await login(page, STUDENT)
    await page.goto('/student/internship')
    await page.getByRole('button', { name: 'Đăng ký thực tập' }).click()
    // index 0 = "-- Chọn đợt thực tập --", index 1 = đợt đầu tiên KHÔNG closed (ongoing/upcoming).
    await page.locator('#period_id').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Đăng ký', exact: true }).click()
    // Đăng ký xong -> trang tự chuyển sang hiển thị trạng thái hồ sơ (không còn nút "Đăng ký thực tập").
    await expect(page.getByRole('button', { name: 'Đăng ký thực tập' })).toHaveCount(0)
    await logout(page)
  })

  test('Bước 2 — Admin phân công doanh nghiệp + giảng viên, chuyển in_progress', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/admin/internships')
    await page.locator('.search-input').fill(STUDENT_CODE)
    const row = page.locator('tr', { hasText: STUDENT_CODE })
    await expect(row).toBeVisible()
    await row.getByRole('link', { name: 'Xem chi tiết' }).click()
    await expect(page).toHaveURL(/\/admin\/internships\/\d+/)

    // Phân công doanh nghiệp + người hướng dẫn — PHẢI chọn đúng DN004 (mentor id=7, email
    // company@example.com) để Bước 6 đăng nhập đúng tài khoản mentor đã được phân công.
    await page.locator('.detail-card', { hasText: 'Doanh nghiệp & người hướng dẫn' }).getByRole('button', { name: 'Phân công' }).click()
    await page.locator('#company_id').selectOption({ label: TARGET_COMPANY_LABEL })
    await page.locator('#mentor_id').selectOption({ index: 1 }) // DN004 chỉ có đúng 1 mentor trong seed
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('#company_id')).toHaveCount(0) // modal đã đóng

    // Phân công giảng viên hướng dẫn.
    await page.locator('.detail-card', { hasText: 'Giảng viên hướng dẫn' }).getByRole('button', { name: 'Phân công' }).click()
    await page.locator('#lecturer_id').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('#lecturer_id')).toHaveCount(0)

    // Chuyển trạng thái: pending -> approved -> in_progress (đủ company+mentor+lecturer mới qua được).
    await page.locator('select').filter({ hasText: '-- Đổi trạng thái --' }).selectOption({ label: 'Đã duyệt' })
    await page.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(page.getByText('Đã duyệt', { exact: true })).toBeVisible()

    await page.locator('select').filter({ hasText: '-- Đổi trạng thái --' }).selectOption({ label: 'Đang thực tập' })
    await page.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(page.getByText('Đang thực tập', { exact: true })).toBeVisible()

    await logout(page)
  })

  test('Bước 3 — Sinh viên ghi nhật ký thực tập', async ({ page }) => {
    await login(page, STUDENT)
    await page.goto('/student/logs')
    await page.getByRole('button', { name: '+ Thêm nhật ký' }).click()
    const today = new Date().toISOString().slice(0, 10)
    await page.locator('#log_date').fill(today)
    await page.locator('#title').fill('Tuần 1 — Nhật ký test E2E')
    await page.locator('#content').fill('Nội dung công việc test E2E: làm quen môi trường dự án.')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.getByText('Tuần 1 — Nhật ký test E2E')).toBeVisible()
    await logout(page)
  })

  test('Bước 4 — Sinh viên nộp báo cáo tổng kết (.pdf)', async ({ page }) => {
    await login(page, STUDENT)
    await page.goto('/student/reports')
    await page.getByRole('button', { name: '+ Nộp báo cáo' }).click()
    // Tên file có dấu tiếng Việt — verify luôn multer decode đúng UTF-8 (không mojibake, xem
    // server/config/upload.js defParamCharset + tests/reportUpload.test.js) qua đúng đường upload
    // thật của UI, không chỉ qua test API thuần.
    await page.locator('#report_type').selectOption('final')
    await page.locator('#file').setInputFiles('docs/demo-files/Báo cáo thực tập tuần 1.pdf')
    await page.getByRole('button', { name: 'Nộp báo cáo', exact: true }).click()
    await expect(page.getByText('Báo cáo thực tập tuần 1.pdf')).toBeVisible()
    await logout(page)
  })

  test('Bước 5 — Giảng viên nhận xét nhật ký, duyệt báo cáo, chấm và công bố điểm', async ({ page }) => {
    await login(page, LECTURER)

    // lecturer2@example.com đã phụ trách SẴN sinh viên khác trong seed (internships.lecturer_id=3) —
    // luôn scope theo tên studentD (STUDENT_NAME), không dùng .first().
    await page.goto('/lecturer/logs')
    await studentRow(page).getByRole('button', { name: 'Nhận xét' }).click()
    await page.locator('#lecturer_comment').fill('Tốt, tiếp tục phát huy (nhận xét test E2E).')
    await page.getByRole('button', { name: 'Lưu nhận xét' }).click()
    await expect(page.locator('#lecturer_comment')).toHaveCount(0)

    await page.goto('/lecturer/reports')
    await studentRow(page).getByRole('button', { name: 'Nhận xét' }).click()
    await page.locator('#status').selectOption('approved')
    await page.locator('#reviewer_comment').fill('Đạt yêu cầu (duyệt test E2E).')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('#status')).toHaveCount(0)

    await page.goto('/lecturer/evaluations')
    await studentRow(page).getByRole('button', { name: 'Đánh giá', exact: true }).click()
    await page.locator('#attitude_score').fill('9')
    await page.locator('#skill_score').fill('8')
    await page.locator('#progress_score').fill('9')
    await page.locator('#discipline_score').fill('8')
    await page.locator('#comment').fill('Hoàn thành tốt đợt thực tập (test E2E).')
    await page.getByRole('button', { name: 'Lưu nháp' }).click()

    await page.goto('/lecturer/evaluations')
    await studentRow(page).getByRole('button', { name: 'Xem / Sửa' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Công bố' }).click()

    await logout(page)
  })

  test('Bước 6 — Người hướng dẫn doanh nghiệp chấm và công bố điểm', async ({ page }) => {
    await login(page, MENTOR)

    // company@example.com (mentor_id=7) cũng đã phụ trách SẴN sinh viên khác trong seed — scope theo
    // tên studentD, không dùng .first().
    await page.goto('/company/evaluations')
    await studentRow(page).getByRole('button', { name: 'Đánh giá', exact: true }).click()
    await page.locator('#attitude_score').fill('8')
    await page.locator('#skill_score').fill('8')
    await page.locator('#progress_score').fill('8')
    await page.locator('#discipline_score').fill('8')
    await page.locator('#comment').fill('Làm việc chuyên nghiệp (test E2E).')
    await page.getByRole('button', { name: 'Lưu nháp' }).click()

    await page.goto('/company/evaluations')
    await studentRow(page).getByRole('button', { name: 'Xem / Sửa' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Công bố' }).click()

    await logout(page)
  })

  test('Bước 7 — Admin chuyển completed, xem điểm tổng kết, xuất Excel, khóa/mở tài khoản', async ({ page }) => {
    await login(page, ADMIN)

    await page.goto('/admin/internships')
    await page.locator('.search-input').fill(STUDENT_CODE)
    const row = page.locator('tr', { hasText: STUDENT_CODE })
    await row.getByRole('link', { name: 'Xem chi tiết' }).click()

    await page.locator('select').filter({ hasText: '-- Đổi trạng thái --' }).selectOption({ label: 'Hoàn thành' })
    page.once('dialog', (dialog) => dialog.accept()) // confirm "đặt tiến độ về 100%"
    await page.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(page.getByText('Hoàn thành', { exact: true })).toBeVisible()

    // Điểm tổng kết thực tập phải xuất hiện NGAY (cả 2 đánh giá đã công bố ở Bước 5/6).
    await expect(page.getByText('Kết quả tổng kết')).toBeVisible()
    await expect(page.getByText('Xếp loại')).toBeVisible()

    // Xuất Excel — verify sự kiện download thật xảy ra (không chỉ click, không lỗi).
    await page.goto('/admin/statistics')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Xuất thông tin thực tập/ }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)

    // Khóa / mở tài khoản — dùng 1 tài khoản KHÁC (student2@example.com), không đụng luồng chính.
    await page.goto('/admin/accounts')
    await page.locator('.search-input').fill('student2@example.com')
    const accountRow = page.locator('tr', { hasText: 'student2@example.com' })
    await expect(accountRow).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await accountRow.getByRole('button', { name: 'Khóa' }).click()
    await expect(accountRow.getByText('Đã khóa')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await accountRow.getByRole('button', { name: 'Mở khóa' }).click()
    await expect(accountRow.getByText('Hoạt động')).toBeVisible()

    await logout(page)
  })

  test('Bước 8 — Badge thông báo của sinh viên tăng sau các sự kiện nghiệp vụ ở trên', async ({ page }) => {
    await login(page, STUDENT)
    // studentD không có thông báo nào lúc đầu (seed) — sau đăng ký/phân công/nhận xét/công bố điểm ở
    // các bước trên, badge phải > 0.
    const badge = page.locator('.topbar-notifications-badge')
    await expect(badge).toBeVisible()
    const count = Number(await badge.textContent())
    expect(count).toBeGreaterThan(0)
    await logout(page)
  })
})
