const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const UAT_PREFIX = 'uat.nasc+lesson.wallet.'
const UAT_DOMAIN = 'example.com'
const UAT_PASSWORD = 'NascUat@2026'
const UAT_MARKER = 'NASC_UAT_LESSON_WALLET'
const STORE_CUTOFF_HOURS = 48
const keepData = process.argv.includes('--keep')
const cleanupOnly = process.argv.includes('--cleanup')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function email(key) {
  return `${UAT_PREFIX}${key}@${UAT_DOMAIN}`
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0)
}

function addDays(dateInput, days) {
  const [year, month, day] = dateInput.split('-').map(Number)
  const date = localDate(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function nextUatMonthDates() {
  const now = new Date()
  const baseMonth = now.getDate() <= 18 ? now.getMonth() : now.getMonth() + 1
  const baseYear = now.getFullYear() + Math.floor(baseMonth / 12)
  const normalizedMonth = baseMonth % 12

  return {
    originalDate: formatDate(localDate(baseYear, normalizedMonth, 5)),
    targetDate: formatDate(localDate(baseYear, normalizedMonth, 7)),
    duplicateDate: formatDate(localDate(baseYear, normalizedMonth, 9)),
    rewalletDate: formatDate(localDate(baseYear, normalizedMonth, 10)),
    expireDate: formatDate(localDate(baseYear, normalizedMonth, 11)),
    conflictDate: formatDate(localDate(baseYear, normalizedMonth, 12)),
    nearDate: addDays(formatDate(now), 1),
    wrongMonthDate: formatDate(localDate(baseYear, normalizedMonth + 1, 5)),
  }
}

function dayOfWeek(dateInput) {
  const [year, month, day] = dateInput.split('-').map(Number)
  return localDate(year, month - 1, day).getDay()
}

function normalizeTime(value) {
  return value.length === 5 ? `${value}:00` : value
}

function shortTime(value) {
  return value.slice(0, 5)
}

function sessionStart(date, time) {
  return new Date(`${date}T${shortTime(time)}:00+07:00`)
}

function isAtLeastHoursAhead(date, time, hours) {
  return sessionStart(date, time).getTime() - Date.now() >= hours * 60 * 60 * 1000
}

function monthKey(date) {
  return date.slice(0, 7)
}

function getMonthEndIso(date) {
  const [year, month] = date.split('-').map(Number)
  const nextMonthStart = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00+07:00`)
    : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+07:00`)
  return new Date(nextMonthStart.getTime() - 1).toISOString()
}

async function expectNoError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message)
}

async function listAllAuthUsers() {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...(data?.users || []))
    if (!data?.users || data.users.length < perPage) break
    page += 1
  }

  return users
}

async function deleteWhereIn(table, column, values) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  if (!uniqueValues.length) return
  await expectNoError(await supabase.from(table).delete().in(column, uniqueValues), `delete ${table}`)
}

