const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')

const MARKER = 'NASC_UAT_LESSON_WALLET_V2'
const EMAIL_PREFIX = 'uat.nasc+lesson.wallet.v2.'
const PASSWORD = 'NascUat@2026'
const IDS = {
  branch: 'eb000000-0000-4000-8000-000000000101',
  adult: 'ec000000-0000-4000-8000-000000000101',
  private: 'ec000000-0000-4000-8000-000000000102',
  kids: 'ec000000-0000-4000-8000-000000000103',
}
const keepData = process.argv.includes('--keep')
const cleanupOnly = process.argv.includes('--cleanup')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing local Supabase URL or service-role key')
const parsedUrl = new URL(supabaseUrl)
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || parsedUrl.port !== '54321') {
  throw new Error(`Refusing non-local Lesson Wallet UAT endpoint: ${parsedUrl.origin}`)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function futureDate(monthsAhead, day = 12) {
  const now = new Date()
  return dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, day, 12)))
}

function dayOfWeek(value) {
  return new Date(`${value}T00:00:00Z`).getUTCDay()
}

function email(label) {
  return `${EMAIL_PREFIX}${label}@example.com`
}

async function allAuthUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...(data.users || []))
    if ((data.users || []).length < 1000) return users
  }
}

async function cleanup() {
  const profiles = await ok(await supabase.from('profiles').select('id').like('email', `${EMAIL_PREFIX}%`), 'load UAT profiles')
  const profileIds = profiles.map((row) => row.id)
  const bookings = profileIds.length
    ? await ok(await supabase.from('bookings').select('id').in('user_id', profileIds), 'load UAT bookings')
    : []
  const bookingIds = bookings.map((row) => row.id)
  const sessions = bookingIds.length
    ? await ok(await supabase.from('booking_sessions').select('id').in('booking_id', bookingIds), 'load UAT sessions')
    : []
  const sessionIds = sessions.map((row) => row.id)
  const credits = profileIds.length
    ? await ok(await supabase.from('lesson_wallet_credits').select('id').in('user_id', profileIds), 'load UAT credits')
    : []
  const creditIds = credits.map((row) => row.id)
  const templates = await ok(await supabase.from('schedule_templates').select('id').eq('notes', MARKER), 'load UAT templates')
  const templateIds = templates.map((row) => row.id)
  const slots = templateIds.length
    ? await ok(await supabase.from('schedule_slots').select('id').in('template_id', templateIds), 'load UAT slots')
    : []
  const slotIds = slots.map((row) => row.id)

  const remove = async (table, column, values) => {
    if (values.length) await ok(await supabase.from(table).delete().in(column, values), `cleanup ${table}`)
  }
  await remove('activity_logs', 'user_id', profileIds)
  await remove('activity_logs', 'entity_id', [...creditIds, ...sessionIds])
  await remove('notifications', 'user_id', profileIds)
  await remove('lesson_wallet_credits', 'id', creditIds)
  await remove('attendance', 'booking_session_id', sessionIds)
  await remove('coach_assignment_group_students', 'booking_session_id', sessionIds)
  await remove('coach_assignment_groups', 'schedule_slot_id', slotIds)
  await remove('coach_assignments', 'schedule_slot_id', slotIds)
  await remove('payments', 'booking_id', bookingIds)
  await remove('booking_sessions', 'id', sessionIds)
  await remove('bookings', 'id', bookingIds)
  await remove('children', 'parent_id', profileIds)
  await remove('coach_branches', 'coach_id', profileIds)
  await remove('schedule_slots', 'id', slotIds)
  await remove('schedule_templates', 'id', templateIds)
  await remove('pricing_tiers', 'course_type_id', [IDS.adult, IDS.private, IDS.kids])
  await remove('course_types', 'id', [IDS.adult, IDS.private, IDS.kids])
  await remove('branches', 'id', [IDS.branch])
  await remove('profiles', 'id', profileIds)

  for (const user of (await allAuthUsers()).filter((candidate) => candidate.email?.startsWith(EMAIL_PREFIX))) {
    await supabase.auth.admin.deleteUser(user.id)
  }
  return { profiles: profileIds.length, bookings: bookingIds.length, sessions: sessionIds.length, credits: creditIds.length }
}

