import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { createLocalAdmin, getLocalSupabaseEnv, resetLocalDatabase, seedBookingFixture, waitForLocalSupabaseAuth, type BookingFixture } from '../booking-regression/local-supabase'

export const ROOT = resolve(__dirname, '../..')
// An explicit local target allows an isolated suite to preserve an existing UAT
// disposable. The caller must bind the CLI to this same target; verification
// below checks the actual API, container, volume and all service DB bindings.
const disposableTarget = process.env.TASK10_DISPOSABLE_TARGET
  ? JSON.parse(readFileSync(process.env.TASK10_DISPOSABLE_TARGET, 'utf8')) as { project: string; workdir: string; api: string }
  : { project: 'New-Athlete-Badminton-School', workdir: ROOT, api: 'http://127.0.0.1:54321' }
if (!/^[A-Za-z0-9_-]+$/.test(disposableTarget.project)
  || new URL(disposableTarget.api).hostname !== '127.0.0.1'
  || new URL(disposableTarget.api).protocol !== 'http:') throw new Error('Task10 refuses non-local disposable target')
export const DB_CONTAINER = `supabase_db_${disposableTarget.project}`
export const FIXTURE_PATH = resolve(ROOT, '.playwright/task10-fixture.json')
export const TASK10_PASSWORD = 'LocalTask10!2026'
export const TASK10_ADMIN_EMAIL = 'task10-makeup-admin@example.com'
export const TASK10_DENIED_EMAIL = 'task10-denied-admin@example.com'
export interface FamilyFixture { parentId: string; children: string[]; bookings: string[]; sources: string[]; credits: string[]; cutoffSources: string[] }
export interface Task10Fixture extends BookingFixture {
  makeupAdminId: string; deniedAdminId: string; family?: FamilyFixture
  lifecycle?: Record<string, string>
  storageUploads?: Array<{ bucket: string; path: string }>
}

export function verifyDisposableIdentity() {
  const local = getLocalSupabaseEnv()
  if (new URL(local.apiUrl).origin !== disposableTarget.api) throw new Error('Task10 refuses unexpected API origin')
  const inspect = (name: string) => JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
  const db = inspect(DB_CONTAINER)
  if (resolve(db.Config.Labels['com.supabase.cli.workdir']) !== resolve(disposableTarget.workdir)
    || db.Config.Labels['com.supabase.cli.project'] !== disposableTarget.project
    || !db.State.Running
    || !db.Mounts.some((m: { Name: string; Destination: string }) => m.Name === DB_CONTAINER && m.Destination === '/var/lib/postgresql/data')) {
    throw new Error('Task10 refuses unverified DB/container/workdir')
  }
  // Retained API services have their historical temp workdir label. Verify their
  // actual DB target and network, rather than changing/recreating infrastructure.
  for (const [suffix, key] of [['rest','PGRST_DB_URI'],['auth','GOTRUE_DB_DATABASE_URL'],['storage','DATABASE_URL']]) {
    const service = inspect(`supabase_${suffix}_${disposableTarget.project}`)
    const raw = (service.Config.Env as string[]).find((v) => v.startsWith(`${key}=`))?.slice(key.length + 1)
    if (!raw) throw new Error('Task10 service DB binding missing')
    const url = new URL(raw)
    if (url.hostname !== DB_CONTAINER || url.port !== '5432' || url.pathname !== '/postgres'
      || !service.NetworkSettings.Networks[`supabase_network_${disposableTarget.project}`]
        && !(disposableTarget.project === 'New-Athlete-Badminton-School'
          && service.NetworkSettings.Networks.supabase_network_NewAthleteBadmintonSchool)) {
      throw new Error('Task10 refuses service with unexpected DB binding')
    }
  }
  return local
}

