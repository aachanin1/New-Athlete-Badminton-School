import { chromium } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { run, env, fixtures } from './runtime.mjs'
export const fixture = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'), 'utf8'))
export async function adminBrowser(base, actor = fixture.sa) {
  const cookies = new Map(), auth = createServerClient(env.apiUrl, env.publishableKey, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: values => values.forEach(v => cookies.set(v.name, v.value)),
  } })
  assert.ifError((await auth.auth.signInWithPassword({ email: actor.email, password: fixtures.password })).error)
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Bangkok', locale: 'th-TH', extraHTTPHeaders: { Origin: base } })
  await context.addCookies([...cookies].map(([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/', sameSite: 'Lax' })))
  return { browser, context, page: await context.newPage() }
}