async function createUser(label, role = 'user') {
  const accountEmail = email(label)
  const { data, error } = await supabase.auth.admin.createUser({
    email: accountEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { marker: MARKER },
  })
  if (error) throw error
  await ok(await supabase.from('profiles').upsert({
    id: data.user.id,
    email: accountEmail,
    full_name: `Wallet ${label}`,
    phone: '0800000000',
    role,
    coach_employment_type: role === 'coach' ? 'part_time' : null,
  }), `profile ${label}`)
  return data.user.id
}

async function setupMasterData() {
  await ok(await supabase.from('branches').insert({
    id: IDS.branch,
    name: 'Wallet UAT Local',
    slug: 'wallet-uat-local',
    address: MARKER,
    is_active: true,
  }), 'branch')
  await ok(await supabase.from('course_types').insert([
    { id: IDS.adult, name: 'adult_group', description: MARKER, max_students: 6, duration_hours: 2 },
    { id: IDS.private, name: 'private', description: MARKER, max_students: 6, duration_hours: 1 },
    { id: IDS.kids, name: 'kids_group', description: MARKER, max_students: 6, duration_hours: 2 },
  ]), 'course types')
  await ok(await supabase.from('pricing_tiers').insert([
    { course_type_id: IDS.adult, min_sessions: 1, max_sessions: 1, price_per_session: 600, package_price: 600, valid_from: '2020-01-01' },
    { course_type_id: IDS.adult, min_sessions: 10, max_sessions: 10, price_per_session: 550, package_price: 5500, valid_from: '2020-01-01' },
    { course_type_id: IDS.private, min_sessions: 1, max_sessions: 1, price_per_session: 900, package_price: 900, valid_from: '2020-01-01' },
    { course_type_id: IDS.private, min_sessions: 10, max_sessions: 10, price_per_session: 800, package_price: 8000, valid_from: '2020-01-01' },
    { course_type_id: IDS.kids, min_sessions: 1, max_sessions: 1, price_per_session: 700, package_price: 700, valid_from: '2020-01-01' },
  ]), 'pricing tiers')
}

async function createTemplateSlot(courseTypeId, date, start, end, { status = 'open', currentStudents = 0 } = {}) {
  const template = await ok(await supabase.from('schedule_templates').insert({
    branch_id: IDS.branch,
    course_type_id: courseTypeId,
    day_of_week: dayOfWeek(date),
    start_time: start,
    end_time: end,
    is_active: true,
    notes: MARKER,
  }).select('id').single(), 'template')
  const slot = await ok(await supabase.from('schedule_slots').insert({
    template_id: template.id,
    branch_id: IDS.branch,
    course_type_id: courseTypeId,
    date,
    start_time: start,
    end_time: end,
    status,
    current_students: currentStudents,
    max_students: 6,
  }).select('id, template_id, date, start_time, end_time, branch_id, course_type_id, status').single(), 'slot')
  return slot
}

async function createBooking({ userId, courseTypeId, totalSessions, amount, slot, childIds = [null], label }) {
  const booking = await ok(await supabase.from('bookings').insert({
    user_id: userId,
    learner_type: childIds.some(Boolean) ? 'child' : 'self',
    child_id: childIds.length === 1 ? childIds[0] : null,
    branch_id: IDS.branch,
    course_type_id: courseTypeId,
    month: Number(slot.date.slice(5, 7)),
    year: Number(slot.date.slice(0, 4)),
    total_sessions: totalSessions,
    total_price: amount,
    status: 'verified',
  }).select('id').single(), `booking ${label}`)
  const verifiedAt = new Date().toISOString()
  await ok(await supabase.from('payments').insert({
    booking_id: booking.id,
    user_id: userId,
    amount,
    method: 'transfer',
    status: 'approved',
    verified_at: verifiedAt,
    notes: MARKER,
  }), `payment ${label}`)
  const sessions = await ok(await supabase.from('booking_sessions').insert(childIds.map((childId) => ({
    booking_id: booking.id,
    schedule_slot_id: slot.id,
    date: slot.date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    branch_id: IDS.branch,
    child_id: childId,
    status: 'scheduled',
    is_makeup: false,
  }))).select('id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status'), `sessions ${label}`)
  return { booking, sessions, verifiedAt }
}

