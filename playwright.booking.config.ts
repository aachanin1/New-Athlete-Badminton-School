import { defineConfig } from '@playwright/test'
import { getLocalSupabaseEnv } from './tests/booking-regression/local-supabase'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { verifyDisposableIdentity } from './tests/task10-regression/local-supabase'

const local = getLocalSupabaseEnv()
const productionDir = process.env.TASK10_PRODUCTION_BUILD_DIR
if (productionDir) {
  const verified = verifyDisposableIdentity()
  const buildId = resolve(productionDir, '.next/BUILD_ID')
  if (!existsSync(buildId)) throw new Error('Booking production tests require a completed build')
  const binding = JSON.parse(readFileSync(resolve(productionDir, '.next/task10-disposable-build.json'), 'utf8'))
  if (verified.apiUrl !== local.apiUrl || binding.api !== local.apiUrl || binding.buildId !== readFileSync(buildId, 'utf8').trim()) {
    throw new Error('Booking production build and verified disposable binding differ')
  }
}

export default defineConfig({
  testDir: './tests/booking-regression',
  testMatch: 'booking.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/booking-regression',
  globalSetup: './tests/booking-regression/global-setup.ts',
  globalTeardown: './tests/booking-regression/global-teardown.ts',
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
    command: productionDir
      ? `node "${resolve('node_modules/next/dist/bin/next')}" start "${productionDir}" --hostname 127.0.0.1 --port 3000`
      : 'npm.cmd run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      ...(productionDir ? { NODE_ENV: 'production' } : {}),
      TZ: 'UTC',
      NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
      PROGRESSIVE_BOOKING_ENTRY_ENABLED: 'true',
      PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
      PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true',
      SLIPOK_TEST_MODE: 'true',
    },
  },
})
