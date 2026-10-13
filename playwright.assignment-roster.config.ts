import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { lessonSourceEnvironment, verifyLessonSourceTarget } from './scripts/verify-lesson-source-test-target.mjs'

const run = verifyLessonSourceTarget()
const local = lessonSourceEnvironment()
const output = process.env.ASSIGNMENT_ROSTER_OUTPUT
if (!output || !resolve(output).startsWith(resolve(run.outputDir) + '\\')) throw new Error('Unique roster output required')
const app = process.env.ASSIGNMENT_ROSTER_BUILD_DIR
export default defineConfig({
  testDir: './tests/assignment-roster', fullyParallel: false, workers: 1, retries: 0, timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: resolve(output, 'report.json') }]], outputDir: resolve(output, 'artifacts'),
  use: { baseURL: 'http://127.0.0.1:3162', channel: 'chrome', headless: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `node "${resolve('node_modules/next/dist/bin/next')}" ${app ? 'start "' + resolve(app) + '"' : 'dev --webpack'} --hostname 127.0.0.1 --port 3162`,
    url: 'http://127.0.0.1:3162', reuseExistingServer: false, timeout: 180_000,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.apiUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey, SLIPOK_TEST_MODE: 'true' },
  },
})
