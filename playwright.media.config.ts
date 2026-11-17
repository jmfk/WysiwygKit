import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/media-browser',
  workers: 1,
  timeout: 30_000,
  // Network artifacts can contain short-lived capabilities. Never persist them.
  use: { baseURL: 'http://127.0.0.1:13700', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:13700', reuseExistingServer: !process.env.CI },
    {
      command: 'node --env-file=.local/media-test.env demos/media/server.mjs',
      url: 'http://127.0.0.1:13701/health',
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