export function localSql(sql: string) {
  verifyDisposableIdentity()
  return execFileSync('docker', ['exec','-i',DB_CONTAINER,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
}

export function concurrentLocalSql(sql: string): Promise<string> {
  verifyDisposableIdentity()
  return new Promise((resolvePromise, reject) => {
    const child = spawn('docker', ['exec','-i',DB_CONTAINER,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'])
    let output = ''; let error = ''
    child.stdout.on('data', (data) => { output += data })
    child.stderr.on('data', (data) => { error += data })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolvePromise(output.trim()) : reject(new Error(error)))
    child.stdin.end(sql)
  })
}

// Keep the transaction open until the competing RPC is observably waiting.
// A clock-based sleep can expire while Windows/Docker identity checks run.
export async function holdLocalTransaction(sql: string, applicationName: string) {
  verifyDisposableIdentity()
  const marker = `task10_ready_${randomUUID()}`
  const child = spawn('docker', ['exec','-i',DB_CONTAINER,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'])
  let output = ''; let error = ''; let released = false
  let readyResolve!: () => void; let readyReject!: (reason: Error) => void
  const ready = new Promise<void>((resolveReady, rejectReady) => { readyResolve=resolveReady; readyReject=rejectReady })
  const completion = new Promise<string>((resolveDone, rejectDone) => {
    child.stdout.on('data', data => { output += data; if(output.includes(marker)) readyResolve() })
    child.stderr.on('data', data => { error += data })
    child.on('error', problem => { readyReject(problem); rejectDone(problem) })
    child.on('close', code => {
      if(code===0) resolveDone(output.trim())
      else { const problem=new Error(error || `Held SQL exited ${code}`); readyReject(problem); rejectDone(problem) }
    })
  })
  // Observe an early rejection even while the test awaits the readiness marker.
  void completion.catch(() => {})
  child.stdin.write(`SET application_name=${sqlLiteral(applicationName)}; BEGIN; SET LOCAL idle_in_transaction_session_timeout='90s'; ${sql} SELECT ${sqlLiteral(marker)};\n`)
  await ready
  return { finish: (commit = true) => {
    if(!released) { released=true; child.stdin.end(commit ? 'COMMIT;\n' : 'ROLLBACK;\n') }
    return completion
  } }
}

export function sqlLiteral(value: string) { return `'${value.replace(/'/g, "''")}'` }
export function readTask10Fixture(): Task10Fixture { return JSON.parse(readFileSync(FIXTURE_PATH,'utf8')) }
export function trackTask10Storage(bucket: string, path: string) {
  verifyDisposableIdentity()
  const fixture=readTask10Fixture()
  writeFileSync(FIXTURE_PATH,JSON.stringify({...fixture,storageUploads:[...(fixture.storageUploads||[]),{bucket,path}]},null,2))
}
export function task10MigrationHashes() {
  return ['20260909000100_task10_policy_evidence_foundation.sql','20260909000200_task10_booking_pricing_policy_transactions.sql',
    '20260909000300_task10_kids_family_makeup_transactions.sql','20260909000400_task10_atomic_booking_payment_expiry.sql',
    '20260909000500_task10_activation_and_inactive_scheduler.sql'].map((name) => createHash('sha256').update(readFileSync(resolve(ROOT,'supabase/migrations',name))).digest('hex'))
}

export async function uploadTask10Slip(userId: string, batchId?: string) {
  verifyDisposableIdentity()
  const client = createLocalAdmin()
  const bucket = batchId ? 'progressive-payment-slips' : 'payment-slips'
  const found = await client.storage.getBucket(bucket)
  if (found.error) {
    const created = await client.storage.createBucket(bucket, { public: !batchId })
    if (created.error) throw created.error
  }
  const bytes = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=', 'base64'), Buffer.from(randomUUID())])
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const path = batchId ? `${userId}/batches/${batchId}/${sha256}.png` : `${userId}/task10-${randomUUID()}.png`
  const fixture = readTask10Fixture()
  writeFileSync(FIXTURE_PATH, JSON.stringify({ ...fixture, storageUploads: [...(fixture.storageUploads || []), { bucket, path }] }, null, 2))
  const result = await client.storage.from(bucket).upload(path, bytes, { contentType: 'image/png' })
  if (result.error) throw result.error
  return { storagePath: path, publicUrl: client.storage.from(bucket).getPublicUrl(path).data.publicUrl, sha256 }
}

function seedLifecycleFixtures() {
  const f = readTask10Fixture(); const child = randomUUID(); const q = sqlLiteral
  const cases = ['kidsDue','adultDue','privateDue','onTime','storageOnly','late','verified','oldOverdue','earlierExpiry','sendBack','kidsStatusProof']
  const ids = Object.fromEntries(cases.map((name) => [name, randomUUID()]))
  const sql = [`BEGIN; INSERT INTO public.children(id,parent_id,full_name,date_of_birth) VALUES('${child}','${f.otherUserId}','Task10 Lifecycle Child','2015-01-01');`]
  for (const name of cases) {
    const kids = name==='kidsDue' || name==='kidsStatusProof'
    const course = kids ? f.kidsCourseId : name==='privateDue' ? f.privateCourseId : f.adultCourseId
    const date = name==='oldOverdue' ? '2031-07-15' : '2031-08-02'
    const startHour = 8 + cases.indexOf(name)
    const start = `${String(startHour).padStart(2,'0')}:00`; const end = `${String(startHour+1).padStart(2,'0')}:00`
    sql.push(`INSERT INTO public.bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,year,month,total_sessions,total_price,status,created_at,expires_at)
      VALUES('${ids[name]}','${f.otherUserId}',${q(kids?'child':'self')},${kids?q(child):'NULL'},'${f.branchId}','${course}',2031,${name==='oldOverdue'?7:8},1,500,${q(name==='verified'?'verified':'pending_payment')},'2031-07-01T00:00:00Z',${name==='earlierExpiry'?"'2031-08-01T12:00:00+07:00'":'NULL'});`)
    sql.push(`INSERT INTO public.schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${course}',extract(dow FROM '${date}'::date),'${start}','${end}',true
      WHERE NOT EXISTS(SELECT 1 FROM public.schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${course}' AND day_of_week=extract(dow FROM '${date}'::date) AND start_time='${start}' AND end_time='${end}' AND is_active);`)
    sql.push(`INSERT INTO public.schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT id,branch_id,course_type_id,'${date}',start_time,end_time,6,0,'open' FROM public.schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${course}' AND day_of_week=extract(dow FROM '${date}'::date) AND start_time='${start}' AND end_time='${end}' AND is_active ON CONFLICT(branch_id,course_type_id,date,start_time) DO NOTHING;`)
    sql.push(`INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT '${ids[name]}',id,date,start_time,end_time,branch_id,${kids?q(child):'NULL'},'scheduled',false FROM public.schedule_slots WHERE branch_id='${f.branchId}' AND course_type_id='${course}' AND date='${date}' AND start_time='${start}';`)
  }
  sql.push('COMMIT;'); localSql(sql.join('\n'))
  writeFileSync(FIXTURE_PATH, JSON.stringify({ ...f, lifecycle: ids }, null, 2))
}

// A private disposable-only function replacement; no request/GUC clock override
// is shipped in any migration or callable from Production APIs.
export function setDisposableClock(instant: string) {
  if (!Number.isFinite(Date.parse(instant)) || !/(Z|[+-]\d{2}:\d{2})$/.test(instant)) throw new Error('Invalid test clock')
  localSql(`BEGIN;
    CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $clock$ SELECT ${sqlLiteral(instant)}::timestamptz $clock$;
    CREATE OR REPLACE FUNCTION public.task10_transaction_start_v1() RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog AS $clock$ SELECT ${sqlLiteral(instant)}::timestamptz $clock$;
    COMMIT;`)
}

export async function seedTask10Family(): Promise<FamilyFixture> {
  const fixture=readTask10Fixture(); const client=createLocalAdmin()
  const created=await client.auth.admin.createUser({email:`task10-family-${randomUUID()}@example.com`,password:TASK10_PASSWORD,email_confirm:true})
  if (created.error || !created.data.user) throw new Error(created.error?.message || 'Family parent missing')
  const family:FamilyFixture={parentId:created.data.user.id,children:[randomUUID(),randomUUID()],bookings:Array.from({length:4},()=>randomUUID()),
    sources:Array.from({length:9},()=>randomUUID()),credits:Array.from({length:3},()=>randomUUID()),cutoffSources:Array.from({length:6},()=>randomUUID())}
  const q=sqlLiteral
  const statements=[
    // These are synthetic pre-cutover purchases. Seed under the exclusive
    // activation lock, with cutover restored before this single transaction
    // commits. verifyDisposableIdentity runs before executing any statement.
    `BEGIN; SELECT pg_advisory_xact_lock(10,1); UPDATE public.task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false; SELECT set_config('task10.source_write','authorized',true);`,
    `UPDATE public.profiles SET full_name='Task10 Family Parent' WHERE id=${q(family.parentId)};`,
    ...family.children.map((id,i)=>`INSERT INTO public.children(id,parent_id,full_name,date_of_birth) VALUES(${q(id)},${q(family.parentId)},'Task10 Family ${i+1}','2016-01-01');`),
    `INSERT INTO public.schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT ${q(fixture.branchId)},${q(fixture.kidsCourseId)},d,'17:00','19:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM public.schedule_templates WHERE branch_id=${q(fixture.branchId)} AND course_type_id=${q(fixture.kidsCourseId)} AND day_of_week=d AND start_time='17:00' AND end_time='19:00' AND is_active);`,
    ...family.bookings.map((id,i)=>`INSERT INTO public.bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,entitlement_sessions,total_price,status,created_at)
      VALUES(${q(id)},${q(family.parentId)},'child',${q(family.children[i%2])},${q(i%2?fixture.secondBranchId:fixture.branchId)},${q(fixture.kidsCourseId)},${i<2?7:8},2031,${i<2?10:1},${i<2?10:1},${i<2?5000:700},${q(i<2?'verified':i===2?'paid':'pending_payment')},'2031-07-01T01:00:00Z');`),
  ]
  for(let i=0;i<family.sources.length;i++) {
    const date=`2031-07-${String(i+1).padStart(2,'0')}`; const child=family.children[i%2]; const booking=family.bookings[i%2]
    statements.push(`INSERT INTO public.schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT id,branch_id,course_type_id,${q(date)},start_time,end_time,6,0,'open' FROM public.schedule_templates WHERE branch_id=${q(fixture.branchId)} AND course_type_id=${q(fixture.kidsCourseId)} AND day_of_week=extract(dow FROM ${q(date)}::date) AND start_time='17:00' AND end_time='19:00' AND is_active ON CONFLICT(branch_id,course_type_id,date,start_time) DO NOTHING;`)
    statements.push(`INSERT INTO public.booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT ${q(family.sources[i])},${q(booking)},id,${q(date)},'17:00','19:00',branch_id,${q(child)},${q(i<6?'absent':'walleted')},false FROM public.schedule_slots WHERE branch_id=${q(fixture.branchId)} AND course_type_id=${q(fixture.kidsCourseId)} AND date=${q(date)} AND start_time='17:00';`)
    if(i<6) statements.push(`INSERT INTO public.attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(family.sources[i])},${q(child)},'child',${q(fixture.adminUserId)},'absent');`)
    else statements.push(`INSERT INTO public.lesson_wallet_credits(id,user_id,booking_id,original_session_id,child_id,branch_id,course_type_id,original_schedule_slot_id,original_date,original_start_time,original_end_time,status,stored_at,expires_at)
      SELECT ${q(family.credits[i-6])},${q(family.parentId)},booking_id,id,child_id,branch_id,${q(fixture.kidsCourseId)},schedule_slot_id,date,start_time,end_time,'expired','2031-07-01T00:00:00Z',${q(i===8?'2031-07-30T23:59:59.999+07:00':'2031-07-31T23:59:59.999+07:00')} FROM public.booking_sessions WHERE id=${q(family.sources[i])};`)
  }
  for(let i=0;i<family.cutoffSources.length;i++) {
    const booking=randomUUID(); const date=`2031-09-${20+i}`
    statements.push(`INSERT INTO public.bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,entitlement_sessions,total_price,status,created_at)
      VALUES(${q(booking)},${q(family.parentId)},'child',${q(family.children[0])},${q(fixture.branchId)},${q(fixture.kidsCourseId)},9,2031,1,1,700,'verified','2031-07-01T01:00:00Z');`)
    statements.push(`INSERT INTO public.schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT id,branch_id,course_type_id,${q(date)},start_time,end_time,6,0,'open' FROM public.schedule_templates WHERE branch_id=${q(fixture.branchId)} AND course_type_id=${q(fixture.kidsCourseId)} AND day_of_week=extract(dow FROM ${q(date)}::date) AND start_time='17:00' AND end_time='19:00' AND is_active ON CONFLICT(branch_id,course_type_id,date,start_time) DO NOTHING;`)
    statements.push(`INSERT INTO public.booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT ${q(family.cutoffSources[i])},${q(booking)},id,${q(date)},'17:00','19:00',branch_id,${q(family.children[0])},'scheduled',false FROM public.schedule_slots WHERE branch_id=${q(fixture.branchId)} AND course_type_id=${q(fixture.kidsCourseId)} AND date=${q(date)} AND start_time='17:00';`)
  }
  statements.push(`UPDATE public.task10_policy_activation SET state='active',revision=1,effective_at='2031-07-31T18:00:00+07:00',pricing_enabled=true,makeup_enabled=true,expiry_enabled=false WHERE singleton;`)
  statements.push(`INSERT INTO public.task10_wallet_transition_evidence(credit_id,source_month,source_root_id,effective_at,original_expires_at,evidence)
    SELECT w.id,'2031-07-01',w.original_session_id,a.effective_at,w.expires_at,'{"disposableFixture":true}' FROM public.lesson_wallet_credits w CROSS JOIN public.task10_policy_activation a WHERE w.user_id=${q(family.parentId)} AND w.expires_at>a.effective_at; COMMIT;`)
  localSql(statements.join('\n')); setDisposableClock('2031-08-01T00:00:00+07:00')
  writeFileSync(FIXTURE_PATH,JSON.stringify({...fixture,family},null,2))
  return family
}

export async function setupTask10() {
  verifyDisposableIdentity()
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const booking = await seedBookingFixture()
  const admin = createLocalAdmin()
  const createAdmin = async (email: string) => {
    const { data, error } = await admin.auth.admin.createUser({ email, password: TASK10_PASSWORD, email_confirm: true })
    if (error || !data.user) throw new Error(error?.message || 'Missing test user')
    const result = await admin.from('profiles').update({ role:'admin', full_name:'ผู้ดูแลจำลอง Task10' }).eq('id',data.user.id)
    if (result.error) throw result.error
    return data.user.id
  }
  const makeupAdminId = await createAdmin(TASK10_ADMIN_EMAIL)
  const deniedAdminId = await createAdmin(TASK10_DENIED_EMAIL)
  localSql('SELECT public.task10_bootstrap_catalogs_v1(); NOTIFY pgrst, \'reload schema\';')
  const fixture = { ...booking, makeupAdminId, deniedAdminId }
  mkdirSync(dirname(FIXTURE_PATH), { recursive:true })
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture,null,2))
  seedLifecycleFixtures()
}

export async function teardownTask10() {
  verifyDisposableIdentity()
  if (existsSync(FIXTURE_PATH)) {
    const fixture = readTask10Fixture()
    const owners = [fixture.userId, fixture.otherUserId, fixture.multiBranchUserId, fixture.family?.parentId].filter(Boolean)
    for (const upload of fixture.storageUploads || []) {
      if (!['payment-slips','progressive-payment-slips'].includes(upload.bucket) || !owners.some((id) => upload.path.startsWith(`${id}/`))
        || !/^[a-f0-9-]+\/(task10-[a-f0-9-]+\.png|[a-f0-9-]{36}-[a-f0-9]{64}\.png|batches\/[a-f0-9-]+\/[a-f0-9]{64}\.png)$/.test(upload.path)) throw new Error('Unverified Storage cleanup path')
      const removed = await createLocalAdmin().storage.from(upload.bucket).remove([upload.path])
      if (removed.error) throw removed.error
    }
  }
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const count = localSql('SELECT count(*) FROM auth.users;')
  if (count !== '0') throw new Error('Task10 fixture cleanup failed')
}

export { createLocalAdmin, getLocalSupabaseEnv }

// Synthetic protected-Wallet fixtures also work on the actual pre-Task10 schema.
// Each parent is isolated; different participant IDs below are direct-RPC probes,
// not separate buttons in the customer UI (which sends one representative ID).
let protectedWalletMinute = 0
export async function protectedWalletFixture(f: BookingFixture, privateLesson = true, quantity = 2, orderedSourceIds = false) {
  verifyDisposableIdentity()
  const parent = await createLocalAdmin().auth.admin.createUser({
    email: `wallet-lock-${randomUUID()}@example.com`, password: TASK10_PASSWORD, email_confirm: true,
  })
  if (parent.error || !parent.data.user) throw new Error(parent.error?.message || 'Missing protected fixture parent')
  const userId = parent.data.user.id; const childId = randomUUID(); const booking = randomUUID(); const payment = randomUUID()
  const course = privateLesson ? f.privateCourseId : f.adultCourseId
  const minute = protectedWalletMinute++
  const start = `${String(5 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`
  const end = `${String(6 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`
  const dates = JSON.parse(localSql(`SELECT jsonb_build_object(
    'source',(date_trunc('month',transaction_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month 10 days')::date,
    'other',(date_trunc('month',transaction_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month 13 days')::date,
    'target',(date_trunc('month',transaction_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month 11 days')::date);`)) as { source: string; other: string; target: string }
  const children = privateLesson ? [null, childId] : [null]
  const sources = children.map(() => randomUUID()); const others = quantity > 1 ? children.map(() => randomUUID()) : []
  if (orderedSourceIds) sources.sort()
  const targetTemplate = randomUUID(); const slots = [randomUUID(), randomUUID(), randomUUID()]
  const statements = [`INSERT INTO children(id,parent_id,full_name,date_of_birth) VALUES('${childId}','${userId}','Protected Wallet child','2016-01-01');
    INSERT INTO bookings(id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES('${booking}','${userId}','self','${f.branchId}','${course}',extract(month FROM date '${dates.source}'),extract(year FROM date '${dates.source}'),${quantity},${quantity * (privateLesson ? 1000 : 500)},'verified');
    INSERT INTO payments(id,booking_id,user_id,amount,status,verified_at)
      VALUES('${payment}','${booking}','${userId}',${quantity * (privateLesson ? 1000 : 500)},'approved',transaction_timestamp());`]
  ;[dates.source, dates.other, dates.target].forEach((date, i) => {
    const template = i === 2 ? targetTemplate : randomUUID()
    statements.push(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      VALUES('${template}','${f.branchId}','${course}',extract(dow FROM date '${date}'),'${start}','${end}',true);
      INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      VALUES('${slots[i]}','${template}','${f.branchId}','${course}','${date}','${start}','${end}',1,0,'open');`)
    if (i < 2) (i === 0 ? sources : others).forEach((id, j) => statements.push(`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      VALUES('${id}','${booking}','${slots[i]}','${date}','${start}','${end}','${f.branchId}',${children[j] ? sqlLiteral(children[j]!) : 'NULL'},'scheduled',false);`))
  })
  const ids = sources.map(sqlLiteral).join(','); const otherIds = others.length ? others.map(sqlLiteral).join(',') : 'NULL::uuid'
  const storeArgs = (id = sources[0]) => `'${userId}','${id}','${userId}'`
  const redeemArgs = (credit: string) => `'${userId}',${sqlLiteral(credit)},'${dates.target}','${start}','${end}','${f.branchId}','${targetTemplate}'`
  const snapshot = `SELECT jsonb_build_object(
    'credits',(SELECT count(*) FROM lesson_wallet_credits WHERE booking_id='${booking}'),
    'members',(SELECT count(*) FROM lesson_wallet_credit_members WHERE original_session_id IN (${ids})),
    'memberIdentity',(SELECT coalesce(bool_and(m.child_id IS NOT DISTINCT FROM s.child_id AND w.booking_id=s.booking_id AND w.user_id='${userId}'),true) FROM lesson_wallet_credit_members m JOIN booking_sessions s ON s.id=m.original_session_id JOIN lesson_wallet_credits w ON w.id=m.credit_id WHERE s.id IN (${ids})),
    'walleted',(SELECT count(*) FROM booking_sessions WHERE id IN (${ids}) AND status='walleted'),
    'otherScheduled',(SELECT count(*) FROM booking_sessions WHERE id IN (${otherIds}) AND status='scheduled'),
    'descendants',(SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id IN (${ids})),
    'childIdentity',(SELECT coalesce(bool_and(n.child_id IS NOT DISTINCT FROM o.child_id),true) AND count(*)=count(DISTINCT n.rescheduled_from_id) FROM booking_sessions n JOIN booking_sessions o ON o.id=n.rescheduled_from_id WHERE o.id IN (${ids})),
    'targetSlots',(SELECT count(DISTINCT schedule_slot_id) FROM booking_sessions WHERE rescheduled_from_id IN (${ids})),
    'orphanCredits',(SELECT count(*) FROM lesson_wallet_credits w WHERE booking_id='${booking}' AND NOT EXISTS(SELECT 1 FROM lesson_wallet_credit_members m WHERE m.credit_id=w.id)))`
  const financialInvariants = `SELECT md5(jsonb_build_object(
    'booking',(SELECT to_jsonb(b) FROM bookings b WHERE id='${booking}'),
    'payments',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM payments p),
    'coupons',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY id),'[]') FROM coupon_usages c),
    'allocations',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]') FROM progressive_payment_allocations a),
    'finance',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY to_jsonb(e)::text),'[]') FROM finance_expenses e))::text)`
  const invariants = financialInvariants.replace("'booking',", `'otherHour',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s WHERE id IN (${otherIds})), 'booking',`)
  return { userId, childId, booking, payment, sources, others, children, quantity, privateLesson, dates, start, end,
    targetTemplate, branch: f.branchId, seed: statements.join('\n'), storeArgs, redeemArgs, snapshot, invariants, financialInvariants }
}

export type ProtectedWalletFixture = Awaited<ReturnType<typeof protectedWalletFixture>>

export async function seedFamilyScheduleFixture(childRepresentative: boolean) {
  verifyDisposableIdentity()
  const branchId = randomUUID()
  const branchName = `Family Schedule ${branchId.slice(0, 8)}`
  const branch = await createLocalAdmin().from('branches').insert({
    id: branchId, name: branchName, slug: `family-schedule-${branchId}`, is_active: true,
  })
  if (branch.error) throw branch.error
  // A distinct branch keeps independent cases/restarted test workers from
  // colliding on the same native-clock date/time slot.
  const fixture = await protectedWalletFixture({ ...readTask10Fixture(), branchId }, true, 2, true)
  const extraChild = childRepresentative ? randomUUID() : null
  const before = localSql('SELECT row_to_json(p) FROM task10_policy_activation p;')
  const additional = extraChild ? `
    INSERT INTO children(id,parent_id,full_name,date_of_birth)
      VALUES('${extraChild}','${fixture.userId}','A Family participant','2015-01-01');
    UPDATE booking_sessions SET child_id='${extraChild}' WHERE id IN ('${fixture.sources[0]}','${fixture.others[0]}');
    UPDATE bookings SET learner_type='child',child_id='${extraChild}' WHERE id='${fixture.booking}';` : ''
  // Only this synthetic fixture is written. Restore the complete prior control
  // state before commit; native Wallet/Auth clocks are never replaced.
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1);
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,revision=0,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    ${fixture.seed} ${additional}
    UPDATE profiles SET full_name='Schedule Family parent' WHERE id='${fixture.userId}';
    UPDATE children SET full_name='Z Family participant' WHERE id='${fixture.childId}';
    UPDATE task10_policy_activation p SET state=b.state,effective_at=b.effective_at,revision=b.revision,
      pricing_enabled=b.pricing_enabled,makeup_enabled=b.makeup_enabled,expiry_enabled=b.expiry_enabled,artifact=b.artifact
      FROM json_populate_record(NULL::task10_policy_activation,${sqlLiteral(before)}::json) b;
    COMMIT;`)
  const account = await createLocalAdmin().auth.admin.getUserById(fixture.userId)
  if (account.error || !account.data.user.email) throw new Error('Missing Family Schedule fixture account')
  return { ...fixture, extraChild, branchName, email: account.data.user.email }
}

