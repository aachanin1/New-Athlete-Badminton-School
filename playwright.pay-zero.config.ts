import { defineConfig } from '@playwright/test'
import { verifyDisposableIdentity } from './tests/task10-regression/local-supabase'

// No fallback to the shared historical disposable is permitted for this suite.
if (!process.env.TASK10_DISPOSABLE_TARGET) throw new Error('PAY-ZERO requires an explicitly owned disposable')
const local = verifyDisposableIdentity()
const ui = process.env.PAY_ZERO_UI === 'true'
export default defineConfig({
  testDir: './tests/pay-zero-regression', fullyParallel: false, workers: 1,
  retries: 0, timeout: 120_000, reporter: [['list']],
  outputDir: process.env.PAY_ZERO_OUTPUT_DIR || 'test-results/pay-zero-1',
  use: { baseURL: 'http://127.0.0.1:31401', channel: 'chrome', headless: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  ...(ui ? { webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 31401',
    url: 'http://127.0.0.1:31401', timeout: 120_000, reuseExistingServer: false,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey, PROGRESSIVE_BOOKING_ENTRY_ENABLED: 'true',
      PROGRESSIVE_PRICING_WRITES_ENABLED: 'true', PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true', PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true', SLIPOK_TEST_MODE: 'true' },
  } } : {}),
})
