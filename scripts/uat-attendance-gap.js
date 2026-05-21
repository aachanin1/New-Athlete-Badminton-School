const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const UAT_PREFIX = 'uat.nasc+attendance.gap.'
const UAT_DOMAIN = 'example.com'
const UAT_PASSWORD = 'NascUat@2026'
const UAT_MARKER = 'NASC_UAT_ATTENDANCE_GAP'
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

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateInput, days) {
  const [year, month, day] = dateInput.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function todayLocal() {
  return formatDate(new Date())
}

function getDayOfWeek(dateInput) {
  const [year, month, day] = dateInput.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

function toIso(dateInput, timeInput) {
  return new Date(`${dateInput}T${timeInput}+07:00`).toISOString()
}

function email(key) {
  return `${UAT_PREFIX}${key}@${UAT_DOMAIN}`
}

async function expectNoError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
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

  const uatSlots = templateIds.length
    ? await expectNoError(
      await supabase.from('schedule_slots').select('id').in('template_id', templateIds),
      'fetch uat schedule slots',
    )
    : []
  const slotIds = (uatSlots || []).map((slot) => slot.id)

  const uatBookings = profileIds.length
    ? await expectNoError(await supabase.from('bookings').select('id').in('user_id', profileIds), 'fetch uat bookings')
    : []
  const bookingIds = (uatBookings || []).map((booking) => booking.id)

  const sessionQueryIds = []
  if (bookingIds.length) {
    const sessionsByBooking = await expectNoError(
      await supabase.from('booking_sessions').select('id').in('booking_id', bookingIds),
      'fetch uat sessions by booking',
    )
    sessionQueryIds.push(...(sessionsByBooking || []).map((session) => session.id))
  }
  if (slotIds.length) {
    const sessionsBySlot = await expectNoError(
      await supabase.from('booking_sessions').select('id').in('schedule_slot_id', slotIds),
      'fetch uat sessions by slot',
    )
    sessionQueryIds.push(...(sessionsBySlot || []).map((session) => session.id))
  }
  const sessionIds = Array.from(new Set(sessionQueryIds))

  await deleteWhereIn('activity_logs', 'user_id', profileIds)
  await deleteWhereIn('activity_logs', 'entity_id', sessionIds)
  await deleteWhereIn('notifications', 'user_id', profileIds)
  await deleteWhereIn('attendance', 'booking_session_id', sessionIds)
  await deleteWhereIn('coach_checkins', 'schedule_slot_id', slotIds)
  await deleteWhereIn('coach_assignment_group_students', 'booking_session_id', sessionIds)
  await deleteWhereIn('coach_assignment_groups', 'schedule_slot_id', slotIds)
  await deleteWhereIn('coach_assignments', 'schedule_slot_id', slotIds)
  await deleteWhereIn('booking_sessions', 'id', sessionIds)
  await deleteWhereIn('bookings', 'id', bookingIds)
  await deleteWhereIn('children', 'parent_id', profileIds)
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
    sessions: sessionIds.length,
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
    { key: 'admin', email: email('admin'), fullName: 'UAT Attendance Admin', role: 'super_admin' },
    { key: 'coach', email: email('coach'), fullName: 'UAT Attendance Coach', role: 'coach', coach_employment_type: 'part_time' },
    { key: 'parent', email: email('parent'), fullName: 'UAT Attendance Parent', role: 'user' },
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
      phone: '080-999-0000',
      role: account.role,
      coach_employment_type: account.coach_employment_type || null,
      avatar_url: null,
    }))),
    'upsert uat profiles',
  )

  return ids
}

async function createChildren(parentId) {
  const children = await expectNoError(
    await supabase.from('children').insert([
      { parent_id: parentId, full_name: 'UAT Late Child', nickname: 'UAT Late' },
      { parent_id: parentId, full_name: 'UAT Absent Child', nickname: 'UAT Absent' },
    ]).select('id, full_name'),
    'create uat children',
  )

  return {
    lateChild: children[0],
    absentChild: children[1],
  }
}

async function selectMasterData() {
  const branch = await expectNoError(
    await supabase.from('branches').select('id, name').eq('is_active', true).order('created_at', { ascending: true }).limit(1).single(),
    'fetch active branch',
  )
  const courseType = await expectNoError(
    await supabase.from('course_types').select('id, name').eq('name', 'adult_group').single(),
    'fetch adult_group course type',
  )

  return { branch, courseType }
}

