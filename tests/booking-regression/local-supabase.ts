import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { lessonSourceRun, verifyLessonSourceTarget, lessonSourceEnvironment, lessonSourceFetch, completeLessonSourceReset } from '../../scripts/verify-lesson-source-test-target.mjs'

export const ROOT = resolve(__dirname, '../..')
export const FIXTURE_PATH = process.env.LESSON_SOURCE_RUN_MANIFEST
  ? resolve(lessonSourceRun().outputDir, 'booking-fixture.json') : resolve(ROOT, '.playwright/booking-fixture.json')

// Bind every CLI read/reset to the same explicitly selected disposable. Never
// infer ownership from a port or from two checkouts sharing a directory name.
function localTarget() {
  if (process.env.LESSON_SOURCE_RUN_MANIFEST) return verifyLessonSourceTarget().target
  const target = process.env.TASK10_DISPOSABLE_TARGET
    ? JSON.parse(readFileSync(process.env.TASK10_DISPOSABLE_TARGET, 'utf8')) as { project: string; workdir: string; api: string }
    : { project: basename(ROOT), workdir: ROOT, api: 'http://127.0.0.1:54321' }
  if (!/^[A-Za-z0-9_-]+$/.test(target.project) || new URL(target.api).hostname !== '127.0.0.1'
    || new URL(target.api).protocol !== 'http:') throw new Error('Refusing non-local test target')
  const inspect = (name: string) => JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
  const name = `supabase_db_${target.project}`, db = inspect(name)
  if (!db.State.Running || db.Config.Labels['com.supabase.cli.project'] !== target.project
    || resolve(db.Config.Labels['com.supabase.cli.workdir']) !== resolve(target.workdir)
    || !db.Mounts.some((m: { Name: string; Destination: string }) => m.Name === name && m.Destination === '/var/lib/postgresql/data')) {
    throw new Error('Refusing unverified test DB ownership')
  }
  for (const [service, key] of [['rest', 'PGRST_DB_URI'], ['auth', 'GOTRUE_DB_DATABASE_URL'], ['storage', 'DATABASE_URL']]) {
    const container = inspect(`supabase_${service}_${target.project}`)
    const raw = (container.Config.Env as string[]).find(value => value.startsWith(`${key}=`))?.slice(key.length + 1)
    const url = raw ? new URL(raw) : null
    if (!url || url.hostname !== name || url.port !== '5432' || url.pathname !== '/postgres') {
      throw new Error('Refusing unverified test service binding')
    }
  }
  const kong = inspect(`supabase_kong_${target.project}`)
  if (!kong.NetworkSettings.Ports['8000/tcp']?.some((p: { HostPort: string }) => p.HostPort === new URL(target.api).port)) {
    throw new Error('Refusing unverified test API binding')
  }
  return target
}

export const IDS = {
  branch: '11000000-0000-4000-8000-000000000001',
  secondBranch: '11000000-0000-4000-8000-000000000002',
  kidsCourse: '22000000-0000-4000-8000-000000000001',
  adultCourse: '22000000-0000-4000-8000-000000000002',
  privateCourse: '22000000-0000-4000-8000-000000000003',
  mainChild: '33000000-0000-4000-8000-000000000001',
  multiBranchChild: '33000000-0000-4000-8000-000000000002',
  coupon: '44000000-0000-4000-8000-000000000001',
  legacyBooking: '55000000-0000-4000-8000-000000000001',
} as const

export const TEST_ACCOUNT = {
  email: 'booking-regression-parent@example.com',
  password: 'LocalBooking!2026',
  fullName: 'ผู้ปกครองทดสอบ Booking Regression',
  childName: 'นักเรียนทดสอบ Progressive',
  childNickname: 'โปรเกรสซีฟ',
}

export const TEST_ADMIN_ACCOUNT = {
  email: 'booking-regression-admin@example.com',
  password: TEST_ACCOUNT.password,
  fullName: 'ผู้ดูแลทดสอบ Booking Regression',
}