async function cleanupUatData({ deleteAuthUsers = true } = {}) {
  const uatProfiles = await expectNoError(
    await supabase.from('profiles').select('id, email').like('email', `${UAT_PREFIX}%`),
    'fetch uat profiles',
  )
  const profileIds = (uatProfiles || []).map((profile) => profile.id)

  const uatTemplates = await expectNoError(
    await supabase.from('schedule_templates').select('id').eq('notes', UAT_MARKER),
    'fetch uat schedule templates',
  )
  const templateIds = (uatTemplates || []).map((template) => template.id)

  const slotIds = templateIds.length
    ? (await expectNoError(
      await supabase.from('schedule_slots').select('id').in('template_id', templateIds),
      'fetch uat schedule slots',
    )).map((slot) => slot.id)
    : []

  const bookingIds = profileIds.length
    ? (await expectNoError(
      await supabase.from('bookings').select('id').in('user_id', profileIds),
      'fetch uat bookings',
    )).map((booking) => booking.id)
    : []

  const sessionIds = []
  if (bookingIds.length) {
    const sessionsByBooking = await expectNoError(
      await supabase.from('booking_sessions').select('id').in('booking_id', bookingIds),
      'fetch uat sessions by booking',
    )
    sessionIds.push(...sessionsByBooking.map((session) => session.id))
  }
  if (slotIds.length) {
    const sessionsBySlot = await expectNoError(
      await supabase.from('booking_sessions').select('id').in('schedule_slot_id', slotIds),
      'fetch uat sessions by slot',
    )
    sessionIds.push(...sessionsBySlot.map((session) => session.id))
  }

  const uniqueSessionIds = Array.from(new Set(sessionIds))
  const walletCreditIds = profileIds.length
    ? (await expectNoError(
      await supabase.from('lesson_wallet_credits').select('id').in('user_id', profileIds),
      'fetch uat wallet credits by user',
    )).map((credit) => credit.id)
    : []

  await deleteWhereIn('activity_logs', 'user_id', profileIds)
  await deleteWhereIn('activity_logs', 'entity_id', uniqueSessionIds)
  await deleteWhereIn('activity_logs', 'entity_id', walletCreditIds)
  await deleteWhereIn('notifications', 'user_id', profileIds)
  await deleteWhereIn('lesson_wallet_credits', 'id', walletCreditIds)
  await deleteWhereIn('attendance', 'booking_session_id', uniqueSessionIds)
  await deleteWhereIn('payments', 'booking_id', bookingIds)
  await deleteWhereIn('coach_checkins', 'schedule_slot_id', slotIds)
  await deleteWhereIn('coach_assignment_group_students', 'booking_session_id', uniqueSessionIds)
  await deleteWhereIn('coach_assignment_groups', 'schedule_slot_id', slotIds)
  await deleteWhereIn('coach_assignments', 'schedule_slot_id', slotIds)
  await deleteWhereIn('booking_sessions', 'id', uniqueSessionIds)
  await deleteWhereIn('bookings', 'id', bookingIds)
  await deleteWhereIn('children', 'parent_id', profileIds)
  await deleteWhereIn('coach_branches', 'coach_id', profileIds)
  await deleteWhereIn('schedule_slots', 'id', slotIds)
  await deleteWhereIn('schedule_templates', 'id', templateIds)
  await deleteWhereIn('profiles', 'id', profileIds)

  if (deleteAuthUsers) {
    const authUsers = await listAllAuthUsers()
    const uatAuthUsers = authUsers.filter((user) => user.email?.toLowerCase().startsWith(UAT_PREFIX))
    for (const user of uatAuthUsers) {
      await supabase.auth.admin.deleteUser(user.id)
    }
  }

  return {
    profiles: profileIds.length,
    slots: slotIds.length,
    sessions: uniqueSessionIds.length,
    walletCredits: walletCreditIds.length,
  }
}

async function ensureAuthUser(account, authUsers) {
  const existing = authUsers.find((user) => user.email?.toLowerCase() === account.email.toLowerCase())

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: UAT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, marker: UAT_MARKER },
    })
    if (error) throw error
    return existing.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: UAT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: account.fullName, marker: UAT_MARKER },
  })
  if (error) throw error
  authUsers.push(data.user)
  return data.user.id
}

async function createProfiles() {
  const accounts = [
    { key: 'admin', email: email('admin'), fullName: 'UAT Wallet Admin', role: 'super_admin' },
    { key: 'coach', email: email('coach'), fullName: 'UAT Wallet Coach', role: 'coach', coach_employment_type: 'part_time' },
    { key: 'parent', email: email('parent'), fullName: 'UAT Wallet Parent', role: 'user' },
  ]
  const authUsers = await listAllAuthUsers()
  const ids = {}

  for (const account of accounts) {
    ids[account.key] = await ensureAuthUser(account, authUsers)
  }

  await expectNoError(
    await supabase.from('profiles').upsert(accounts.map((account) => ({
      id: ids[account.key],
      email: account.email,
      full_name: account.fullName,
      phone: '080-999-2026',
      role: account.role,
      coach_employment_type: account.coach_employment_type || null,
      avatar_url: null,
    }))),
    'upsert uat profiles',
  )

  return ids
}

async function selectMasterData() {
  const branch = await expectNoError(
    await supabase.from('branches').select('id, name').eq('is_active', true).order('created_at', { ascending: true }).limit(1).single(),
    'fetch active branch',
  )
  const courseType = await expectNoError(
    await supabase.from('course_types').select('id, name').eq('name', 'kids_group').single(),
    'fetch kids_group course type',
  )

  return { branch, courseType }
}

async function createChild(parentId, suffix = '') {
  return expectNoError(
    await supabase.from('children').insert({
      parent_id: parentId,
      full_name: `UAT Wallet Child${suffix ? ` ${suffix}` : ''}`,
      nickname: suffix ? `Wallet Kid ${suffix}` : 'Wallet Kid',
    }).select('id, full_name').single(),
    'create uat child',
  )
}

