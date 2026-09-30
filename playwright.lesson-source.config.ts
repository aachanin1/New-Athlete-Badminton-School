import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lessonSourceEnvironment, verifyLessonSourceTarget } from './scripts/verify-lesson-source-test-target.mjs'

const run = verifyLessonSourceTarget()
const local = lessonSourceEnvironment()
const buildDir = process.env.LESSON_SOURCE_BUILD_DIR
const runOutput = process.env.LESSON_SOURCE_OUTPUT_DIR
if (!runOutput || resolve(runOutput).indexOf(resolve(run.outputDir) + '\\') !== 0) throw new Error('Unique run output must be inside approved evidence directory')
const report = resolve(runOutput, 'report.json')
if (existsSync(report)) throw new Error('Refusing to overwrite prior acceptance report')
if (buildDir) {
  const binding = JSON.parse(readFileSync(resolve(buildDir, '.next/lesson-source-build.json'), 'utf8'))
  if (binding.api !== local.apiUrl || binding.buildId !== readFileSync(resolve(buildDir, '.next/BUILD_ID'), 'utf8').trim()) throw new Error('Build does not belong to verified disposable')
}
const port = process.env.LESSON_SOURCE_UI_PORT || '3131'
if (!['3131', '3132'].includes(port)) throw new Error('Unexpected isolated UI port')
export default defineConfig({
  testDir: './tests',
  testMatch: ['task10-regression/task10-transactions.spec.ts', 'lesson-source-admission/lesson-source-acceptance.spec.ts'],
  // Task10's focused fixture resets its own disposable in beforeAll. Run it
  // before acceptance so final unused Owner UAT rights cannot be reset later.
  ...(process.env.LESSON_SOURCE_FINAL_RUN ? { projects: [
    { name: 'source-and-protected', testMatch: 'task10-regression/task10-transactions.spec.ts', grep: /Lesson source attendance admission|Family Wallet lock correction|Task10 family source transactions|Isolated Kids Wallet sibling|Concurrent Wallet Redeem, Return and Reschedule/ },
    { name: 'acceptance-and-owner-uat', testMatch: 'lesson-source-admission/lesson-source-acceptance.spec.ts', dependencies: ['source-and-protected'] },
  ] } : {}),
  fullyParallel: false, workers: 1, retries: 0, timeout: 180_000,
  expect: { timeout: 25_000 }, reporter: [['list'], ['json', { outputFile: report }]],
  outputDir: resolve(runOutput, 'artifacts'),
  globalSetup: './tests/task10-regression/global-setup.ts',
  globalTeardown: process.env.LESSON_SOURCE_RETAIN_FIXTURE ? undefined : './tests/task10-regression/global-teardown.ts',
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chrome', headless: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: buildDir
      ? `node "${resolve('node_modules/next/dist/bin/next')}" start "${buildDir}" --hostname 127.0.0.1 --port ${port}`
      : `node "${resolve('node_modules/next/dist/bin/next')}" dev --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`, timeout: 180_000, reuseExistingServer: false,
    env: { ...process.env, TZ: 'UTC', NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey, SLIPOK_TEST_MODE: 'true',
      PROGRESSIVE_BOOKING_ENTRY_ENABLED: 'true', PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
      PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true', PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
      PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true', PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true',
      ...(buildDir ? { NODE_ENV: 'production' } : {}),
    },
  },
})