export const MULTI_BRANCH_TEST_ACCOUNT = {
  email: 'booking-regression-multibranch@example.com',
  password: TEST_ACCOUNT.password,
  fullName: 'Multi Branch Booking Parent',
  childName: 'Multi Branch Booking Child',
  childNickname: 'MultiBranch',
}

export const BOOKING_MONTH = 7
export const BOOKING_YEAR = 2031
export const LEGACY_BASELINE_DATES = ['2031-07-01', '2031-07-02', '2031-07-03', '2031-07-04'] as const
export const BOOKING_DATES = ['2031-07-20', '2031-07-21', '2031-07-23', '2031-07-24'] as const
export const FULL_DATE = '2031-07-22'
export const OVERFULL_DATE = '2031-07-26'
export const RACE_DATE = '2031-07-25'
export const PRIVATE_TARGET_DATE = '2031-07-13'
export const OTHER_MONTH_DATE = '2031-08-03'
export const BOOKING_MONTH_END = '2031-07-31T16:59:59Z'
export const MULTI_BRANCH_DATES = [
  '2030-07-01',
  '2030-07-02',
  '2030-07-03',
  '2030-07-04',
  '2030-07-05',
  '2030-07-06',
  '2030-07-07',
  '2030-07-08',
  '2030-07-09',
] as const

export interface LocalSupabaseEnv {
  apiUrl: string
  publishableKey: string
  serviceRoleKey: string
}

export interface BookingFixture {
  userId: string
  otherUserId: string
  adminUserId: string
  multiBranchUserId: string
  branchId: string
  secondBranchId: string
  kidsCourseId: string
  adultCourseId: string
  privateCourseId: string
  mainChildId: string
  multiBranchChildId: string
  couponId: string
  legacyBookingId: string
  templates: Record<string, string>
  slots: Record<string, string>
  secondTemplates: Record<string, string>
  secondSlots: Record<string, string>
}

function requireLocalUrl(value: string) {
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error(`Disposable booking tests refuse non-local Supabase URL: ${url.origin}`)
  }
  return value
}

export function getLocalSupabaseEnv(): LocalSupabaseEnv {
  if (process.env.LESSON_SOURCE_RUN_MANIFEST) return lessonSourceEnvironment()
  const target = localTarget()
  const options = {
    cwd: target.workdir,
    encoding: 'utf8' as const,
    stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  }
  const output = process.env.SUPABASE_TEST_CLI
    ? execFileSync(process.env.SUPABASE_TEST_CLI, ['status', '-o', 'env'], options)
    : execSync('npx.cmd supabase status -o env', options)
  const values = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const publishableKey = values.get('PUBLISHABLE_KEY') || values.get('ANON_KEY')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  if (!apiUrl || !publishableKey || !serviceRoleKey) {
    throw new Error('Local Supabase status did not return API_URL, publishable/anon key, and service role key.')
  }
  if (new URL(apiUrl).origin !== target.api) throw new Error('CLI and verified test target differ')
  return { apiUrl: requireLocalUrl(apiUrl), publishableKey, serviceRoleKey }
}

export function createLocalAdmin(): SupabaseClient {
  const env = getLocalSupabaseEnv()
  return createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(process.env.LESSON_SOURCE_RUN_MANIFEST ? { global: { fetch: lessonSourceFetch } } : {}),
  })
}

