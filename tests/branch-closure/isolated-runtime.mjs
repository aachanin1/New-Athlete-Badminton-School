import { execFileSync, spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { verifyLessonSourceTarget, lessonSourceEnvironment, lessonSourceFetch } from '../../scripts/verify-lesson-source-test-target.mjs'

export const run = verifyLessonSourceTarget(), env = lessonSourceEnvironment()
export const db = createClient(env.apiUrl, env.serviceRoleKey, { global: { fetch: lessonSourceFetch }, auth: { persistSession: false, autoRefreshToken: false } })
export const q = v => v == null ? 'NULL' : "'" + String(v).replaceAll("'", "''") + "'"
export function sql(input) {
  verifyLessonSourceTarget()
  return execFileSync('docker', ['exec', '-i', 'supabase_db_' + run.target.project, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }).trim()
}
export function concurrentSql(input) {
  verifyLessonSourceTarget()
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', 'supabase_db_' + run.target.project, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true })
    let out = '', err = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d)
    child.on('error', reject); child.on('close', c => c ? reject(Error(err)) : resolve(out.trim())); child.stdin.end(input)
  })
}

/** A real held transaction, released only after the competing wait is observed. */
export async function holdTransaction(input, name) {
  verifyLessonSourceTarget()
  const child = spawn('docker', ['exec', '-i', 'supabase_db_' + run.target.project, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true })
  let out = '', err = '', readyResolve, readyReject
  const marker = 'ready_' + name.replaceAll('-', '_')
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  const done = new Promise((resolve, reject) => {
    child.stdout.on('data', d => { out += d; if (out.includes(marker)) readyResolve() }); child.stderr.on('data', d => err += d)
    child.on('error', e => { readyReject(e); reject(e) }); child.on('close', code => { if (code) { const e = Error(err); readyReject(e); reject(e) } else resolve(out.trim()) })
  })
  void done.catch(() => {})
  child.stdin.write(`SET application_name=${q(name)};BEGIN;SET LOCAL idle_in_transaction_session_timeout='30s';${input}\nSELECT ${q(marker)};\n`)
  await ready
  return { release: () => child.stdin.end('COMMIT;\n'), done }
}

export async function observeLockWait(name) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name=${q(name)} AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0;`) !== '0') return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  throw Error('No real competing lock wait observed: ' + name)
}