export async function seedMakeupReadFixture(f: BookingFixture, options: { singleMonth?: boolean } = {}) {
  verifyDisposableIdentity()
  const admin = createLocalAdmin()
  const parent = await admin.auth.admin.createUser({ email: `makeup-read-${randomUUID()}@example.com`, password: TASK10_PASSWORD, email_confirm: true })
  if (parent.error || !parent.data.user) throw new Error(parent.error?.message || 'Missing Makeup fixture parent')
  const parentId = parent.data.user.id, branch = randomUUID()
  const branchName = `Makeup read fixture ${branch.slice(0, 8)}`
  const parentName = `Makeup Read ${parentId.slice(0, 8)}`
  const children = Array.from({ length: 120 }, () => randomUUID())
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const [year, month] = today.split('-').map(Number)
  const months = [1, 2, 3].map(back => new Date(Date.UTC(year, month - 1 - back, 1)).toISOString().slice(0, 7))
  const bookings = months.map(() => randomUUID())
  const rounds: Array<{ date: string; slot: string; sessions: string[]; children: string[] }> = []
  const statements = [
    `UPDATE profiles SET full_name=${sqlLiteral(parentName)} WHERE id='${parentId}';
      INSERT INTO branches(id,name,slug,is_active) VALUES('${branch}',${sqlLiteral(branchName)},'makeup-read-${branch}',true);`,
    ...children.map((id, i) => `INSERT INTO children(id,parent_id,full_name,date_of_birth) VALUES('${id}','${parentId}',${sqlLiteral(`Read learner ${String(i + 1).padStart(3, '0')} ชื่อและนามสกุลยาวสำหรับตรวจมือถือโดยไม่ปิดบังตัวตน`)},'2016-01-01');`),
    ...bookings.map((id, i) => `INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES('${id}','${parentId}','child','${children[0]}','${branch}','${f.kidsCourseId}',${Number(months[i].slice(5))},${Number(months[i].slice(0, 4))},500,0,'verified');`),
  ]
  for (let index = 0; index < 110; index++) {
    const monthIndex = options.singleMonth ? 0 : index % 3
    const date = `${months[monthIndex]}-${String(1 + (options.singleMonth ? index : Math.floor(index / 3)) % 28).padStart(2, '0')}`
    const hour = options.singleMonth ? 10 + 2 * Math.floor(index / 28) : index < 84 ? 10 : 12
    const start = `${hour}:00`, end = `${hour + 2}:00`
    const slot = randomUUID(), group = randomUUID(), count = index === 0 ? 120 : 10
    const round = { date, slot, sessions: [] as string[], children: [] as string[] }
    rounds.push(round)
    statements.push(`INSERT INTO schedule_slots(id,branch_id,course_type_id,date,start_time,end_time,status) VALUES('${slot}','${branch}','${f.kidsCourseId}','${date}','${start}','${end}','open');
      INSERT INTO coach_assignment_groups(id,schedule_slot_id,name,created_by) VALUES('${group}','${slot}','Read round ${index + 1}','${f.adminUserId}');`)
    for (let member = 0; member < count; member++) {
      const session = randomUUID(), child = children[(index * 10 + member) % children.length]
      round.sessions.push(session); round.children.push(child)
      const absent = index >= 107
      statements.push(`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES('${session}','${bookings[monthIndex]}','${slot}','${date}','${start}','${end}','${branch}','${child}','${absent ? 'absent' : 'scheduled'}',false);
        INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES('${group}','${session}','${child}','child');`)
      if (absent) statements.push(`INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES('${session}','${child}','child','${f.adminUserId}','absent');`)
    }
  }
  // More than one PostgREST page for one source: no review-log truncation.
  statements.push(`INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
    SELECT '${f.adminUserId}','attendance_gap_request_coach_review','booking_sessions','${rounds[0].sessions[0]}','{"fixture":"makeup-read"}'::jsonb FROM generate_series(1,1005);`)
  localSql(`BEGIN; ${statements.join('\n')} COMMIT;`)
  return { parentId, parentName, branch, branchName, children, bookings, rounds, months, sessionCount: rounds.reduce((n, r) => n + r.sessions.length, 0) }
}