async function createTemplateAndSlot({ branchId, courseTypeId, date, startTime, endTime, currentStudents = 0, maxStudents = 6 }) {
  const template = await expectNoError(
    await supabase.from('schedule_templates').insert({
      branch_id: branchId,
      course_type_id: courseTypeId,
      day_of_week: dayOfWeek(date),
      start_time: normalizeTime(startTime),
      end_time: normalizeTime(endTime),
      is_active: true,
      notes: UAT_MARKER,
    }).select('id').single(),
    `create template ${date}`,
  )

  const slot = await expectNoError(
    await supabase.from('schedule_slots').insert({
      template_id: template.id,
      branch_id: branchId,
      course_type_id: courseTypeId,
      date,
      start_time: normalizeTime(startTime),
      end_time: normalizeTime(endTime),
      max_students: maxStudents,
      current_students: currentStudents,
      status: 'open',
    }).select('id, template_id, branch_id, course_type_id, date, start_time, end_time, current_students, max_students').single(),
    `create slot ${date}`,
  )

  return slot
}

async function createVerifiedBookingWithSession({ userId, childId, branchId, courseTypeId, slot, label }) {
  const booking = await expectNoError(
    await supabase.from('bookings').insert({
      user_id: userId,
      learner_type: 'child',
      child_id: childId,
      branch_id: branchId,
      course_type_id: courseTypeId,
      month: Number(slot.date.slice(5, 7)),
      year: Number(slot.date.slice(0, 4)),
      total_sessions: 1,
      total_price: 700,
      status: 'verified',
    }).select('id').single(),
    `create booking ${label}`,
  )

  await expectNoError(
    await supabase.from('payments').insert({
      booking_id: booking.id,
      user_id: userId,
      amount: 700,
      method: 'transfer',
      slip_image_url: `uat://${UAT_MARKER}/${label}.jpg`,
      status: 'approved',
      verified_by: userId,
      verified_at: new Date().toISOString(),
      notes: UAT_MARKER,
    }),
    `create verified payment ${label}`,
  )

  const session = await expectNoError(
    await supabase.from('booking_sessions').insert({
      booking_id: booking.id,
      schedule_slot_id: slot.id,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      branch_id: branchId,
      child_id: childId,
      status: 'scheduled',
      is_makeup: false,
    }).select('id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status').single(),
    `create booking session ${label}`,
  )

  return { booking, session }
}

async function assignCoach({ coachId, adminId, slotId, session, childId }) {
  await expectNoError(
    await supabase.from('coach_assignments').insert({
      coach_id: coachId,
      schedule_slot_id: slotId,
      assigned_by: adminId,
    }),
    'create uat legacy coach assignment',
  )

  const group = await expectNoError(
    await supabase.from('coach_assignment_groups').insert({
      schedule_slot_id: slotId,
      coach_id: coachId,
      name: 'UAT Wallet Assigned Group',
      level_min: 0,
      level_max: 20,
      sort_order: 1,
      notes: UAT_MARKER,
      created_by: adminId,
    }).select('id').single(),
    'create uat coach assignment group',
  )

  const student = await expectNoError(
    await supabase.from('coach_assignment_group_students').insert({
      group_id: group.id,
      booking_session_id: session.id,
      student_id: childId,
      student_type: 'child',
    }).select('id').single(),
    'create uat assignment group student',
  )

  return { group, student }
}

async function assignCoachGroup({ coachId, adminId, slotId, students, groupName }) {
  const existingAssignment = await expectNoError(
    await supabase.from('coach_assignments').select('schedule_slot_id').eq('coach_id', coachId).eq('schedule_slot_id', slotId).maybeSingle(),
    `check uat legacy coach assignment ${groupName}`,
  )
  if (!existingAssignment) {
    await expectNoError(
      await supabase.from('coach_assignments').insert({
        coach_id: coachId,
        schedule_slot_id: slotId,
        assigned_by: adminId,
      }),
      `create uat legacy coach assignment ${groupName}`,
    )
  }

  const group = await expectNoError(
    await supabase.from('coach_assignment_groups').insert({
      schedule_slot_id: slotId,
      coach_id: coachId,
      name: groupName,
      level_min: 0,
      level_max: 20,
      sort_order: 1,
      notes: UAT_MARKER,
      created_by: adminId,
    }).select('id').single(),
    `create uat coach assignment group ${groupName}`,
  )

  await expectNoError(
    await supabase.from('coach_assignment_group_students').insert(students.map(({ session, childId }) => ({
      group_id: group.id,
      booking_session_id: session.id,
      student_id: childId,
      student_type: 'child',
    }))),
    `create uat assignment group students ${groupName}`,
  )

  return group
}

