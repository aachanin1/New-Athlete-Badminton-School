import { defineConfig } from '@playwright/test'
import { resolve, relative, isAbsolute } from 'node:path'
import { readFileSync } from 'node:fs'
import { lessonSourceEnvironment, verifyLessonSourceTarget } from './scripts/verify-lesson-source-test-target.mjs'
const run = verifyLessonSourceTarget(), local = lessonSourceEnvironment()
const output = process.env.ASSIGNMENT5_OUTPUT
const rel = output ? relative(run.outputDir, resolve(output)) : '..'
if (!output || !rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unique assignment5 output required')
const app = process.env.ASSIGNMENT5_BUILD_DIR
if (!app) throw new Error('Explicit isolated production build required')
const build = JSON.parse(readFileSync(resolve(app, '.next/assignment5-build.json'), 'utf8'))
if (build.api !== local.apiUrl) throw new Error('Build is bound to a different database')
export default defineConfig({
  testDir: './tests/assignment5', testMatch: '**/*.spec.ts', workers: 1, retries: 0, timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: resolve(output, 'report.json') }]], outputDir: resolve(output, 'artifacts'),
  use: { baseURL: 'http://127.0.0.1:3163', channel: 'chrome', headless: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `node "${resolve('node_modules/next/dist/bin/next')}" start "${resolve(app)}" --hostname 127.0.0.1 --port 3163`,
    url: 'http://127.0.0.1:3163', reuseExistingServer: false, timeout: 120_000,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: local.apiUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey, SLIPOK_TEST_MODE: 'true' },
  },
})