async function assignFamily(coachId, adminId, slotId, sessions, parentId) {
  const group = await ok(await supabase.from('coach_assignment_groups').insert({
    schedule_slot_id: slotId,
    coach_id: coachId,
    name: 'Wallet Family UAT',
    sort_order: 1,
    notes: MARKER,
    created_by: adminId,
  }).select('id').single(), 'family group')
  await ok(await supabase.from('coach_assignment_group_students').insert(sessions.map((session) => ({
    group_id: group.id,
    booking_session_id: session.id,
    student_id: session.child_id || parentId,
    student_type: session.child_id ? 'child' : 'adult',
  }))), 'family memberships')
  return group.id
}

async function store(userId, sessionId) {
  return supabase.rpc('lesson_wallet_store_v2', {
    p_user_id: userId,
    p_session_id: sessionId,
    p_actor_id: userId,
  })
}

async function redeem(userId, creditId, slot) {
  return supabase.rpc('lesson_wallet_redeem_v2', {
    p_user_id: userId,
    p_credit_id: creditId,
    p_target_date: slot.date,
    p_start_time: slot.start_time,
    p_end_time: slot.end_time,
    p_branch_id: slot.branch_id,
    p_schedule_template_id: slot.template_id,
  })
}

async function expectRpcCode(promise, code, label) {
  const result = await promise
  assert(result.error?.message.includes(code), `${label}: expected ${code}, got ${result.error?.message || 'success'}`)
}

async function counts(bookingIds) {
  const tableCount = async (table, bookingColumn = 'booking_id') => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).in(bookingColumn, bookingIds)
    if (error) throw error
    return count || 0
  }
  return {
    payments: await tableCount('payments'),
    coupons: await tableCount('coupon_usages'),
  }
}