export async function seedLegacyHeaderWalletFixture() {
  verifyDisposableIdentity()
  const branchId = randomUUID(), branchName = `Legacy Wallet ${branchId.slice(0, 8)}`
  const branch = await createLocalAdmin().from('branches').insert({ id: branchId, name: branchName, slug: `legacy-wallet-${branchId}`, is_active: true })
  if (branch.error) throw branch.error
  const c = await protectedWalletFixture({ ...readTask10Fixture(), branchId }, false, 1)
  const creditId = randomUUID(), before = localSql('SELECT row_to_json(p) FROM task10_policy_activation p;')
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1);
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,revision=0,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    ${c.seed}
    UPDATE profiles SET full_name='Legacy Wallet learner' WHERE id='${c.userId}';
    UPDATE booking_sessions SET status='walleted' WHERE id='${c.sources[0]}';
    INSERT INTO lesson_wallet_credits(id,user_id,booking_id,original_session_id,branch_id,course_type_id,original_schedule_slot_id,original_date,original_start_time,original_end_time,status,expires_at)
      SELECT '${creditId}','${c.userId}',booking_id,id,branch_id,'${readTask10Fixture().adultCourseId}',schedule_slot_id,date,start_time,end_time,'active',
        ((date_trunc('month',date::timestamp)+interval '1 month'-interval '1 millisecond') AT TIME ZONE 'Asia/Bangkok')
      FROM booking_sessions WHERE id='${c.sources[0]}';
    UPDATE task10_policy_activation p SET state=b.state,effective_at=b.effective_at,revision=b.revision,
      pricing_enabled=b.pricing_enabled,makeup_enabled=b.makeup_enabled,expiry_enabled=b.expiry_enabled,artifact=b.artifact
      FROM json_populate_record(NULL::task10_policy_activation,${sqlLiteral(before)}::json) b;
    COMMIT;`)
  const account = await createLocalAdmin().auth.admin.getUserById(c.userId)
  if (account.error || !account.data.user.email) throw new Error('Missing legacy Wallet fixture account')
  return { ...c, creditId, branchName, email: account.data.user.email }
}

// Delay both real original-name calls at the same booking row without modifying
// any function body. Capture results AND committed DB state even when one fails.
export async function raceFamilyWalletStore(c: ProtectedWalletFixture, differentParticipants: boolean) {
  const prefix = `family-lock-${randomUUID()}`
  const names = [`${prefix}-a`, `${prefix}-b`]
  const before = localSql(c.invariants)
  const holder = await holdLocalTransaction(`SELECT id FROM bookings WHERE id='${c.booking}' FOR UPDATE;`, `${prefix}-holder`)
  const calls = [c.sources[0], differentParticipants ? c.sources[1] : c.sources[0]].map((id, i) =>
    concurrentLocalSql(`SET application_name=${sqlLiteral(names[i])}; SET lock_timeout='35s'; SET statement_timeout='45s';
      SELECT public.lesson_wallet_store_v2(${c.storeArgs(id)});`)
      .then(output => ({ output, error: '' }), error => ({ output: '', error: String(error) })))
  const graphSql = `SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,'app',application_name,'waitType',wait_event_type,'wait',wait_event,
    'blockers',pg_blocking_pids(pid),'query',query) ORDER BY application_name),'[]') FROM pg_stat_activity WHERE application_name LIKE '${prefix}%';`
  let waiting: Array<{ waitType: string | null; app: string }> = []
  let barrierReached = false
  try {
    const deadline = Date.now() + 25_000
    do {
      waiting = JSON.parse(localSql(graphSql))
      if (waiting.filter(row => names.includes(row.app) && row.waitType === 'Lock').length === 2) { barrierReached = true; break }
      await new Promise(resolveWait => setTimeout(resolveWait, 100))
    } while (Date.now() < deadline)
  } finally { await holder.finish() }
  const releasedGraph = JSON.parse(localSql(graphSql))
  const results = await Promise.all(calls)
  return { barrierReached, waiting, releasedGraph, results, snapshot: JSON.parse(localSql(c.snapshot)), invariantsUnchanged: localSql(c.invariants) === before }
}
