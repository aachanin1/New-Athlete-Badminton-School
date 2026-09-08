import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { PAYMENT_TRANSFER_DEFAULT_BRANCHES } from '../../src/lib/payment-transfer-defaults'
import { PAYMENT_TRANSFER_SETTING_KEY } from '../../src/lib/payment-settings'
import {
  createLocalAdmin,
  getLocalSupabaseEnv,
  resetLocalDatabase,
  waitForLocalSupabaseAuth,
} from '../booking-regression/local-supabase'

const ROOT = resolve(__dirname, '../..')
const FIXTURE_PATH = resolve(ROOT, '.playwright/history-payment-fixture.json')

// The real migrations expose payment_ledger_allocations_v1, not a Ledger table.
// Verify absence in the database catalog; never turn a failed REST read into zero.
export function verifyLocalLegacyLedgerAbsent() {
  const local = getLocalSupabaseEnv()
  if (new URL(local.apiUrl).origin !== 'http://127.0.0.1:54321') throw new Error('Unexpected History DB endpoint')
  const container = 'supabase_db_New-Athlete-Badminton-School'
  const identity = JSON.parse(execFileSync('docker', ['inspect', container, '--format', '{{json .Config.Labels}}'], { encoding: 'utf8' }))
  if (identity['com.supabase.cli.project'] !== 'New-Athlete-Badminton-School'
    || identity['com.supabase.cli.workdir'] !== ROOT) throw new Error('Unexpected History DB container identity')
  const result = execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt',
    '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN READ ONLY; SELECT to_regclass('public."Ledger"') IS NULL; COMMIT;`], { encoding: 'utf8' }).trim()
  if (result !== 't') throw new Error('Unexpected Ledger relation: review schema before payment verification')
  return 'absent-verified-by-postgres-catalog'
}

export const HISTORY_ACCOUNT = {
  email: 'history-payment-regression@example.com',
  password: 'LocalHistory!2026',
  fullName: 'ผู้ปกครองทดสอบ History Payment',
}

export const PAYMENT_SETTINGS_ADMIN = { email: 'payment-settings-admin@example.com', password: 'LocalPaymentSettings!2026' }
export const PAYMENT_SETTINGS_STANDARD_ADMIN = { email: 'payment-settings-standard@example.com', password: PAYMENT_SETTINGS_ADMIN.password }
export const HISTORY_LEGACY_TRANSFER_SETTINGS = { bankName: '', accountNumber: '0000000000', accountName: '', branchName: 'legacy bank branch', promptPay: '', instructions: 'TEST Mode' }

export const HISTORY_IDS = {
  branch: 'aa77eba0-d05e-4539-9606-f55fe8a530ca',
  course: '23000000-0000-4000-8000-000000000001',
  child: '34000000-0000-4000-8000-000000000001',
  scope: '45000000-0000-4000-8000-000000000001',
  booking1: '56000000-0000-4000-8000-000000000001',
  booking2: '56000000-0000-4000-8000-000000000002',
  legacyBooking1: '57000000-0000-4000-8000-000000000001',
  legacyBooking2: '57000000-0000-4000-8000-000000000002',
  legacyBooking3: '57000000-0000-4000-8000-000000000003',
  legacyBooking4: '57000000-0000-4000-8000-000000000004',
  legacyBooking5: '57000000-0000-4000-8000-000000000005',
  legacyBooking6: '57000000-0000-4000-8000-000000000006',
  legacyInvalidBooking: '57000000-0000-4000-8000-000000000007',
  template: '67000000-0000-4000-8000-000000000001',
} as const

export interface HistoryPaymentFixture {
  userId: string
  settingsAdminId: string
  settingsStandardAdminId: string
  scopeId: string
  bookingIds: [string, string]
  legacyBookingIds: string[]
  legacyInvalidBookingId: string
  legacyAmount: number
  amounts: [number, number]
  total: number
}

function fixedUuid(index: number) {
  return `78000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function assertNoError(error: { message?: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message || 'unknown error'}`)
}

