import { defineConfig, devices } from '@playwright/test';

const runE2E = process.env.RUN_E2E !== '0';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: runE2E
    ? [
        {
          command: 'pnpm --filter weepark-backend dev',
          url: 'http://localhost:4000/health',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter weepark-frontend dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ]
    : undefined,
});