async function createCreditFromSession({ userId, session, courseTypeId, bookingId }) {
  return expectNoError(
    await supabase.from('lesson_wallet_credits').insert({
      user_id: userId,
      booking_id: bookingId,
      original_session_id: session.id,
      child_id: session.child_id,
      branch_id: session.branch_id,
      course_type_id: courseTypeId,
      original_schedule_slot_id: session.schedule_slot_id,
      original_date: session.date,
      original_start_time: session.start_time,
      original_end_time: session.end_time,
      status: 'active',
      expires_at: getMonthEndIso(session.date),
      notes: UAT_MARKER,
    }).select('id, status, expires_at').single(),
    'create wallet credit',
  )
}

async function storeSessionInWallet({ userId, session, courseTypeId, bookingId }) {
  assertCondition(isAtLeastHoursAhead(session.date, session.start_time, STORE_CUTOFF_HOURS), 'Store cutoff guard failed for valid future session')

  const attendance = await expectNoError(
    await supabase.from('attendance').select('id').eq('booking_session_id', session.id),
    'check no attendance',
  )
  assertCondition(attendance.length === 0, 'Expected no attendance before storing')

  const assignmentRows = await expectNoError(
    await supabase
      .from('coach_assignment_group_students')
      .select('id')
      .eq('booking_session_id', session.id),
    'fetch assignment students before store',
  )
  assertCondition(assignmentRows.length === 1, 'Expected assigned student before storing')

  const credit = await createCreditFromSession({ userId, session, courseTypeId, bookingId })

  await expectNoError(
    await supabase.from('booking_sessions').update({ status: 'walleted' }).eq('id', session.id),
    'mark session walleted',
  )
  const originalSlot = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', session.schedule_slot_id).single(),
    'fetch slot for decrement',
  )
  await expectNoError(
    await supabase
      .from('schedule_slots')
      .update({ current_students: Math.max(0, Number(originalSlot.current_students || 0) - 1) })
      .eq('id', session.schedule_slot_id),
    'decrement original slot students',
  )
  await expectNoError(
    await supabase.from('coach_assignment_group_students').delete().in('id', assignmentRows.map((row) => row.id)),
    'remove assignment student from stored session',
  )

  return credit
}

async function redeemCredit({ credit, original, targetSlot, userId }) {
  assertCondition(monthKey(original.session.date) === monthKey(targetSlot.date), 'Redeem same-month guard failed')
  assertCondition(sessionStart(targetSlot.date, targetSlot.start_time).getTime() > Date.now(), 'Redeem future-slot guard failed')

  const duplicateRows = await expectNoError(
    await supabase
      .from('booking_sessions')
      .select('id, status, bookings!inner(course_type_id)')
      .eq('date', targetSlot.date)
      .eq('start_time', targetSlot.start_time)
      .eq('end_time', targetSlot.end_time)
      .eq('branch_id', targetSlot.branch_id)
      .eq('bookings.course_type_id', targetSlot.course_type_id)
      .eq('child_id', original.session.child_id),
    'check duplicate learner before redeem',
  )
  assertCondition(duplicateRows.every((session) => ['rescheduled', 'walleted'].includes(session.status)), 'Duplicate learner guard failed')

  const targetBefore = await expectNoError(
    await supabase.from('schedule_slots').select('current_students, max_students').eq('id', targetSlot.id).single(),
    'fetch target slot before redeem',
  )
  assertCondition(Number(targetBefore.current_students) < Number(targetBefore.max_students), 'Target slot capacity guard failed')

  const newSession = await expectNoError(
    await supabase.from('booking_sessions').insert({
      booking_id: original.booking.id,
      schedule_slot_id: targetSlot.id,
      date: targetSlot.date,
      start_time: targetSlot.start_time,
      end_time: targetSlot.end_time,
      branch_id: original.session.branch_id,
      child_id: original.session.child_id,
      status: 'scheduled',
      rescheduled_from_id: original.session.id,
      is_makeup: false,
    }).select('id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status, rescheduled_from_id').single(),
    'create redeemed session',
  )

  await expectNoError(
    await supabase.from('schedule_slots').update({ current_students: Number(targetBefore.current_students || 0) + 1 }).eq('id', targetSlot.id),
    'increment target slot students',
  )
  await expectNoError(
    await supabase.from('lesson_wallet_credits').update({
      status: 'redeemed',
      redeemed_session_id: newSession.id,
      redeemed_at: new Date().toISOString(),
    }).eq('id', credit.id).eq('status', 'active'),
    'redeem wallet credit',
  )

  await expectNoError(
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'redeem_lesson_wallet_credit',
      entity_type: 'lesson_wallet_credits',
      entity_id: credit.id,
      details: {
        marker: UAT_MARKER,
        originalSessionId: original.session.id,
        newSessionId: newSession.id,
        targetSlotId: targetSlot.id,
      },
    }),
    'write redeem activity',
  )

  return newSession
}

