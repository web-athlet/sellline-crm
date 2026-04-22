import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: 'playwright-test-secret-at-least-16-chars',
      AUTH_JWT_SECRET: 'playwright-test-secret-at-least-16-chars',
      AUTH_JWT_ISSUER: 'sellline-web',
      AUTH_JWT_AUDIENCE: 'sellline-api',
      AUTH_JWT_EXPIRES_IN: '1h',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
    },
  },
});