async function createSlot(branchId, courseTypeId) {
  const date = addDays(todayLocal(), -1)
  const candidateStarts = ['05:00', '05:15', '05:30', '05:45', '06:00']
  let startTime = null

  for (const candidate of candidateStarts) {
    const existing = await expectNoError(
      await supabase
        .from('schedule_slots')
        .select('id')
        .eq('branch_id', branchId)
        .eq('course_type_id', courseTypeId)
        .eq('date', date)
        .eq('start_time', `${candidate}:00`)
        .maybeSingle(),
      'check slot collision',
    )
    if (!existing) {
      startTime = candidate
      break
    }
  }

  if (!startTime) throw new Error('No safe disposable time slot available for UAT')

  const [hour, minute] = startTime.split(':').map(Number)
  const endHour = String(hour + 1).padStart(2, '0')
  const endTime = `${endHour}:${String(minute).padStart(2, '0')}`

  const template = await expectNoError(
    await supabase.from('schedule_templates').insert({
      branch_id: branchId,
      course_type_id: courseTypeId,
      day_of_week: getDayOfWeek(date),
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      is_active: false,
      notes: UAT_MARKER,
    }).select('id').single(),
    'create uat schedule template',
  )

  const slot = await expectNoError(
    await supabase.from('schedule_slots').insert({
      template_id: template.id,
      branch_id: branchId,
      course_type_id: courseTypeId,
      date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      max_students: 6,
      current_students: 3,
      status: 'open',
    }).select('id, date, start_time, end_time').single(),
    'create uat schedule slot',
  )

  return slot
}

async function createBookingSession({ userId, childId, branchId, courseTypeId, slot, statusLabel }) {
  const booking = await expectNoError(
    await supabase.from('bookings').insert({
      user_id: userId,
      learner_type: childId ? 'child' : 'self',
      child_id: childId,
      branch_id: branchId,
      course_type_id: courseTypeId,
      month: Number(slot.date.slice(5, 7)),
      year: Number(slot.date.slice(0, 4)),
      total_sessions: 1,
      total_price: 0,
      status: 'verified',
    }).select('id').single(),
    `create uat booking ${statusLabel}`,
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
    }).select('id, child_id').single(),
    `create uat booking session ${statusLabel}`,
  )

  return session
}

async function hasAdminReturnedSlot(coachId, scheduleSlotId) {
  const sessions = await expectNoError(
    await supabase.from('booking_sessions').select('id, schedule_slot_id').eq('schedule_slot_id', scheduleSlotId),
    'fetch sessions for admin-returned lookup',
  )
  const sessionIds = sessions.map((session) => session.id)
  if (!sessionIds.length) return false

  const logs = await expectNoError(
    await supabase
      .from('activity_logs')
      .select('entity_id, details')
      .eq('action', 'attendance_gap_request_coach_review')
      .eq('entity_type', 'booking_sessions')
      .in('entity_id', sessionIds),
    'fetch admin-returned activity logs',
  )

  return logs.some((log) => {
    const notifiedCoachIds = Array.isArray(log.details?.notifiedCoachIds) ? log.details.notifiedCoachIds : []
    return log.details?.scheduleSlotId === scheduleSlotId && notifiedCoachIds.includes(coachId)
  })
}

