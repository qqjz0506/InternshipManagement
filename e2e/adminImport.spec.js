// Smoke test: Admin nhập danh sách Sinh viên từ Excel (xem docs/REQUIREMENT_TRACEABILITY_MATRIX.md
// REQ-081). Dùng đúng file demo đã có 3 dòng hợp lệ ở docs/demo-files/students-import-demo.xlsx
// (server/scripts/generateImportDemoFiles.js) — không cần tự điền file mẫu trong lúc test.
const path = require('path')
const { test, expect } = require('@playwright/test')

const ADMIN = { email: 'admin@example.com', password: 'admin123' }
const DEMO_FILE = path.join(__dirname, '..', 'docs', 'demo-files', 'students-import-demo.xlsx')

test('Admin nhập 3 sinh viên từ file mẫu Excel', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN.email)
  await page.locator('#password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/admin/students')
  await page.getByRole('button', { name: 'Nhập từ Excel' }).click()

  await page.locator('input[type="file"]').setInputFiles(DEMO_FILE)
  await page.getByRole('button', { name: 'Xem trước' }).click()

  await expect(page.getByText(/Tổng 3 dòng — hợp lệ 3, lỗi 0\./)).toBeVisible()
  await expect(page.locator('.import-row-error')).toHaveCount(0)

  await page.getByRole('button', { name: 'Xác nhận nhập' }).click()
  await expect(page.getByText('Đã nhập thành công 3 dòng.')).toBeVisible()

  await page.locator('.modal-footer').getByRole('button', { name: 'Đóng' }).click()
  await page.locator('.search-input').fill('99990002')
  await expect(page.locator('tr', { hasText: 'Lương Thị Quỳnh' })).toBeVisible()
})
