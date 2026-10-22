// Smoke test đăng nhập cho cả 4 role — độc lập với kịch bản luồng chính (full-workflow.spec.js),
// chạy trên DB test sạch (xem global-setup.js). Tài khoản demo lấy đúng từ LoginPage.jsx (hiển thị
// công khai trên UI) / server/tests/helpers/auth.js.
const { test, expect } = require('@playwright/test')

const ACCOUNTS = [
  { email: 'admin@example.com', password: 'admin123', homePath: '/admin/dashboard' },
  { email: 'student@example.com', password: 'student123', homePath: '/student/dashboard' },
  { email: 'lecturer@example.com', password: 'lecturer123', homePath: '/lecturer/dashboard' },
  { email: 'company@example.com', password: 'company123', homePath: '/company/dashboard' },
]

async function login(page, email, password) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
}

for (const account of ACCOUNTS) {
  test(`Đăng nhập thành công: ${account.email} -> điều hướng đúng dashboard`, async ({ page }) => {
    await login(page, account.email, account.password)
    await expect(page).toHaveURL(new RegExp(account.homePath.replace('/', '\\/')))
  })
}

test('Đăng nhập sai mật khẩu -> hiển thị lỗi, không điều hướng', async ({ page }) => {
  await login(page, 'admin@example.com', 'sai-mat-khau')
  await expect(page.locator('.login-error')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