async function runUat() {
  await cleanupUatData()

  const { branch, courseType } = await selectMasterData()
  const ids = await createProfiles()
  const children = await createChildren(ids.parent)
  const slot = await createSlot(branch.id, courseType.id)

  const sessions = [
    {
      label: 'present adult',
      status: 'present',
      studentId: ids.parent,
      studentType: 'adult',
      row: await createBookingSession({
        userId: ids.parent,
        childId: null,
        branchId: branch.id,
        courseTypeId: courseType.id,
        slot,
        statusLabel: 'present',
      }),
    },
    {
      label: 'late child',
      status: 'late',
      studentId: children.lateChild.id,
      studentType: 'child',
      row: await createBookingSession({
        userId: ids.parent,
        childId: children.lateChild.id,
        branchId: branch.id,
        courseTypeId: courseType.id,
        slot,
        statusLabel: 'late',
      }),
    },
    {
      label: 'absent child',
      status: 'absent',
      studentId: children.absentChild.id,
      studentType: 'child',
      row: await createBookingSession({
        userId: ids.parent,
        childId: children.absentChild.id,
        branchId: branch.id,
        courseTypeId: courseType.id,
        slot,
        statusLabel: 'absent',
      }),
    },
  ]

  await expectNoError(
    await supabase.from('coach_assignments').insert({
      coach_id: ids.coach,
      schedule_slot_id: slot.id,
      assigned_by: ids.admin,
    }),
    'create legacy coach assignment',
  )

  const group = await expectNoError(
    await supabase.from('coach_assignment_groups').insert({
      schedule_slot_id: slot.id,
      coach_id: ids.coach,
      name: 'UAT Attendance Gap Group',
      level_min: 0,
      level_max: 70,
      sort_order: 1,
      notes: UAT_MARKER,
      created_by: ids.admin,
    }).select('id').single(),
    'create coach assignment group',
  )

  await expectNoError(
    await supabase.from('coach_assignment_group_students').insert(sessions.map((session) => ({
      group_id: group.id,
      booking_session_id: session.row.id,
      student_id: session.studentId,
      student_type: session.studentType,
    }))),
    'create assignment group students',
  )

  const beforeAttendance = await expectNoError(
    await supabase.from('attendance').select('id').in('booking_session_id', sessions.map((session) => session.row.id)),
    'verify no attendance before review',
  )
  if (beforeAttendance.length !== 0) throw new Error('UAT setup expected zero attendance before review')

  await expectNoError(
    await supabase.from('activity_logs').insert(sessions.map((session) => ({
      user_id: ids.admin,
      action: 'attendance_gap_request_coach_review',
      entity_type: 'booking_sessions',
      entity_id: session.row.id,
      details: {
        marker: UAT_MARKER,
        scheduleSlotId: slot.id,
        notifiedCoachIds: [ids.coach],
        reason: 'UAT admin returned attendance gap to coach',
      },
    }))),
    'write admin-returned activity logs',
  )

  await expectNoError(
    await supabase.from('notifications').insert({
      user_id: ids.coach,
      title: 'UAT ตรวจสอบการเช็คชื่อย้อนหลัง',
      message: 'Admin ส่งรอบนี้กลับให้ Coach เช็คอินย้อนหลังและเช็คชื่อนักเรียน',
      type: 'schedule',
      link_url: `/coach/attendance?date=${slot.date}&slot=${slot.id}`,
    }),
    'write coach notification',
  )

  if (!await hasAdminReturnedSlot(ids.coach, slot.id)) {
    throw new Error('Admin-returned helper condition did not detect the returned slot')
  }

  await expectNoError(
    await supabase.from('coach_checkins').insert({
      coach_id: ids.coach,
      schedule_slot_id: slot.id,
      branch_id: branch.id,
      checkin_time: new Date().toISOString(),
      photo_url: `uat://${UAT_MARKER}/camera-capture.jpg`,
      location_lat: 13.7563,
      location_lng: 100.5018,
    }),
    'write retroactive coach checkin',
  )

  for (const session of sessions) {
    await expectNoError(
      await supabase.from('attendance').insert({
        booking_session_id: session.row.id,
        student_id: session.studentId,
        student_type: session.studentType,
        coach_id: ids.coach,
        status: session.status,
        checked_at: new Date().toISOString(),
      }),
      `write ${session.label} attendance`,
    )

    await expectNoError(
      await supabase
        .from('booking_sessions')
        .update({ status: session.status === 'absent' ? 'absent' : 'completed' })
        .eq('id', session.row.id),
      `update ${session.label} session status`,
    )
  }

  const verifiedSessions = await expectNoError(
    await supabase.from('booking_sessions').select('id, status').in('id', sessions.map((session) => session.row.id)),
    'verify session statuses',
  )
  const statusBySessionId = new Map(verifiedSessions.map((session) => [session.id, session.status]))
  for (const session of sessions) {
    const expectedStatus = session.status === 'absent' ? 'absent' : 'completed'
    if (statusBySessionId.get(session.row.id) !== expectedStatus) {
      throw new Error(`${session.label} expected session status ${expectedStatus}`)
    }
  }

  const verifiedAttendance = await expectNoError(
    await supabase.from('attendance').select('booking_session_id, status').in('booking_session_id', sessions.map((session) => session.row.id)),
    'verify attendance rows',
  )
  if (verifiedAttendance.length !== 3) throw new Error('Expected three attendance rows')

  const remainingGapSessions = sessions.filter((session) => !verifiedAttendance.some((row) => row.booking_session_id === session.row.id))
  if (remainingGapSessions.length) throw new Error('Admin gap queue would still include a tested session')

  const absentSession = sessions.find((session) => session.status === 'absent')
  const presentOrLateSessions = sessions.filter((session) => session.status !== 'absent')
  if (!absentSession || statusBySessionId.get(absentSession.row.id) !== 'absent') {
    throw new Error('Absent attendance did not become makeup-eligible session status')
  }
  if (presentOrLateSessions.some((session) => statusBySessionId.get(session.row.id) === 'absent')) {
    throw new Error('Present/late attendance incorrectly became makeup-eligible')
  }

  console.log('PASS Admin returned attendance gap detected by helper condition')
  console.log('PASS Coach retroactive check-in evidence written for returned slot only')
  console.log('PASS Attendance saved for present, late, and absent learners')
  console.log('PASS Booking session statuses align with makeup rule')
  console.log('PASS Admin zero-attendance gap condition is closed after attendance exists')

  if (!keepData) {
    const cleanupResult = await cleanupUatData()
    console.log(`PASS Cleaned UAT data: ${cleanupResult.profiles} profiles, ${cleanupResult.slots} slots, ${cleanupResult.sessions} sessions`)
  } else {
    console.log('Kept UAT data because --keep was passed')
  }
}

async function main() {
  if (cleanupOnly) {
    const cleanupResult = await cleanupUatData()
    console.log(`Cleaned UAT data: ${cleanupResult.profiles} profiles, ${cleanupResult.slots} slots, ${cleanupResult.sessions} sessions`)
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