export async function seedHistoryPaymentFixture() {
  const admin = createLocalAdmin()
  const { data: legacySlipBucket, error: legacySlipBucketError } = await admin.storage
    .getBucket('payment-slips')
  if (legacySlipBucketError && legacySlipBucketError.message !== 'Bucket not found') {
    throw new Error(`read disposable Legacy slip bucket: ${legacySlipBucketError.message}`)
  }
  if (!legacySlipBucket) {
    assertNoError((await admin.storage.createBucket('payment-slips', { public: true })).error,
      'create disposable Legacy slip bucket')
  }
  const { data: auth, error: authError } = await admin.auth.admin.createUser({
    email: HISTORY_ACCOUNT.email,
    password: HISTORY_ACCOUNT.password,
    email_confirm: true,
    user_metadata: { full_name: HISTORY_ACCOUNT.fullName },
  })
  assertNoError(authError, 'create History auth user')
  if (!auth.user) throw new Error('create History auth user: user missing')
  const userId = auth.user.id
  assertNoError((await admin.from('profiles').update({
    full_name: HISTORY_ACCOUNT.fullName,
    email: HISTORY_ACCOUNT.email,
    role: 'user',
  }).eq('id', userId)).error, 'update History profile')

  // createLocalAdmin has already verified localhost identity; never use these
  // real branch IDs as permission to seed or update the Production project.
  const adminIds: string[] = []
  for (const [account, role] of [[PAYMENT_SETTINGS_ADMIN, 'super_admin'], [PAYMENT_SETTINGS_STANDARD_ADMIN, 'admin']] as const) {
    const created = await admin.auth.admin.createUser({ ...account, email_confirm: true })
    assertNoError(created.error, 'create disposable payment settings actor')
    if (!created.data.user) throw new Error('disposable settings actor missing')
    adminIds.push(created.data.user.id)
    assertNoError((await admin.from('profiles').update({ role, email: account.email, full_name: 'ผู้ดูแลบัญชีทดสอบ Localhost' }).eq('id', created.data.user.id)).error, 'set disposable settings role')
  }
  assertNoError((await admin.from('branches').insert(PAYMENT_TRANSFER_DEFAULT_BRANCHES.map(branch => ({
    ...branch, address: 'Disposable database only',
  })))).error, 'insert exact payment branch roster in disposable DB')
  assertNoError((await admin.from('system_settings').upsert({ key: PAYMENT_TRANSFER_SETTING_KEY, value: HISTORY_LEGACY_TRANSFER_SETTINGS }, { onConflict: 'key' })).error, 'insert disposable legacy transfer settings')
  assertNoError((await admin.from('course_types').insert({
    id: HISTORY_IDS.course,
    name: 'kids_group',
    description: 'Disposable History payment fixture',
    max_students: 6,
    duration_hours: 2,
  })).error, 'insert History course')
  assertNoError((await admin.from('children').insert({
    id: HISTORY_IDS.child,
    parent_id: userId,
    full_name: 'นักเรียนทดสอบ History Payment',
    nickname: 'History',
    date_of_birth: '2016-01-01',
  })).error, 'insert History child')
  assertNoError((await admin.from('schedule_templates').insert({
    id: HISTORY_IDS.template,
    branch_id: HISTORY_IDS.branch,
    course_type_id: HISTORY_IDS.course,
    day_of_week: 1,
    start_time: '17:00',
    end_time: '19:00',
    is_active: true,
    notes: 'Disposable History payment fixture',
  })).error, 'insert History template')

  const dates = Array.from({ length: 10 }, (_, index) => `2026-08-${String(3 + index).padStart(2, '0')}`)
  assertNoError((await admin.from('schedule_slots').insert(dates.map((date, index) => ({
    id: fixedUuid(index + 1),
    template_id: HISTORY_IDS.template,
    branch_id: HISTORY_IDS.branch,
    course_type_id: HISTORY_IDS.course,
    date,
    start_time: '17:00',
    end_time: '19:00',
    max_students: 6,
    current_students: 0,
    status: 'open',
  })))).error, 'insert History slots')
  assertNoError((await admin.from('booking_pricing_scopes').insert({
    id: HISTORY_IDS.scope,
    user_id: userId,
    course_type_id: HISTORY_IDS.course,
    lesson_year: 2026,
    lesson_month: 8,
    currency: 'THB',
    revision: 1,
    pricing_tier_version: 'history-e2e-v1',
  })).error, 'insert History scope')

  const bookings = [
    {
      id: HISTORY_IDS.booking1,
      total_sessions: 8,
      total_price: 3464,
      entitlement_sessions: 8,
      pricing_sequence: 1,
      cumulative_sessions_before: 4,
      cumulative_sessions_after: 12,
      pricing_rate_snapshot: 433,
      gross_price_snapshot: 3464,
      final_price_snapshot: 3464,
      pricing_revision: 1,
      created_at: '2026-07-14T06:36:44Z',
    },
    {
      id: HISTORY_IDS.booking2,
      total_sessions: 2,
      total_price: 866,
      entitlement_sessions: 2,
      pricing_sequence: 2,
      cumulative_sessions_before: 12,
      cumulative_sessions_after: 14,
      pricing_rate_snapshot: 433,
      gross_price_snapshot: 866,
      final_price_snapshot: 866,
      pricing_revision: 2,
      created_at: '2026-07-14T06:39:49Z',
    },
  ]
  assertNoError((await admin.from('bookings').insert(bookings.map((booking) => ({
    ...booking,
    user_id: userId,
    learner_type: 'child',
    child_id: HISTORY_IDS.child,
    branch_id: HISTORY_IDS.branch,
    course_type_id: HISTORY_IDS.course,
    month: 8,
    year: 2026,
    status: 'pending_payment',
    pricing_scope_id: HISTORY_IDS.scope,
    coupon_discount_snapshot: 0,
    expires_at: '2026-08-31T16:59:59Z',
    pricing_calculated_at: booking.created_at,
  })))).error, 'insert History bookings')

  const legacyBookingIds = [
    HISTORY_IDS.legacyBooking1,
    HISTORY_IDS.legacyBooking2,
    HISTORY_IDS.legacyBooking3,
    HISTORY_IDS.legacyBooking4,
    HISTORY_IDS.legacyBooking5,
    HISTORY_IDS.legacyBooking6,
  ]
  const legacyAmount = 125
  assertNoError((await admin.from('bookings').insert([
    ...legacyBookingIds,
    HISTORY_IDS.legacyInvalidBooking,
  ].map((id, index) => ({
    id,
    user_id: userId,
    learner_type: 'child',
    child_id: HISTORY_IDS.child,
    branch_id: HISTORY_IDS.branch,
    course_type_id: HISTORY_IDS.course,
    month: 8,
    year: 2026,
    total_sessions: 1,
    total_price: legacyAmount,
    status: 'pending_payment',
    entitlement_sessions: 1,
    created_at: `2026-07-14T07:0${index}:00Z`,
  })))).error, 'insert Legacy History bookings')

  assertNoError((await admin.from('booking_sessions').insert(dates.map((date, index) => ({
    id: fixedUuid(100 + index),
    booking_id: index < 8 ? HISTORY_IDS.booking1 : HISTORY_IDS.booking2,
    schedule_slot_id: fixedUuid(index + 1),
    date,
    start_time: '17:00',
    end_time: '19:00',
    branch_id: HISTORY_IDS.branch,
    child_id: HISTORY_IDS.child,
    status: 'scheduled',
  })))).error, 'insert History sessions')

  const fixture: HistoryPaymentFixture = {
    userId,
    settingsAdminId: adminIds[0],
    settingsStandardAdminId: adminIds[1],
    scopeId: HISTORY_IDS.scope,
    bookingIds: [HISTORY_IDS.booking1, HISTORY_IDS.booking2],
    legacyBookingIds,
    legacyInvalidBookingId: HISTORY_IDS.legacyInvalidBooking,
    legacyAmount,
    amounts: [3464, 866],
    total: 4330,
  }
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true })
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
  return fixture
}

