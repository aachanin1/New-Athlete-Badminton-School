import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { lessonSourceEnvironment, verifyLessonSourceTarget } from './scripts/verify-lesson-source-test-target.mjs'
const run=verifyLessonSourceTarget(),env=lessonSourceEnvironment()
const output=process.env.ASSIGNMENT8_OUTPUT
if (!output || !resolve(output).startsWith(resolve(run.outputDir)+'\\')) throw new Error('Unique assignment8 output required')
const app=process.env.ASSIGNMENT8_BUILD_DIR
export default defineConfig({ testDir:'./tests/assignment8', fullyParallel:false, workers:1, retries:0, timeout:120_000,
  reporter:[['list'],['json',{outputFile:resolve(output,'report.json')}]],outputDir:resolve(output,'artifacts'),
  use:{baseURL:'http://127.0.0.1:3161',channel:'chrome',headless:true,locale:'th-TH',timezoneId:'Asia/Bangkok',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:`node "${resolve('node_modules/next/dist/bin/next')}" ${app?'start "'+resolve(app)+'"':'dev --webpack'} --hostname 127.0.0.1 --port 3161`,url:'http://127.0.0.1:3161',reuseExistingServer:false,timeout:180_000,
    env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:env.apiUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:env.publishableKey,NEXT_PUBLIC_SUPABASE_ANON_KEY:env.publishableKey,SUPABASE_SERVICE_ROLE_KEY:env.serviceRoleKey,
      SLIPOK_TEST_MODE:'true',PROGRESSIVE_BOOKING_ENTRY_ENABLED:'true',PROGRESSIVE_PRICING_WRITES_ENABLED:'true',PROGRESSIVE_COUPON_LIFECYCLE_ENABLED:'true',PROGRESSIVE_PAYMENT_BATCH_ENABLED:'true',PROGRESSIVE_PAYMENT_ENTRY_ENABLED:'true',PROGRESSIVE_PAYMENT_REVIEW_ENABLED:'true'}}})
