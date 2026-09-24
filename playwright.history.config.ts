import { defineConfig } from '@playwright/test'
import { verifyDisposableIdentity } from './tests/task10-regression/local-supabase'

const local = verifyDisposableIdentity()

export default defineConfig({
  testDir: './tests/history-payment-regression',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/history-payment-regression',
  globalSetup: './tests/history-payment-regression/global-setup.ts',
  globalTeardown: './tests/history-payment-regression/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chrome',
    headless: true,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // An explicitly supplied disposable runner may bind HTTP local Storage
    // images without changing the repository's HTTPS deployment configuration.
    command: process.env.TASK10_HISTORY_WEB_COMMAND || 'npm.cmd run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
      PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
      PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true',
      SLIPOK_TEST_MODE: 'true',
    },
  },
})