export function readHistoryPaymentFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as HistoryPaymentFixture
}

export async function getHistoryFixtureResidueCount() {
  const admin = createLocalAdmin()
  const fixture = readHistoryPaymentFixture()
  let residue = 0
  for (const [table, id] of [
    ['branches', HISTORY_IDS.branch],
    ['course_types', HISTORY_IDS.course],
    ['children', HISTORY_IDS.child],
    ['booking_pricing_scopes', HISTORY_IDS.scope],
    ['bookings', HISTORY_IDS.booking1],
    ['bookings', HISTORY_IDS.booking2],
    ['bookings', HISTORY_IDS.legacyBooking1],
    ['bookings', HISTORY_IDS.legacyBooking2],
    ['bookings', HISTORY_IDS.legacyBooking3],
    ['bookings', HISTORY_IDS.legacyBooking4],
    ['bookings', HISTORY_IDS.legacyBooking5],
    ['bookings', HISTORY_IDS.legacyBooking6],
    ['bookings', HISTORY_IDS.legacyInvalidBooking],
  ] as const) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('id', id)
    assertNoError(error, `count History residue ${table}`)
    residue += count || 0
  }
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  assertNoError(error, 'count History auth residue')
  residue += data.users.filter((user) => [HISTORY_ACCOUNT.email, PAYMENT_SETTINGS_ADMIN.email, PAYMENT_SETTINGS_STANDARD_ADMIN.email].includes(user.email || '')).length
  const rosterResidue = await admin.from('branches').select('id', { count: 'exact', head: true })
    .in('id', PAYMENT_TRANSFER_DEFAULT_BRANCHES.slice(1).map(branch => branch.id))
  assertNoError(rosterResidue.error, 'count payment roster fixture residue')
  residue += rosterResidue.count || 0
  const settingsResidue = await admin.from('system_settings').select('id', { count: 'exact', head: true }).eq('key', PAYMENT_TRANSFER_SETTING_KEY)
  assertNoError(settingsResidue.error, 'count payment settings residue')
  residue += settingsResidue.count || 0
  const { data: storageEntries, error: storageError } = await admin.storage
    .from('progressive-payment-slips')
    .list(`${fixture.userId}/batches`, { limit: 100, offset: 0 })
  assertNoError(storageError, 'count History storage residue')
  residue += storageEntries?.length || 0
  const { data: legacyStorageEntries, error: legacyStorageError } = await admin.storage
    .from('payment-slips')
    .list(fixture.userId, { limit: 100, offset: 0 })
  assertNoError(legacyStorageError, 'count Legacy History storage residue')
  residue += legacyStorageEntries?.length || 0
  return residue
}

export { createLocalAdmin, resetLocalDatabase, waitForLocalSupabaseAuth }