async function assertDuplicateRedeemBlocked({ parentId, childId, branchId, courseTypeId, bookedSlot, targetSlot }) {
  await createVerifiedBookingWithSession({
    userId: parentId,
    childId,
    branchId,
    courseTypeId,
    slot: bookedSlot,
    label: 'same-time-conflict',
  })

  const duplicateRows = await expectNoError(
    await supabase
      .from('booking_sessions')
      .select('id, status, bookings!inner(course_type_id)')
      .eq('date', targetSlot.date)
      .eq('start_time', targetSlot.start_time)
      .eq('end_time', targetSlot.end_time)
      .eq('branch_id', targetSlot.branch_id)
      .eq('bookings.course_type_id', targetSlot.course_type_id)
      .eq('child_id', childId),
    'check same-time duplicate learner before redeem',
  )

  const hasBlockingDuplicate = duplicateRows.some((session) => !['rescheduled', 'walleted'].includes(session.status))
  assertCondition(hasBlockingDuplicate, 'Same-time duplicate guard should block wallet redeem')
}

async function assertStoreBlockedCases({ parentId, childId, branchId, courseTypeId, nearSlot, duplicateSlot, expireSlot }) {
  const near = await createVerifiedBookingWithSession({
    userId: parentId,
    childId,
    branchId,
    courseTypeId,
    slot: nearSlot,
    label: 'near-cutoff',
  })
  assertCondition(!isAtLeastHoursAhead(near.session.date, near.session.start_time, STORE_CUTOFF_HOURS), 'Near session should be blocked by 48-hour guard')

  const attended = await createVerifiedBookingWithSession({
    userId: parentId,
    childId,
    branchId,
    courseTypeId,
    slot: duplicateSlot,
    label: 'attended',
  })
  await expectNoError(
    await supabase.from('attendance').insert({
      booking_session_id: attended.session.id,
      student_id: childId,
      student_type: 'child',
      coach_id: parentId,
      status: 'present',
      checked_at: new Date().toISOString(),
    }),
    'create attendance block row',
  )
  const attendance = await expectNoError(
    await supabase.from('attendance').select('id').eq('booking_session_id', attended.session.id),
    'verify attendance block row',
  )
  assertCondition(attendance.length === 1, 'Attendance guard setup failed')

  const expiring = await createVerifiedBookingWithSession({
    userId: parentId,
    childId,
    branchId,
    courseTypeId,
    slot: expireSlot,
    label: 'expired-credit',
  })
  const expiredCredit = await expectNoError(
    await supabase.from('lesson_wallet_credits').insert({
      user_id: parentId,
      booking_id: expiring.booking.id,
      original_session_id: expiring.session.id,
      child_id: childId,
      branch_id: branchId,
      course_type_id: courseTypeId,
      original_schedule_slot_id: expireSlot.id,
      original_date: expiring.session.date,
      original_start_time: expiring.session.start_time,
      original_end_time: expiring.session.end_time,
      status: 'active',
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      notes: UAT_MARKER,
    }).select('id').single(),
    'create expired active credit',
  )
  await expectNoError(
    await supabase
      .from('lesson_wallet_credits')
      .update({ status: 'expired', expired_at: new Date().toISOString() })
      .eq('id', expiredCredit.id)
      .lt('expires_at', new Date().toISOString()),
    'expire due credit',
  )
}