// Only synthetic fixture construction uses the physical disposable owner. The
// application-role client remains unchanged for authorization/bypass assertions.
function seedSourceRows(rows: Record<string, unknown> | Record<string, unknown>[]) {
  const target=localTarget(), records=Array.isArray(rows)?rows:[rows]
  const columns=Array.from(new Set(records.flatMap(row=>Object.keys(row))))
  if(columns.some(column=>!/^[a-z_]+$/.test(column))) throw new Error('Invalid fixture column')
  const json=JSON.stringify(records).replaceAll("'","''")
  execFileSync('docker',['exec','-i',`supabase_db_${target.project}`,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{
    input:`BEGIN; SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true);
      INSERT INTO booking_sessions(${columns.join(',')}) SELECT ${columns.join(',')}
      FROM jsonb_populate_recordset(NULL::booking_sessions,'${json}'::jsonb); COMMIT;`,
    encoding:'utf8',stdio:['pipe','pipe','pipe'],
  })
  return {error:null}
}

function assertNoError(error: { message?: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message || JSON.stringify(error)}`)
}

async function createTestUser(admin: SupabaseClient, email: string, fullName: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_ACCOUNT.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  assertNoError(error, `create auth user ${email}`)
  if (!data.user) throw new Error(`create auth user ${email}: user missing`)
  const { error: profileError } = await admin.from('profiles').update({
    full_name: fullName,
    email,
    role: 'user',
  }).eq('id', data.user.id)
  assertNoError(profileError, `update profile ${email}`)
  return data.user.id
}

function fixedUuid(prefix: string, index: number) {
  return `${prefix.padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(index).padStart(12, '0')}`
}

export function resetLocalDatabase() {
  const lessonRun = process.env.LESSON_SOURCE_RUN_MANIFEST ? verifyLessonSourceTarget() : null
  const resetStartedAt = Date.now()
  const target = localTarget()
  if (process.env.SUPABASE_TEST_CLI) {
    execFileSync(process.env.SUPABASE_TEST_CLI, ['db','reset','--local'], { cwd: target.workdir, stdio: 'inherit' })
  } else {
    execSync('npx.cmd supabase db reset --local', { cwd: target.workdir, stdio: 'inherit' })
  }
  if (lessonRun) completeLessonSourceReset(lessonRun, resetStartedAt)
  execFileSync('docker', ['restart', `supabase_kong_${target.project}`], {
    cwd: target.workdir,
    stdio: 'ignore',
  })
}

export async function waitForLocalSupabaseAuth() {
  let lastError: { message?: string } | null = null
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const admin = createLocalAdmin()
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (!error) return
    lastError = error
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assertNoError(lastError, 'wait for local Supabase Auth')
}

export async function seedBookingFixture(): Promise<BookingFixture> {
  const admin = createLocalAdmin()
  const userId = await createTestUser(admin, TEST_ACCOUNT.email, TEST_ACCOUNT.fullName)
  const otherUserId = await createTestUser(admin, 'booking-regression-occupancy@example.com', 'ผู้ปกครองทดสอบ Occupancy')
  const adminUserId = await createTestUser(admin, TEST_ADMIN_ACCOUNT.email, TEST_ADMIN_ACCOUNT.fullName)
  const multiBranchUserId = await createTestUser(
    admin,
    MULTI_BRANCH_TEST_ACCOUNT.email,
    MULTI_BRANCH_TEST_ACCOUNT.fullName,
  )
  assertNoError((await admin.from('profiles').update({ role: 'super_admin' }).eq('id', adminUserId)).error, 'promote booking regression admin')

  assertNoError((await admin.from('branches').insert([
    {
      id: IDS.branch,
      name: 'สาขาทดสอบ Localhost',
      slug: 'localhost-regression',
      address: 'Disposable database only',
      is_active: true,
    },
    {
      id: IDS.secondBranch,
      name: 'Multi Branch Localhost',
      slug: 'localhost-regression-second',
      address: 'Disposable database only',
      is_active: true,
    },
  ])).error, 'insert branches')

  assertNoError((await admin.from('course_types').insert([
    { id: IDS.kidsCourse, name: 'kids_group', description: 'Local progressive fixture', max_students: 6, duration_hours: 2 },
    { id: IDS.adultCourse, name: 'adult_group', description: 'Legacy regression fixture', max_students: 6, duration_hours: 2 },
    { id: IDS.privateCourse, name: 'private', description: 'Legacy regression fixture', max_students: 1, duration_hours: 1 },
  ])).error, 'insert course types')

  const kidsTiers = [
    [1, 1, 700], [2, 6, 625], [7, 10, 500], [11, 14, 433], [15, 18, 406], [19, null, 350],
  ].map(([min, max, rate], index) => ({
    id: fixedUuid('6600000', index + 1),
    course_type_id: IDS.kidsCourse,
    min_sessions: min,
    max_sessions: max,
    price_per_session: rate,
    package_price: Number(min) * Number(rate),
    valid_from: '2026-01-01',
  }))
  assertNoError((await admin.from('pricing_tiers').insert([
    ...kidsTiers,
    { id: fixedUuid('6600000', 20), course_type_id: IDS.adultCourse, min_sessions: 1, max_sessions: null, price_per_session: 500, package_price: 500, valid_from: '2026-01-01' },
    { id: fixedUuid('6600000', 21), course_type_id: IDS.privateCourse, min_sessions: 1, max_sessions: null, price_per_session: 1000, package_price: 1000, valid_from: '2026-01-01' },
  ])).error, 'insert pricing tiers')

  assertNoError((await admin.from('children').insert({
    id: IDS.mainChild,
    parent_id: userId,
    full_name: TEST_ACCOUNT.childName,
    nickname: TEST_ACCOUNT.childNickname,
    date_of_birth: '2016-01-01',
  })).error, 'insert main child')

  assertNoError((await admin.from('children').insert({
    id: IDS.multiBranchChild,
    parent_id: multiBranchUserId,
    full_name: MULTI_BRANCH_TEST_ACCOUNT.childName,
    nickname: MULTI_BRANCH_TEST_ACCOUNT.childNickname,
    date_of_birth: '2016-01-02',
  })).error, 'insert multi-branch child')

  const otherChildren = Array.from({ length: 20 }, (_, index) => ({
    id: fixedUuid('7700000', index + 1),
    parent_id: otherUserId,
    full_name: `Occupancy ${index + 1}`,
    nickname: `O${index + 1}`,
    date_of_birth: '2015-01-01',
  }))
  assertNoError((await admin.from('children').insert(otherChildren)).error, 'insert occupancy children')

  const dates = [
    ...LEGACY_BASELINE_DATES,
    ...BOOKING_DATES,
    FULL_DATE,
    OVERFULL_DATE,
    RACE_DATE,
    ...MULTI_BRANCH_DATES,
  ]
  const days = Array.from(new Set(dates.map((date) => new Date(`${date}T00:00:00Z`).getUTCDay())))
  const templates: Record<string, string> = {}
  for (const day of days) {
    templates[String(day)] = fixedUuid('8800000', day + 1)
  }
  assertNoError((await admin.from('schedule_templates').insert(days.map((day) => ({
    id: templates[String(day)],
    branch_id: IDS.branch,
    course_type_id: IDS.kidsCourse,
    day_of_week: day,
    start_time: '17:00',
    end_time: '19:00',
    is_active: true,
    notes: 'Disposable booking regression fixture',
  })))).error, 'insert schedule templates')

  const slots: Record<string, string> = {}
  for (const [index, date] of dates.entries()) slots[date] = fixedUuid('9900000', index + 1)
  assertNoError((await admin.from('schedule_slots').insert(dates.map((date) => ({
    id: slots[date],
    template_id: templates[String(new Date(`${date}T00:00:00Z`).getUTCDay())],
    branch_id: IDS.branch,
    course_type_id: IDS.kidsCourse,
    date,
    start_time: '17:00',
    end_time: '19:00',
    max_students: 6,
    current_students: 0,
    status: 'open',
  })))).error, 'insert schedule slots')

  const secondDays = Array.from(new Set(
    MULTI_BRANCH_DATES.map((date) => new Date(`${date}T00:00:00Z`).getUTCDay()),
  ))
  const secondTemplates: Record<string, string> = {}
  for (const day of secondDays) secondTemplates[String(day)] = fixedUuid('8810000', day + 1)
  assertNoError((await admin.from('schedule_templates').insert(secondDays.map((day) => ({
    id: secondTemplates[String(day)],
    branch_id: IDS.secondBranch,
    course_type_id: IDS.kidsCourse,
    day_of_week: day,
    start_time: '17:00',
    end_time: '19:00',
    is_active: true,
    notes: 'Disposable multi-branch booking regression fixture',
  })))).error, 'insert second-branch schedule templates')

  const secondSlots: Record<string, string> = {}
  for (const [index, date] of MULTI_BRANCH_DATES.entries()) {
    secondSlots[date] = fixedUuid('9910000', index + 1)
  }
  assertNoError((await admin.from('schedule_slots').insert(MULTI_BRANCH_DATES.map((date) => ({
    id: secondSlots[date],
    template_id: secondTemplates[String(new Date(`${date}T00:00:00Z`).getUTCDay())],
    branch_id: IDS.secondBranch,
    course_type_id: IDS.kidsCourse,
    date,
    start_time: '17:00',
    end_time: '19:00',
    max_students: 6,
    current_students: 0,
    status: 'open',
  })))).error, 'insert second-branch schedule slots')

  assertNoError((await admin.from('bookings').insert({
    id: IDS.legacyBooking,
    user_id: userId,
    learner_type: 'child',
    child_id: IDS.mainChild,
    branch_id: IDS.branch,
    course_type_id: IDS.kidsCourse,
    month: BOOKING_MONTH,
    year: BOOKING_YEAR,
    total_sessions: 4,
    total_price: 2500,
    status: 'verified',
    entitlement_sessions: 4,
    created_at: '2026-07-01T01:00:00Z',
  })).error, 'insert legacy baseline booking')
  assertNoError((await seedSourceRows(LEGACY_BASELINE_DATES.map((date, index) => ({
    id: fixedUuid('aa00000', index + 1),
    booking_id: IDS.legacyBooking,
    schedule_slot_id: slots[date],
    date,
    start_time: '17:00',
    end_time: '19:00',
    branch_id: IDS.branch,
    child_id: IDS.mainChild,
    status: 'completed',
  })))).error, 'insert legacy baseline sessions')

  for (let index = 0; index < 20; index += 1) {
    const bookingId = fixedUuid('bb00000', index + 1)
    const occupiedDates = [OVERFULL_DATE]
    if (index < 6) occupiedDates.push(FULL_DATE)
    if (index < 5) occupiedDates.push(BOOKING_DATES[0], RACE_DATE)
    assertNoError((await admin.from('bookings').insert({
      id: bookingId,
      user_id: otherUserId,
      learner_type: 'child',
      child_id: otherChildren[index].id,
      branch_id: IDS.branch,
      course_type_id: IDS.kidsCourse,
      month: BOOKING_MONTH,
      year: BOOKING_YEAR,
      total_sessions: occupiedDates.length,
      total_price: 0,
      status: 'verified',
      entitlement_sessions: occupiedDates.length,
      created_at: new Date(Date.UTC(2026, 6, 10, 0, index, 0)).toISOString(),
    })).error, `insert occupancy booking ${index + 1}`)
    assertNoError((await seedSourceRows(occupiedDates.map((date, sessionIndex) => ({
      id: fixedUuid('cc', index * 10 + sessionIndex + 1),
      booking_id: bookingId,
      schedule_slot_id: slots[date],
      date,
      start_time: '17:00',
      end_time: '19:00',
      branch_id: IDS.branch,
      child_id: otherChildren[index].id,
      status: 'scheduled',
    })))).error, `insert occupancy sessions ${index + 1}`)
  }

  const excludedCases = [
    { id: fixedUuid('bd', 1), status: 'cancelled', expires_at: null, sessionStatus: 'scheduled' },
    { id: fixedUuid('bd', 2), status: 'verified', expires_at: null, sessionStatus: 'rescheduled' },
    { id: fixedUuid('bd', 3), status: 'verified', expires_at: null, sessionStatus: 'walleted' },
    { id: fixedUuid('bd', 4), status: 'pending_payment', expires_at: '2026-07-13T00:00:00Z', sessionStatus: 'scheduled' },
  ]
  for (const [index, item] of excludedCases.entries()) {
    assertNoError((await admin.from('bookings').insert({
      id: item.id,
      user_id: otherUserId,
      learner_type: 'child',
      child_id: otherChildren[0].id,
      branch_id: IDS.branch,
      course_type_id: IDS.kidsCourse,
      month: BOOKING_MONTH,
      year: BOOKING_YEAR,
      total_sessions: 1,
      total_price: 0,
      status: item.status,
      entitlement_sessions: 1,
      expires_at: item.expires_at,
      created_at: `2026-07-11T0${index}:00:00Z`,
    })).error, `insert excluded booking ${index + 1}`)
    assertNoError((await seedSourceRows({
      id: fixedUuid('cd', index + 1),
      booking_id: item.id,
      schedule_slot_id: slots[BOOKING_DATES[1]],
      date: BOOKING_DATES[1],
      start_time: '17:00',
      end_time: '19:00',
      branch_id: IDS.branch,
      child_id: otherChildren[0].id,
      status: item.sessionStatus,
    })).error, `insert excluded session ${index + 1}`)
  }

  assertNoError((await admin.from('coupons').insert({
    id: IDS.coupon,
    code: 'TEST10',
    discount_type: 'percent',
    discount_value: 10,
    min_purchase: 1,
    max_uses: 20,
    current_uses: 0,
    valid_from: '2026-01-01',
    valid_to: `${BOOKING_YEAR}-12-31`,
    created_by: userId,
    is_active: true,
  })).error, 'insert coupon')
  assertNoError((await admin.from('coupon_course_types').insert({
    coupon_id: IDS.coupon,
    course_type_id: IDS.kidsCourse,
  })).error, 'insert coupon course type')

  const fixture: BookingFixture = {
    userId, otherUserId, adminUserId, multiBranchUserId,
    branchId: IDS.branch,
    secondBranchId: IDS.secondBranch,
    kidsCourseId: IDS.kidsCourse,
    adultCourseId: IDS.adultCourse,
    privateCourseId: IDS.privateCourse,
    mainChildId: IDS.mainChild,
    multiBranchChildId: IDS.multiBranchChild,
    couponId: IDS.coupon,
    legacyBookingId: IDS.legacyBooking,
    templates,
    slots,
    secondTemplates,
    secondSlots,
  }
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true })
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
  return fixture
}

export function readBookingFixture(): BookingFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as BookingFixture
}

export async function getFixtureResidueCount() {
  const admin = createLocalAdmin()
  const fixedRows = [
    ['branches', IDS.branch],
    ['branches', IDS.secondBranch],
    ['course_types', IDS.kidsCourse],
    ['course_types', IDS.adultCourse],
    ['course_types', IDS.privateCourse],
    ['children', IDS.mainChild],
    ['children', IDS.multiBranchChild],
    ['coupons', IDS.coupon],
    ['bookings', IDS.legacyBooking],
  ] as const
  let total = 0
  for (const [table, id] of fixedRows) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('id', id)
    assertNoError(error, `count residue ${table}`)
    total += count || 0
  }
  let authUsers: Array<{ email?: string }> | null = null
  let authError: { message?: string } | null = null
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (!error) {
      authUsers = data.users
      authError = null
      break
    }
    authError = error
    await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  assertNoError(authError, 'count auth residue')
  total += (authUsers || []).filter((user) => user.email?.startsWith('booking-regression-')).length
  return total
}
