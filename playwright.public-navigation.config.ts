import { defineConfig, devices } from '@playwright/test'
import { isAbsolute, relative, resolve } from 'node:path'

const baseURL = process.env.PUBLIC_NAV_BASE_URL
const output = process.env.PUBLIC_NAV_OUTPUT
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') {
  throw new Error('Public navigation tests require an explicit isolated loopback app')
}
if (!output) throw new Error('Public navigation tests require a unique output directory')
const outputPath = relative(resolve('.playwright/public-nav-1'), resolve(output))
if (!outputPath || outputPath.startsWith('..') || isAbsolute(outputPath)) {
  throw new Error('Public navigation output must be inside .playwright/public-nav-1')
}

export default defineConfig({
  testDir: './tests/public-navigation',
  workers: 2,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: resolve(output, 'report.json') }]],
  outputDir: resolve(output, 'artifacts'),
  use: {
    baseURL,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }, testIgnore: '**/desktop.spec.ts' },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] }, testIgnore: '**/desktop.spec.ts' },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] }, testMatch: '**/desktop.spec.ts' },
  ],
})