async function runUat() {
  await cleanupUatData()

  const ids = await createProfiles()
  const { branch, courseType } = await selectMasterData()
  const child = await createChild(ids.parent)
  const child2 = await createChild(ids.parent, 'B')
  const child3 = await createChild(ids.parent, 'C')
  const child4 = await createChild(ids.parent, 'D')
  const child5 = await createChild(ids.parent, 'E')
  await expectNoError(
    await supabase.from('coach_branches').insert({
      coach_id: ids.coach,
      branch_id: branch.id,
      is_head_coach: false,
    }),
    'create uat coach branch',
  )

  const dates = nextUatMonthDates()
  const originalSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.originalDate,
    startTime: '17:00',
    endTime: '19:00',
    currentStudents: 1,
  })
  const targetSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.targetDate,
    startTime: '17:00',
    endTime: '19:00',
  })
  const duplicateSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.duplicateDate,
    startTime: '17:00',
    endTime: '19:00',
  })
  const rewalletSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.rewalletDate,
    startTime: '17:00',
    endTime: '19:00',
  })
  const nearSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.nearDate,
    startTime: '23:00',
    endTime: '23:30',
  })
  const expireSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.expireDate,
    startTime: '15:00',
    endTime: '16:00',
  })
  const conflictBookedSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.conflictDate,
    startTime: '17:00',
    endTime: '19:00',
  })
  const sharedGroupSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.originalDate,
    startTime: '13:00',
    endTime: '15:00',
    currentStudents: 3,
  })
  const splitGroupSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.targetDate,
    startTime: '13:00',
    endTime: '15:00',
    currentStudents: 2,
  })
  const wrongMonthSlot = await createTemplateAndSlot({
    branchId: branch.id,
    courseTypeId: courseType.id,
    date: dates.wrongMonthDate,
    startTime: '17:00',
    endTime: '19:00',
  })

  const original = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: originalSlot,
    label: 'original',
  })
  const originalAssignment = await assignCoach({
    coachId: ids.coach,
    adminId: ids.admin,
    slotId: originalSlot.id,
    session: original.session,
    childId: child.id,
  })

  const sharedOne = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: sharedGroupSlot,
    label: 'shared-group-1',
  })
  const sharedTwo = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child2.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: sharedGroupSlot,
    label: 'shared-group-2',
  })
  const sharedThree = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child3.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: sharedGroupSlot,
    label: 'shared-group-3',
  })
  const sharedGroup = await assignCoachGroup({
    coachId: ids.coach,
    adminId: ids.admin,
    slotId: sharedGroupSlot.id,
    groupName: 'UAT Wallet Shared Group',
    students: [
      { session: sharedOne.session, childId: child.id },
      { session: sharedTwo.session, childId: child2.id },
      { session: sharedThree.session, childId: child3.id },
    ],
  })

  const splitOne = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child4.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: splitGroupSlot,
    label: 'split-group-1',
  })
  const splitTwo = await createVerifiedBookingWithSession({
    userId: ids.parent,
    childId: child5.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    slot: splitGroupSlot,
    label: 'split-group-2',
  })
  const emptiedGroup = await assignCoachGroup({
    coachId: ids.coach,
    adminId: ids.admin,
    slotId: splitGroupSlot.id,
    groupName: 'UAT Wallet Emptied Group',
    students: [{ session: splitOne.session, childId: child4.id }],
  })
  const remainingSplitGroup = await assignCoachGroup({
    coachId: ids.coach,
    adminId: ids.admin,
    slotId: splitGroupSlot.id,
    groupName: 'UAT Wallet Remaining Group',
    students: [{ session: splitTwo.session, childId: child5.id }],
  })

  await storeSessionInWallet({
    userId: ids.parent,
    session: sharedOne.session,
    courseTypeId: courseType.id,
    bookingId: sharedOne.booking.id,
  })
  const sharedGroupRowsAfterStore = await expectNoError(
    await supabase.from('coach_assignment_group_students').select('id, booking_session_id').eq('group_id', sharedGroup.id),
    'verify shared group after wallet store',
  )
  const sharedSlotAfterStore = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', sharedGroupSlot.id).single(),
    'verify shared slot count after wallet store',
  )
  assertCondition(sharedGroupRowsAfterStore.length === 2, 'Shared assigned group should keep the remaining learners after one wallet store')
  assertCondition(Number(sharedSlotAfterStore.current_students) === 2, 'Shared slot count should decrement to remaining learners only')

  await storeSessionInWallet({
    userId: ids.parent,
    session: splitOne.session,
    courseTypeId: courseType.id,
    bookingId: splitOne.booking.id,
  })
  const emptiedGroupRowsAfterStore = await expectNoError(
    await supabase.from('coach_assignment_group_students').select('id').eq('group_id', emptiedGroup.id),
    'verify emptied group after wallet store',
  )
  const remainingSplitGroupRows = await expectNoError(
    await supabase.from('coach_assignment_group_students').select('id').eq('group_id', remainingSplitGroup.id),
    'verify other split group remains assigned',
  )
  const splitSlotAfterStore = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', splitGroupSlot.id).single(),
    'verify split slot count after wallet store',
  )
  assertCondition(emptiedGroupRowsAfterStore.length === 0, 'Emptied group should be auditable but contain no active learners')
  assertCondition(remainingSplitGroupRows.length === 1, 'Other assigned group in the same slot should remain untouched')
  assertCondition(Number(splitSlotAfterStore.current_students) === 1, 'Split slot count should keep the remaining learner')

  const credit = await storeSessionInWallet({
    userId: ids.parent,
    session: original.session,
    courseTypeId: courseType.id,
    bookingId: original.booking.id,
  })

  const storedSession = await expectNoError(
    await supabase.from('booking_sessions').select('status').eq('id', original.session.id).single(),
    'verify walleted session',
  )
  const originalSlotAfterStore = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', originalSlot.id).single(),
    'verify original slot count after store',
  )
  const assignmentAfterStore = await expectNoError(
    await supabase.from('coach_assignment_group_students').select('id').eq('booking_session_id', original.session.id),
    'verify assignment removed after store',
  )
  const originalAssignmentGroupStillExists = await expectNoError(
    await supabase.from('coach_assignment_groups').select('id').eq('id', originalAssignment.group.id).single(),
    'verify emptied original assignment group remains auditable',
  )
  assertCondition(storedSession.status === 'walleted', 'Original session was not marked walleted')
  assertCondition(Number(originalSlotAfterStore.current_students) === 0, 'Original slot count was not decremented')
  assertCondition(assignmentAfterStore.length === 0, 'Stored learner was not removed from coach group')
  assertCondition(Boolean(originalAssignmentGroupStillExists.id), 'Empty assignment group should remain for audit instead of being deleted')

  assertCondition(monthKey(original.session.date) !== monthKey(wrongMonthSlot.date), 'Wrong-month test slot is not in another month')
  const redeemedSession = await redeemCredit({
    credit,
    original,
    targetSlot,
    userId: ids.parent,
  })

  const finalCredit = await expectNoError(
    await supabase.from('lesson_wallet_credits').select('status, redeemed_session_id').eq('id', credit.id).single(),
    'verify redeemed credit',
  )
  const finalTargetSlot = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', targetSlot.id).single(),
    'verify target slot count after redeem',
  )
  const { count: paymentCount, error: paymentCountError } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', original.booking.id)
  if (paymentCountError) throw new Error(`verify payment count: ${paymentCountError.message}`)
  assertCondition(finalCredit.status === 'redeemed', 'Credit was not marked redeemed')
  assertCondition(finalCredit.redeemed_session_id === redeemedSession.id, 'Redeemed session id was not linked')
  assertCondition(redeemedSession.booking_id === original.booking.id, 'Redeemed session did not reuse original booking')
  assertCondition(redeemedSession.rescheduled_from_id === original.session.id, 'Redeemed session did not reference original session')
  assertCondition(Number(finalTargetSlot.current_students) === 1, 'Target slot count was not incremented')
  assertCondition(paymentCount === 1, 'Redeem flow should reuse the original paid booking without creating another payment')

  await assignCoach({
    coachId: ids.coach,
    adminId: ids.admin,
    slotId: targetSlot.id,
    session: redeemedSession,
    childId: child.id,
  })
  const rewalletCredit = await storeSessionInWallet({
    userId: ids.parent,
    session: redeemedSession,
    courseTypeId: courseType.id,
    bookingId: original.booking.id,
  })
  const targetSlotAfterRewallet = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', targetSlot.id).single(),
    'verify target slot count after re-wallet',
  )
  const rewalletAssignmentAfterStore = await expectNoError(
    await supabase.from('coach_assignment_group_students').select('id').eq('booking_session_id', redeemedSession.id),
    'verify redeemed assignment removed after re-wallet',
  )
  assertCondition(Number(targetSlotAfterRewallet.current_students) === 0, 'Re-wallet did not decrement the redeemed target slot')
  assertCondition(rewalletAssignmentAfterStore.length === 0, 'Re-wallet did not remove learner from assigned coach group')

  const secondRedeemedSession = await redeemCredit({
    credit: rewalletCredit,
    original: { booking: original.booking, session: redeemedSession },
    targetSlot: rewalletSlot,
    userId: ids.parent,
  })
  const finalRewalletCredit = await expectNoError(
    await supabase.from('lesson_wallet_credits').select('status, redeemed_session_id').eq('id', rewalletCredit.id).single(),
    'verify re-wallet credit redeemed',
  )
  const finalRewalletTargetSlot = await expectNoError(
    await supabase.from('schedule_slots').select('current_students').eq('id', rewalletSlot.id).single(),
    'verify re-wallet target slot count',
  )
  const { count: rewalletPaymentCount, error: rewalletPaymentCountError } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', original.booking.id)
  if (rewalletPaymentCountError) throw new Error(`verify re-wallet payment count: ${rewalletPaymentCountError.message}`)
  assertCondition(finalRewalletCredit.status === 'redeemed', 'Re-wallet credit was not marked redeemed')
  assertCondition(finalRewalletCredit.redeemed_session_id === secondRedeemedSession.id, 'Re-wallet redeemed session id was not linked')
  assertCondition(secondRedeemedSession.booking_id === original.booking.id, 'Second redeemed session did not reuse original booking')
  assertCondition(secondRedeemedSession.rescheduled_from_id === redeemedSession.id, 'Second redeemed session did not reference the re-walleted session')
  assertCondition(Number(finalRewalletTargetSlot.current_students) === 1, 'Re-wallet target slot count was not incremented')
  assertCondition(rewalletPaymentCount === 1, 'Re-wallet flow should not create another payment')

  await assertStoreBlockedCases({
    parentId: ids.parent,
    childId: child.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    nearSlot,
    duplicateSlot,
    expireSlot,
  })
  await assertDuplicateRedeemBlocked({
    parentId: ids.parent,
    childId: child.id,
    branchId: branch.id,
    courseTypeId: courseType.id,
    bookedSlot: conflictBookedSlot,
    targetSlot: conflictBookedSlot,
  })

  console.log('PASS Migration table is usable: lesson_wallet_credits insert/update/select succeeded')
  console.log('PASS Store wallet: verified booking only, 48-hour guard, no attendance, original session -> walleted')
  console.log('PASS Store wallet: original slot count decremented and learner removed from coach group')
  console.log('PASS Coach assignment stability: remaining assigned learners stay assigned and emptied groups are left auditable without active students')
  console.log('PASS Redeem wallet: same-month future slot, target capacity, new scheduled session created')
  console.log('PASS Redeem wallet: original booking/payment reused; no additional charge path used')
  console.log('PASS Re-wallet chain: redeemed session can be stored again, assignment cleanup stays per learner, and payment count stays unchanged')
  console.log('PASS Guard checks: near cutoff blocked, attended session blocked, expired credit marked expired, wrong-month candidate detected')
  console.log('PASS Duplicate guard: same learner/date/time/branch/course is blocked before wallet redeem')

  if (!keepData) {
    const cleanupResult = await cleanupUatData()
    console.log(`PASS Cleaned UAT data: ${cleanupResult.profiles} profiles, ${cleanupResult.slots} slots, ${cleanupResult.sessions} sessions, ${cleanupResult.walletCredits} wallet credits`)
  } else {
    console.log('Kept UAT data because --keep was passed')
  }
}

async function main() {
  if (cleanupOnly) {
    const cleanupResult = await cleanupUatData()
    console.log(`Cleaned UAT data: ${cleanupResult.profiles} profiles, ${cleanupResult.slots} slots, ${cleanupResult.sessions} sessions, ${cleanupResult.walletCredits} wallet credits`)
    return
  }

  await runUat()
}

main().catch(async (error) => {
  console.error(`FAIL ${error.message}`)
  if (!keepData) {
    try {
      await cleanupUatData()
      console.error('Cleaned UAT data after failure')
    } catch (cleanupError) {
      console.error(`Cleanup after failure also failed: ${cleanupError.message}`)
    }
  }
  process.exit(1)
})
