const path = require('path')
const { defineConfig, devices } = require('@playwright/test')

// Smoke test giao diện (yêu cầu: "chạy với backend + frontend thật trên DB test"). globalSetup tự
// chạy server/db/testSetup.js trước mỗi lần `test:e2e` — luôn bắt đầu từ DB test SẠCH, đúng seed, để
// test không phụ thuộc trạng thái để lại từ lần chạy trước.
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: require.resolve('./e2e/global-setup.js'),
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node server.js',
      cwd: path.join(__dirname, 'server'),
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { ...process.env, NODE_ENV: 'test' },
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: path.join(__dirname, 'client'),
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
