// Smoke test: Mentor đăng vị trí thực tập -> Sinh viên ứng tuyển -> Mentor chấp nhận -> hồ sơ thực
// tập được tự tạo (Mục 16K README). Dùng company2@example.com ("mentorB", company_mentors.id=1,
// company_id=1) và student4@example.com ("studentD", students.id=12, KHÔNG có internship nào trong
// seed) — period "TT2025-1" (upcoming, period_id=3) chưa có internship nào trong seed, an toàn tạo
// fixture mới không đụng dữ liệu các e2e test khác (full-workflow.spec.js dùng period "ongoing" khác).
const { test, expect } = require('@playwright/test')

const MENTOR = { email: 'company2@example.com', password: 'company123' }
const STUDENT = { email: 'student4@example.com', password: 'student123' }
const POSITION_TITLE = `Intern E2E ${Date.now()}`

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

test.describe.serial('Vị trí thực tập: ứng tuyển -> chấp nhận', () => {
  test('Bước 1 — Mentor đăng vị trí thực tập mới', async ({ page }) => {
    await login(page, MENTOR)
    await page.goto('/company/positions')
    await page.getByRole('button', { name: '+ Đăng vị trí mới' }).click()
    await page.locator('#period_id').selectOption({ label: 'TT2025-1 - Đợt thực tập HK1 2025-2026' })
    await page.locator('#title').fill(POSITION_TITLE)
    await page.locator('#slots').fill('1')
    await page.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByText(POSITION_TITLE)).toBeVisible()
    await logout(page)
  })

  test('Bước 2 — Sinh viên ứng tuyển vị trí vừa đăng', async ({ page }) => {
    await login(page, STUDENT)
    await page.goto('/student/positions')
    await expect(page.getByText(POSITION_TITLE)).toBeVisible()

    const row = page.locator('tr', { hasText: POSITION_TITLE })
    await row.getByRole('button', { name: 'Ứng tuyển' }).click()
    await page.locator('#note').fill('Em ứng tuyển vị trí này qua E2E test.')
    await page.getByRole('button', { name: 'Gửi đơn ứng tuyển' }).click()

    await expect(row.getByText('Đã ứng tuyển')).toBeVisible()
    await expect(page.locator('tr', { hasText: 'Đang chờ' })).toBeVisible()
    await logout(page)
  })

  test('Bước 3 — Mentor chấp nhận đơn -> hồ sơ thực tập được tự tạo', async ({ page }) => {
    await login(page, MENTOR)
    await page.goto('/company/positions')
    const row = page.locator('tr', { hasText: POSITION_TITLE })
    await row.getByRole('button', { name: 'Xem đơn ứng tuyển' }).click()
    await page.getByRole('button', { name: 'Chấp nhận' }).click()
    await expect(page.getByText('Đã nhận')).toBeVisible()
    await page.locator('.modal-footer').getByRole('button', { name: 'Đóng' }).click()

    // slots=1, 1 accepted -> vị trí tự đóng.
    await expect(row.getByText('1/1')).toBeVisible()
    await expect(row.getByText('Đã đóng')).toBeVisible()
  })
})