async function run() {
  execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/check-lesson-wallet-regression.mjs')], {
    cwd: process.cwd(), env: { ...process.env, TZ: 'UTC' }, stdio: 'inherit',
  })
  await cleanup()
  const parentId = await createUser('parent')
  const coachId = await createUser('coach', 'coach')
  const adminId = await createUser('admin', 'super_admin')
  await setupMasterData()
  const children = await ok(await supabase.from('children').insert([
    { parent_id: parentId, full_name: 'Wallet Child A', nickname: 'A' },
    { parent_id: parentId, full_name: 'Wallet Child B', nickname: 'B' },
  ]).select('id'), 'children')

  const sourceDate = futureDate(2, 12)
  const sameMonthDate = futureDate(2, 19)
  const crossMonthDate = futureDate(3, 16)
  const adultSource = await createTemplateSlot(IDS.adult, sourceDate, '17:00', '19:00', { currentStudents: 1 })
  const adultCrossTarget = await createTemplateSlot(IDS.adult, crossMonthDate, '17:00', '19:00', { status: 'full', currentStudents: 99 })
  const adultPackage = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 10, amount: 5500, slot: adultSource, label: 'adult-package' })
  const adultStored = await ok(await store(parentId, adultPackage.sessions[0].id), 'store Adult package')
  assert(adultStored.policy_type === 'ten_month_package', 'Adult package policy must be ten_month_package')
  const adultRedeemed = await ok(await redeem(parentId, adultStored.credit_id, adultCrossTarget), 'redeem Adult cross-month')
  assert(adultRedeemed.participant_count === 1, 'Adult entitlement must move one learner')

  const adultSingleSource = await createTemplateSlot(IDS.adult, sourceDate, '13:00', '15:00')
  const adultSingleTarget = await createTemplateSlot(IDS.adult, crossMonthDate, '13:00', '15:00')
  const adultSingle = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: adultSingleSource, label: 'adult-single' })
  const adultSingleStored = await ok(await store(parentId, adultSingle.sessions[0].id), 'store Adult single')
  assert(adultSingleStored.policy_type === 'same_month', 'Adult single must remain same_month')
  await expectRpcCode(redeem(parentId, adultSingleStored.credit_id, adultSingleTarget), 'LESSON_WALLET_SAME_MONTH_REQUIRED', 'Adult single cross-month')

  const familySource = await createTemplateSlot(IDS.private, sourceDate, '10:00', '11:00', { currentStudents: 2 })
  const familyTarget = await createTemplateSlot(IDS.private, crossMonthDate, '10:00', '11:00')
  const family = await createBooking({ userId: parentId, courseTypeId: IDS.private, totalSessions: 10, amount: 8000, slot: familySource, childIds: [null, children[0].id], label: 'family-package' })
  await assignFamily(coachId, adminId, familySource.id, family.sessions, parentId)
  const familyStored = await ok(await store(parentId, family.sessions[1].id), 'store Family Private')
  assert(familyStored.unit_type === 'family_private' && familyStored.participant_count === 2, 'Family Private must be one two-person unit')
  const memberRows = await ok(await supabase.from('lesson_wallet_credit_members').select('original_session_id').eq('credit_id', familyStored.credit_id), 'family members')
  assert(memberRows.length === 2, 'Family unit must store both participant memberships')
  const familyAssignments = await ok(await supabase.from('coach_assignment_group_students').select('id').in('booking_session_id', family.sessions.map((row) => row.id)), 'retired family assignments')
  assert(familyAssignments.length === 0, 'Family store must retire every exact assignment membership')
  const familyRedeemed = await ok(await redeem(parentId, familyStored.credit_id, familyTarget), 'redeem Family cross-month')
  assert(familyRedeemed.participant_count === 2 && familyRedeemed.session_ids.length === 2, 'Family redeem must move both participants atomically')
  const movedFamily = await ok(await supabase.from('booking_sessions').select('child_id, rescheduled_from_id').in('id', familyRedeemed.session_ids), 'moved family identities')
  assert(movedFamily.some((row) => row.child_id === null) && movedFamily.some((row) => row.child_id === children[0].id), 'Family self/child identities must be preserved')
  const destinationAssignments = await ok(await supabase.from('coach_assignment_group_students').select('id').in('booking_session_id', familyRedeemed.session_ids), 'destination assignments')
  assert(destinationAssignments.length === 0, 'Redeemed destination must remain unassigned')

  const familyConflictSource = await createTemplateSlot(IDS.private, sourceDate, '12:00', '13:00')
  const familyConflictTarget = await createTemplateSlot(IDS.private, sameMonthDate, '12:00', '13:00')
  const familyConflict = await createBooking({ userId: parentId, courseTypeId: IDS.private, totalSessions: 10, amount: 8000, slot: familyConflictSource, childIds: [null, children[1].id], label: 'family-conflict' })
  const conflictStored = await ok(await store(parentId, familyConflict.sessions[0].id), 'store conflict Family')
  await createBooking({ userId: parentId, courseTypeId: IDS.private, totalSessions: 1, amount: 900, slot: familyConflictTarget, childIds: [children[1].id], label: 'participant-conflict' })
  const targetBefore = await ok(await supabase.from('booking_sessions').select('id').eq('schedule_slot_id', familyConflictTarget.id), 'target before conflict')
  await expectRpcCode(redeem(parentId, conflictStored.credit_id, familyConflictTarget), 'LESSON_WALLET_TARGET_CONFLICT', 'Family participant conflict')
  const targetAfter = await ok(await supabase.from('booking_sessions').select('id').eq('schedule_slot_id', familyConflictTarget.id), 'target after conflict')
  assert(targetAfter.length === targetBefore.length, 'Family conflict must leave zero partial-session residue')

  const concurrencySource = await createTemplateSlot(IDS.private, sourceDate, '14:00', '15:00')
  const concurrencyTarget = await createTemplateSlot(IDS.private, sameMonthDate, '14:00', '15:00')
  const concurrentFamily = await createBooking({ userId: parentId, courseTypeId: IDS.private, totalSessions: 10, amount: 8000, slot: concurrencySource, childIds: [null, children[0].id], label: 'family-concurrency' })
  const concurrentStored = await ok(await store(parentId, concurrentFamily.sessions[0].id), 'store concurrent Family')
  const race = await Promise.all([redeem(parentId, concurrentStored.credit_id, concurrencyTarget), redeem(parentId, concurrentStored.credit_id, concurrencyTarget)])
  const winners = race.filter((result) => !result.error)
  const losers = race.filter((result) => result.error?.message.includes('LESSON_WALLET_CREDIT_STALE'))
  assert(winners.length === 1 && losers.length === 1, 'Concurrent redeem must produce one success and one typed stale conflict')
  const raceSessions = await ok(await supabase.from('booking_sessions').select('id').eq('schedule_slot_id', concurrencyTarget.id), 'race sessions')
  assert(raceSessions.length === 2, 'Concurrent Family redeem must leave exactly two participant sessions')

  const privateSingleSource = await createTemplateSlot(IDS.private, sourceDate, '08:00', '09:00')
  const privateSingleTarget = await createTemplateSlot(IDS.private, crossMonthDate, '08:00', '09:00')
  const privateSingle = await createBooking({ userId: parentId, courseTypeId: IDS.private, totalSessions: 1, amount: 900, slot: privateSingleSource, label: 'private-single' })
  const privateSingleStored = await ok(await store(parentId, privateSingle.sessions[0].id), 'store Private single')
  await expectRpcCode(redeem(parentId, privateSingleStored.credit_id, privateSingleTarget), 'LESSON_WALLET_SAME_MONTH_REQUIRED', 'Private single cross-month')

  const kidsSource = await createTemplateSlot(IDS.kids, sourceDate, '16:00', '18:00')
  const kidsTarget = await createTemplateSlot(IDS.kids, crossMonthDate, '16:00', '18:00')
  const kids = await createBooking({ userId: parentId, courseTypeId: IDS.kids, totalSessions: 1, amount: 700, slot: kidsSource, childIds: [children[0].id], label: 'kids-single' })
  const kidsStored = await ok(await store(parentId, kids.sessions[0].id), 'store Kids')
  await expectRpcCode(redeem(parentId, kidsStored.credit_id, kidsTarget), 'LESSON_WALLET_SAME_MONTH_REQUIRED', 'Kids cross-month')

  const rewalletSlot = await createTemplateSlot(IDS.private, crossMonthDate, '20:00', '21:00')
  const rewalletResult = await ok(await store(parentId, familyRedeemed.session_ids[0]), 're-wallet Family')
  assert(rewalletResult.expires_at === familyStored.expires_at && rewalletResult.entitlement_started_at === familyStored.entitlement_started_at, 'Re-wallet must preserve original entitlement start and expiry')
  const rewalletRedeemed = await ok(await redeem(parentId, rewalletResult.credit_id, rewalletSlot), 'redeem re-walleted Family')
  assert(rewalletRedeemed.participant_count === 2, 'Re-wallet chain must remain one Family unit')

  const allBookingIds = [adultPackage, adultSingle, family, familyConflict, concurrentFamily, privateSingle, kids].map((item) => item.booking.id)
  const financialCounts = await counts(allBookingIds)
  assert(financialCounts.payments === allBookingIds.length, 'Wallet flow must not create additional Payment rows')
  assert(financialCounts.coupons === 0, 'Wallet flow must not create Coupon rows')

  const nearDate = dateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
  const nearSlot = await createTemplateSlot(IDS.adult, nearDate, '22:00', '23:00')
  const nearBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: nearSlot, label: 'near-cutoff' })
  await expectRpcCode(store(parentId, nearBooking.sessions[0].id), 'LESSON_WALLET_UNIT_NOT_STORABLE', '48-hour cutoff')

  const startedDate = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const startedSlot = await createTemplateSlot(IDS.adult, startedDate, '23:00', '23:30')
  const startedBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: startedSlot, label: 'started-source' })
  await expectRpcCode(store(parentId, startedBooking.sessions[0].id), 'LESSON_WALLET_UNIT_NOT_STORABLE', 'started source')

  const attendanceSlot = await createTemplateSlot(IDS.adult, sourceDate, '05:00', '06:00')
  const attendanceBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: attendanceSlot, label: 'attendance-source' })
  await ok(await supabase.from('attendance').insert({
    booking_session_id: attendanceBooking.sessions[0].id,
    student_id: parentId,
    student_type: 'adult',
    coach_id: coachId,
    status: 'present',
  }), 'attendance guard row')
  await expectRpcCode(store(parentId, attendanceBooking.sessions[0].id), 'LESSON_WALLET_ATTENDANCE_EXISTS', 'attendance source')

  const makeupSlot = await createTemplateSlot(IDS.adult, sourceDate, '06:00', '07:00')
  const makeupBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: makeupSlot, label: 'makeup-source' })
  await ok(await supabase.from('booking_sessions').update({ is_makeup: true }).eq('id', makeupBooking.sessions[0].id), 'mark makeup source')
  await expectRpcCode(store(parentId, makeupBooking.sessions[0].id), 'LESSON_WALLET_UNIT_NOT_STORABLE', 'makeup source')

  const inactiveSource = await createTemplateSlot(IDS.adult, sourceDate, '07:00', '08:00')
  const inactiveTarget = await createTemplateSlot(IDS.adult, sameMonthDate, '07:00', '08:00')
  const inactiveBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: inactiveSource, label: 'inactive-target' })
  const inactiveCredit = await ok(await store(parentId, inactiveBooking.sessions[0].id), 'store inactive-target fixture')
  await ok(await supabase.from('schedule_templates').update({ is_active: false }).eq('id', inactiveTarget.template_id), 'deactivate target template')
  await expectRpcCode(redeem(parentId, inactiveCredit.credit_id, inactiveTarget), 'LESSON_WALLET_TEMPLATE_NOT_FOUND', 'inactive template target')

  const cancelledSource = await createTemplateSlot(IDS.adult, sourceDate, '09:00', '10:00')
  const cancelledTarget = await createTemplateSlot(IDS.adult, sameMonthDate, '09:00', '10:00')
  const cancelledBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: cancelledSource, label: 'cancelled-target' })
  const cancelledCredit = await ok(await store(parentId, cancelledBooking.sessions[0].id), 'store cancelled-target fixture')
  await ok(await supabase.from('schedule_slots').update({ status: 'cancelled' }).eq('id', cancelledTarget.id), 'cancel target slot')
  await expectRpcCode(redeem(parentId, cancelledCredit.credit_id, cancelledTarget), 'LESSON_WALLET_TARGET_UNAVAILABLE', 'cancelled target')

  const missingPaymentSlot = await createTemplateSlot(IDS.adult, sourceDate, '11:00', '12:00')
  const missingPaymentBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: missingPaymentSlot, label: 'missing-payment' })
  await ok(await supabase.from('payments').delete().eq('booking_id', missingPaymentBooking.booking.id), 'remove Payment evidence')
  await expectRpcCode(store(parentId, missingPaymentBooking.sessions[0].id), 'LESSON_WALLET_PAYMENT_EVIDENCE_MISSING', 'missing Payment evidence')

  const ambiguousTierSlot = await createTemplateSlot(IDS.adult, sourceDate, '15:00', '16:00')
  const ambiguousTierBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: ambiguousTierSlot, label: 'ambiguous-tier' })
  const duplicateTier = await ok(await supabase.from('pricing_tiers').insert({
    course_type_id: IDS.adult,
    min_sessions: 1,
    max_sessions: 1,
    price_per_session: 600,
    package_price: 600,
    valid_from: '2020-01-01',
  }).select('id').single(), 'duplicate historical tier')
  await expectRpcCode(store(parentId, ambiguousTierBooking.sessions[0].id), 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS', 'overlapping tier evidence')
  await ok(await supabase.from('pricing_tiers').delete().eq('id', duplicateTier.id), 'remove duplicate tier')

  const activeOldSlot = await createTemplateSlot(IDS.adult, sourceDate, '19:00', '20:00')
  const activeOldBooking = await createBooking({ userId: parentId, courseTypeId: IDS.adult, totalSessions: 1, amount: 600, slot: activeOldSlot, label: 'old-active-credit' })
  const activeOldExpiry = `${sourceDate.slice(0, 7)}-28T16:59:59.999Z`
  const activeOld = await ok(await supabase.from('lesson_wallet_credits').insert({
    user_id: parentId,
    booking_id: activeOldBooking.booking.id,
    original_session_id: activeOldBooking.sessions[0].id,
    child_id: null,
    branch_id: IDS.branch,
    course_type_id: IDS.adult,
    original_schedule_slot_id: activeOldSlot.id,
    original_date: activeOldSlot.date,
    original_start_time: activeOldSlot.start_time,
    original_end_time: activeOldSlot.end_time,
    status: 'active',
    expires_at: activeOldExpiry,
    notes: MARKER,
  }).select('id, status, expires_at').single(), 'old active credit')
  const activeOldAfter = await ok(await supabase.from('lesson_wallet_credits').select('status, expires_at, entitlement_policy').eq('id', activeOld.id).single(), 'old active unchanged')
  assert(
    activeOldAfter.status === 'active'
      && new Date(activeOldAfter.expires_at).getTime() === new Date(activeOldExpiry).getTime()
      && activeOldAfter.entitlement_policy === null,
    'Existing active credit must retain stored expiry and null new evidence',
  )

  const expiredOld = await ok(await supabase.from('lesson_wallet_credits').insert({
    user_id: parentId,
    booking_id: adultSingle.booking.id,
    original_session_id: adultRedeemed.representative_session_id,
    child_id: null,
    branch_id: IDS.branch,
    course_type_id: IDS.adult,
    original_schedule_slot_id: adultCrossTarget.id,
    original_date: adultCrossTarget.date,
    original_start_time: adultCrossTarget.start_time,
    original_end_time: adultCrossTarget.end_time,
    status: 'expired',
    expires_at: '2020-01-31T16:59:59.999Z',
    expired_at: '2020-02-01T00:00:00.000Z',
    notes: MARKER,
  }).select('id, status, expires_at').single(), 'old expired credit')
  const expiredOldAfter = await ok(await supabase.from('lesson_wallet_credits').select('status, expires_at').eq('id', expiredOld.id).single(), 'old expired unchanged')
  assert(expiredOldAfter.status === 'expired' && expiredOldAfter.expires_at === expiredOld.expires_at, 'Existing expired credit must remain expired and unchanged')

  console.log('PASS Local endpoint guard and clean migration schema')
  console.log('PASS Adult package cross-month; Adult/Private single and Kids same-month')
  console.log('PASS Family Private self+child is one atomic hour unit with preserved identities')
  console.log('PASS Participant conflict rollback and concurrent one-winner/one-stale behavior leave zero residue')
  console.log('PASS Re-wallet preserves original entitlement start/expiry and moves the whole Family unit')
  console.log('PASS Assignment retirement, destination unassigned, over-capacity allowed, and no new Payment/Coupon/Ledger')
  console.log('PASS Store guards: 48-hour cutoff, started, attendance, and makeup')
  console.log('PASS Redeem guards: inactive template, cancelled target, same-month, expiry, and participant overlap')
  console.log('PASS Missing Payment and overlapping tier evidence fail closed; existing active/expired credits remain unchanged')

  if (!keepData) {
    const residue = await cleanup()
    console.log(`PASS Cleanup complete: ${JSON.stringify(residue)}`)
    const remaining = await ok(await supabase.from('profiles').select('id').like('email', `${EMAIL_PREFIX}%`), 'residue check')
    assert(remaining.length === 0, 'Local fixture residue must be zero')
    console.log('PASS Local fixture residue: 0 profiles')
  }
}

async function main() {
  if (cleanupOnly) {
    console.log(JSON.stringify(await cleanup()))
    return
  }
  await run()
}

main().catch(async (error) => {
  console.error(`FAIL ${error.message}`)
  if (!keepData) {
    try { await cleanup() } catch (cleanupError) { console.error(`Cleanup failed: ${cleanupError.message}`) }
  }
  process.exit(1)
})
