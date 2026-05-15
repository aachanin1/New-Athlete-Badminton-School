const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SEED_PREFIX = 'seed.nasc+'
const SEED_DOMAIN = 'example.com'
const SEED_PASSWORD = 'NascSeed@2026'
const SEED_NOTE = 'NASC_SEED'
const SLIP_URL = 'https://placehold.co/480x640/png?text=NASC+Seed+Slip'
const CHECKIN_PHOTO_URL = 'https://placehold.co/640x640/png?text=NASC+Coach+Checkin'
const AVATAR_BASE = 'https://api.dicebear.com/9.x/initials/svg?seed='

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const seedAccounts = [
  { key: 'super', email: `${SEED_PREFIX}super@${SEED_DOMAIN}`, fullName: 'Seed Super Admin', phone: '080-000-9001', role: 'super_admin' },
  { key: 'admin', email: `${SEED_PREFIX}admin@${SEED_DOMAIN}`, fullName: 'Seed Admin Monitor', phone: '080-000-9002', role: 'admin' },
  { key: 'headCoach', email: `${SEED_PREFIX}headcoach@${SEED_DOMAIN}`, fullName: 'Coach Seed หัวหน้า', phone: '080-000-9101', role: 'head_coach', employmentType: 'full_time' },
  { key: 'coachFull', email: `${SEED_PREFIX}coach.full@${SEED_DOMAIN}`, fullName: 'Coach Seed Full-Time', phone: '080-000-9102', role: 'coach', employmentType: 'full_time' },
  { key: 'coachHalf', email: `${SEED_PREFIX}coach.half@${SEED_DOMAIN}`, fullName: 'Coach Seed Half-Time', phone: '080-000-9103', role: 'coach', employmentType: 'half_time' },
  { key: 'coachPart', email: `${SEED_PREFIX}coach.part@${SEED_DOMAIN}`, fullName: 'Coach Seed Part-Time', phone: '080-000-9104', role: 'coach', employmentType: 'part_time' },
  { key: 'parent', email: `${SEED_PREFIX}parent@${SEED_DOMAIN}`, fullName: 'Seed Parent User', phone: '080-000-9201', role: 'user' },
  { key: 'adult', email: `${SEED_PREFIX}adult@${SEED_DOMAIN}`, fullName: 'Seed Adult Learner', phone: '080-000-9202', role: 'user' },
]

function asDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateInput, days) {
  const date = new Date(`${dateInput}T00:00:00`)
  date.setDate(date.getDate() + days)
  return asDate(date)
}

function getWeekEnd(weekStart) {
  return addDays(weekStart, 6)
}

function getDayOfWeek(dateInput) {
  return new Date(`${dateInput}T00:00:00`).getDay()
}

function toIso(dateInput, timeInput) {
  return new Date(`${dateInput}T${timeInput}`).toISOString()
}

function avatar(name) {
  return `${AVATAR_BASE}${encodeURIComponent(name)}`
}

async function expectNoError(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
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

async function findAuthUserByEmail(email) {
  const users = await listAllAuthUsers()
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

async function ensureAuthUser(account) {
  const existing = await findAuthUserByEmail(account.email)

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        phone: account.phone,
        seed: SEED_NOTE,
      },
    })
    return existing.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      phone: account.phone,
      seed: SEED_NOTE,
    },
  })

  if (error) throw error
  return data.user.id
}

async function deleteWhereIn(table, column, values) {
  if (!values.length) return
  await expectNoError(await supabase.from(table).delete().in(column, values), `delete ${table}`)
}

async function cleanupSeed(seedUserIds) {
  if (!seedUserIds.length) return

  const seedChildren = await expectNoError(
    await supabase.from('children').select('id').in('parent_id', seedUserIds),
    'fetch seed children',
  )
  const seedChildIds = (seedChildren || []).map((child) => child.id)

  const seedBookings = await expectNoError(
    await supabase.from('bookings').select('id').in('user_id', seedUserIds),
    'fetch seed bookings',
  )
  const seedBookingIds = (seedBookings || []).map((booking) => booking.id)

  const seedSessions = seedBookingIds.length
    ? await expectNoError(
      await supabase.from('booking_sessions').select('id, schedule_slot_id').in('booking_id', seedBookingIds),
      'fetch seed sessions',
    )
    : []
  const seedSessionIds = (seedSessions || []).map((session) => session.id)
  const seedSlotIds = Array.from(new Set((seedSessions || []).map((session) => session.schedule_slot_id).filter(Boolean)))

  const seedCoupons = await expectNoError(
    await supabase.from('coupons').select('id').like('code', 'NASCSEED%'),
    'fetch seed coupons',
  )
  const seedCouponIds = (seedCoupons || []).map((coupon) => coupon.id)

  await deleteWhereIn('activity_logs', 'user_id', seedUserIds)
  await deleteWhereIn('notifications', 'user_id', seedUserIds)
  await deleteWhereIn('coach_weekly_teaching_summaries', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_payouts', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_teaching_hours', 'coach_id', seedUserIds)
  await deleteWhereIn('teaching_programs', 'coach_id', seedUserIds)
  await deleteWhereIn('attendance', 'booking_session_id', seedSessionIds)
  await deleteWhereIn('coach_checkins', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_assignments', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_assignments', 'assigned_by', seedUserIds)
  await deleteWhereIn('coupon_usages', 'booking_id', seedBookingIds)
  await deleteWhereIn('coupon_usages', 'coupon_id', seedCouponIds)
  await deleteWhereIn('payments', 'booking_id', seedBookingIds)
  await deleteWhereIn('booking_sessions', 'booking_id', seedBookingIds)
  await deleteWhereIn('bookings', 'id', seedBookingIds)
  await deleteWhereIn('student_levels', 'student_id', [...seedUserIds, ...seedChildIds])
  await deleteWhereIn('student_achievements', 'student_id', [...seedUserIds, ...seedChildIds])
  await deleteWhereIn('complaints', 'user_id', seedUserIds)
  await deleteWhereIn('children', 'parent_id', seedUserIds)
  await deleteWhereIn('coach_branches', 'coach_id', seedUserIds)
  await deleteWhereIn('coupons', 'id', seedCouponIds)
  await deleteWhereIn('finance_expenses', 'created_by', seedUserIds)

  if (seedSlotIds.length) {
    await expectNoError(
      await supabase.from('schedule_slots').update({ current_students: 0, status: 'open' }).in('id', seedSlotIds),
      'reset seed schedule slots',
    )
  }
}

async function seedUsers() {
  const ids = {}

  for (const account of seedAccounts) {
    ids[account.key] = await ensureAuthUser(account)
  }

  await cleanupSeed(Object.values(ids))

  const profileRows = seedAccounts.map((account) => ({
    id: ids[account.key],
    full_name: account.fullName,
    phone: account.phone,
    email: account.email,
    avatar_url: avatar(account.fullName),
    role: account.role,
    coach_employment_type: account.employmentType || null,
    updated_at: new Date().toISOString(),
  }))

  await expectNoError(
    await supabase.from('profiles').upsert(profileRows, { onConflict: 'id' }),
    'upsert seed profiles',
  )

  return ids
}

async function fetchMasterData() {
  const branches = await expectNoError(
    await supabase.from('branches').select('id, name, slug, is_active').eq('is_active', true).order('created_at'),
    'fetch branches',
  )
  const courseTypes = await expectNoError(
    await supabase.from('course_types').select('id, name, max_students, duration_hours'),
    'fetch course types',
  )
  const templates = await expectNoError(
    await supabase
      .from('schedule_templates')
      .select('id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active')
      .eq('is_active', true),
    'fetch schedule templates',
  )

  if (!branches?.length) throw new Error('No active branches found')
  if (!courseTypes?.length) throw new Error('No course types found')

  const branchA = branches.find((branch) => branch.name.includes('แจ้ง')) || branches[0]
  const branchB = branches.find((branch) => branch.name.includes('เทพ')) || branches[1] || branches[0]
  const courseByName = Object.fromEntries(courseTypes.map((course) => [course.name, course]))

  for (const name of ['kids_group', 'adult_group', 'private']) {
    if (!courseByName[name]) throw new Error(`Missing course type: ${name}`)
  }

  return { branches, branchA, branchB, courseByName, templates }
}

async function seedCoachBranches(ids, master) {
  const rows = [
    { coach_id: ids.headCoach, branch_id: master.branchA.id, is_head_coach: true },
    { coach_id: ids.headCoach, branch_id: master.branchB.id, is_head_coach: true },
    { coach_id: ids.coachFull, branch_id: master.branchA.id, is_head_coach: false },
    { coach_id: ids.coachHalf, branch_id: master.branchA.id, is_head_coach: false },
    { coach_id: ids.coachPart, branch_id: master.branchB.id, is_head_coach: false },
  ]

  await expectNoError(
    await supabase.from('coach_branches').upsert(rows, { onConflict: 'coach_id,branch_id' }),
    'upsert seed coach branches',
  )
}

async function seedChildren(ids) {
  const rows = [
    {
      parent_id: ids.parent,
      full_name: 'ด.ช.ดราฟ Seed',
      nickname: 'น้องดราฟ Seed',
      date_of_birth: '2016-02-12',
      gender: 'male',
      avatar_url: avatar('น้องดราฟ Seed'),
    },
    {
      parent_id: ids.parent,
      full_name: 'ด.ช.อาร์ม Seed',
      nickname: 'น้องอาร์ม Seed',
      date_of_birth: '2017-07-21',
      gender: 'male',
      avatar_url: avatar('น้องอาร์ม Seed'),
    },
  ]

  const data = await expectNoError(
    await supabase.from('children').insert(rows).select('id, full_name, nickname'),
    'insert seed children',
  )

  return {
    draft: data.find((child) => child.nickname?.includes('ดราฟ'))?.id,
    arm: data.find((child) => child.nickname?.includes('อาร์ม'))?.id,
  }
}

function findTemplate(templates, branchId, courseTypeId, date, startTime) {
  const dayOfWeek = getDayOfWeek(date)
  return templates.find((template) => (
    template.branch_id === branchId &&
    template.course_type_id === courseTypeId &&
    Number(template.day_of_week) === dayOfWeek &&
    String(template.start_time).slice(0, 5) === startTime
  ))
}

async function ensureSlot(master, slot) {
  const template = findTemplate(master.templates, slot.branchId, slot.courseTypeId, slot.date, slot.startTime)
  const payload = {
    template_id: template?.id || null,
    branch_id: slot.branchId,
    course_type_id: slot.courseTypeId,
    date: slot.date,
    start_time: slot.startTime,
    end_time: slot.endTime,
    max_students: slot.maxStudents || 6,
    current_students: slot.currentStudents || 0,
    status: slot.status || 'open',
  }

  const data = await expectNoError(
    await supabase
      .from('schedule_slots')
      .upsert(payload, { onConflict: 'branch_id,course_type_id,date,start_time' })
      .select('id')
      .single(),
    'upsert seed schedule slot',
  )

  return data.id
}

async function createBooking({ userId, learnerType, childId = null, branchId, courseTypeId, month, year, totalSessions, totalPrice, status, sessions }) {
  const booking = await expectNoError(
    await supabase
      .from('bookings')
      .insert({
        user_id: userId,
        learner_type: learnerType,
        child_id: childId,
        branch_id: branchId,
        course_type_id: courseTypeId,
        month,
        year,
        total_sessions: totalSessions,
        total_price: totalPrice,
        status,
      })
      .select('id')
      .single(),
    'insert seed booking',
  )

  const sessionRows = sessions.map((session) => ({
    booking_id: booking.id,
    schedule_slot_id: session.slotId,
    date: session.date,
    start_time: session.startTime,
    end_time: session.endTime,
    branch_id: branchId,
    child_id: learnerType === 'child' ? childId : null,
    status: session.status || 'scheduled',
    rescheduled_from_id: session.rescheduledFromId || null,
    is_makeup: Boolean(session.isMakeup),
  }))

  const insertedSessions = await expectNoError(
    await supabase
      .from('booking_sessions')
      .insert(sessionRows)
      .select('id, schedule_slot_id, date, start_time, end_time, status'),
    'insert seed booking sessions',
  )

  return { bookingId: booking.id, sessions: insertedSessions }
}

async function seedBookingsAndTeaching(ids, childIds, master) {
  const kids = master.courseByName.kids_group
  const adult = master.courseByName.adult_group
  const privateCourse = master.courseByName.private
  const branchA = master.branchA
  const branchB = master.branchB

  const slotSpecs = [
    { key: 'draft1', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-11', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 2 },
    { key: 'draft2', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-12', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'draft3', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-13', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'draft4', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-18', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'draft5', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-20', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'draftMakeup', branchId: branchA.id, courseTypeId: kids.id, date: '2026-06-02', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'arm1', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-11', startTime: '10:00', endTime: '12:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'arm2', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-18', startTime: '10:00', endTime: '12:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'arm3', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-25', startTime: '10:00', endTime: '12:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'arm4', branchId: branchA.id, courseTypeId: kids.id, date: '2026-05-27', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'adult1', branchId: branchA.id, courseTypeId: adult.id, date: '2026-05-16', startTime: '15:00', endTime: '17:00', maxStudents: adult.max_students, currentStudents: 1 },
    { key: 'adult2', branchId: branchA.id, courseTypeId: adult.id, date: '2026-05-23', startTime: '15:00', endTime: '17:00', maxStudents: adult.max_students, currentStudents: 1 },
    { key: 'private1', branchId: branchB.id, courseTypeId: privateCourse.id, date: '2026-05-14', startTime: '10:00', endTime: '12:00', maxStudents: privateCourse.max_students, currentStudents: 1 },
    { key: 'private2', branchId: branchB.id, courseTypeId: privateCourse.id, date: '2026-05-17', startTime: '10:00', endTime: '12:00', maxStudents: privateCourse.max_students, currentStudents: 1 },
    { key: 'private3', branchId: branchB.id, courseTypeId: privateCourse.id, date: '2026-05-21', startTime: '10:00', endTime: '12:00', maxStudents: privateCourse.max_students, currentStudents: 1 },
    { key: 'private4', branchId: branchB.id, courseTypeId: privateCourse.id, date: '2026-05-24', startTime: '10:00', endTime: '12:00', maxStudents: privateCourse.max_students, currentStudents: 1 },
    { key: 'pending1', branchId: branchA.id, courseTypeId: kids.id, date: '2026-06-01', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
    { key: 'pending2', branchId: branchA.id, courseTypeId: kids.id, date: '2026-06-03', startTime: '17:00', endTime: '19:00', maxStudents: kids.max_students, currentStudents: 1 },
  ]

  const slots = {}
  for (const spec of slotSpecs) {
    slots[spec.key] = await ensureSlot(master, spec)
  }

  const draftBooking = await createBooking({
    userId: ids.parent,
    learnerType: 'child',
    childId: childIds.draft,
    branchId: branchA.id,
    courseTypeId: kids.id,
    month: 5,
    year: 2026,
    totalSessions: 6,
    totalPrice: 3750,
    status: 'verified',
    sessions: [
      { slotId: slots.draft1, date: '2026-05-11', startTime: '17:00', endTime: '19:00', status: 'completed' },
      { slotId: slots.draft2, date: '2026-05-12', startTime: '17:00', endTime: '19:00', status: 'absent' },
      { slotId: slots.draft3, date: '2026-05-13', startTime: '17:00', endTime: '19:00', status: 'completed' },
      { slotId: slots.draft4, date: '2026-05-18', startTime: '17:00', endTime: '19:00', status: 'scheduled' },
      { slotId: slots.draft5, date: '2026-05-20', startTime: '17:00', endTime: '19:00', status: 'scheduled' },
      { slotId: slots.draftMakeup, date: '2026-06-02', startTime: '17:00', endTime: '19:00', status: 'scheduled', isMakeup: true },
    ],
  })

  const draftAbsentSession = draftBooking.sessions.find((session) => session.schedule_slot_id === slots.draft2)
  const draftMakeupSession = draftBooking.sessions.find((session) => session.schedule_slot_id === slots.draftMakeup)
  if (draftAbsentSession && draftMakeupSession) {
    await expectNoError(
      await supabase
        .from('booking_sessions')
        .update({ rescheduled_from_id: draftAbsentSession.id })
        .eq('id', draftMakeupSession.id),
      'link seed makeup session',
    )
  }

  const armBooking = await createBooking({
    userId: ids.parent,
    learnerType: 'child',
    childId: childIds.arm,
    branchId: branchA.id,
    courseTypeId: kids.id,
    month: 5,
    year: 2026,
    totalSessions: 4,
    totalPrice: 2300,
    status: 'verified',
    sessions: [
      { slotId: slots.arm1, date: '2026-05-11', startTime: '10:00', endTime: '12:00', status: 'completed' },
      { slotId: slots.arm2, date: '2026-05-18', startTime: '10:00', endTime: '12:00', status: 'scheduled' },
      { slotId: slots.arm3, date: '2026-05-25', startTime: '10:00', endTime: '12:00', status: 'scheduled' },
      { slotId: slots.arm4, date: '2026-05-27', startTime: '17:00', endTime: '19:00', status: 'scheduled' },
    ],
  })

  const adultBooking = await createBooking({
    userId: ids.adult,
    learnerType: 'self',
    branchId: branchA.id,
    courseTypeId: adult.id,
    month: 5,
    year: 2026,
    totalSessions: 2,
    totalPrice: 1200,
    status: 'verified',
    sessions: [
      { slotId: slots.adult1, date: '2026-05-16', startTime: '15:00', endTime: '17:00', status: 'scheduled' },
      { slotId: slots.adult2, date: '2026-05-23', startTime: '15:00', endTime: '17:00', status: 'scheduled' },
    ],
  })

  const privateBooking = await createBooking({
    userId: ids.adult,
    learnerType: 'self',
    branchId: branchB.id,
    courseTypeId: privateCourse.id,
    month: 5,
    year: 2026,
    totalSessions: 4,
    totalPrice: 3600,
    status: 'verified',
    sessions: [
      { slotId: slots.private1, date: '2026-05-14', startTime: '10:00', endTime: '12:00', status: 'completed' },
      { slotId: slots.private2, date: '2026-05-17', startTime: '10:00', endTime: '12:00', status: 'scheduled' },
      { slotId: slots.private3, date: '2026-05-21', startTime: '10:00', endTime: '12:00', status: 'scheduled' },
      { slotId: slots.private4, date: '2026-05-24', startTime: '10:00', endTime: '12:00', status: 'scheduled' },
    ],
  })

  const pendingBooking = await createBooking({
    userId: ids.parent,
    learnerType: 'child',
    childId: childIds.arm,
    branchId: branchA.id,
    courseTypeId: kids.id,
    month: 6,
    year: 2026,
    totalSessions: 2,
    totalPrice: 1400,
    status: 'pending_payment',
    sessions: [
      { slotId: slots.pending1, date: '2026-06-01', startTime: '17:00', endTime: '19:00', status: 'scheduled' },
      { slotId: slots.pending2, date: '2026-06-03', startTime: '17:00', endTime: '19:00', status: 'scheduled' },
    ],
  })

  await expectNoError(
    await supabase.from('payments').insert([
      {
        booking_id: draftBooking.bookingId,
        user_id: ids.parent,
        amount: 3750,
        method: 'transfer',
        slip_image_url: SLIP_URL,
        status: 'approved',
        verified_by: ids.super,
        verified_at: toIso('2026-05-10', '18:05:00'),
        notes: `${SEED_NOTE}: SlipOK TEST_MODE verified`,
      },
      {
        booking_id: armBooking.bookingId,
        user_id: ids.parent,
        amount: 2300,
        method: 'transfer',
        slip_image_url: SLIP_URL,
        status: 'approved',
        verified_by: ids.super,
        verified_at: toIso('2026-05-10', '18:20:00'),
        notes: `${SEED_NOTE}: coupon applied and SlipOK TEST_MODE verified`,
      },
      {
        booking_id: adultBooking.bookingId,
        user_id: ids.adult,
        amount: 1200,
        method: 'transfer',
        slip_image_url: SLIP_URL,
        status: 'approved',
        verified_by: ids.admin,
        verified_at: toIso('2026-05-15', '12:00:00'),
        notes: `${SEED_NOTE}: adult group verified`,
      },
      {
        booking_id: privateBooking.bookingId,
        user_id: ids.adult,
        amount: 3600,
        method: 'transfer',
        slip_image_url: SLIP_URL,
        status: 'approved',
        verified_by: ids.super,
        verified_at: toIso('2026-05-14', '09:30:00'),
        notes: `${SEED_NOTE}: private class verified`,
      },
      {
        booking_id: pendingBooking.bookingId,
        user_id: ids.parent,
        amount: 1400,
        method: 'transfer',
        slip_image_url: null,
        status: 'pending',
        verified_by: null,
        verified_at: null,
        notes: `${SEED_NOTE}: pending payment scenario`,
      },
    ]),
    'insert seed payments',
  )

  const couponRows = await expectNoError(
    await supabase
      .from('coupons')
      .insert([
        {
          code: 'NASCSEED1',
          discount_type: 'fixed',
          discount_value: 200,
          min_purchase: 1000,
          max_uses: 1,
          current_uses: 1,
          valid_from: '2026-05-01',
          valid_to: '2026-06-30',
          created_by: ids.super,
          is_active: false,
        },
        {
          code: 'NASCSEED50',
          discount_type: 'percent',
          discount_value: 10,
          min_purchase: 1000,
          max_uses: 50,
          current_uses: 0,
          valid_from: '2026-05-01',
          valid_to: '2026-12-31',
          created_by: ids.super,
          is_active: true,
        },
      ])
      .select('id, code'),
    'insert seed coupons',
  )

  const usedCoupon = couponRows.find((coupon) => coupon.code === 'NASCSEED1')
  if (usedCoupon) {
    await expectNoError(
      await supabase.from('coupon_usages').insert({
        coupon_id: usedCoupon.id,
        user_id: ids.parent,
        booking_id: armBooking.bookingId,
        discount_amount: 200,
        used_at: toIso('2026-05-10', '18:01:00'),
      }),
      'insert seed coupon usage',
    )
  }

  const assignments = [
    { coach_id: ids.coachFull, schedule_slot_id: slots.draft1, assigned_by: ids.headCoach },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.draft2, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.draft3, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.draft4, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.draft5, assigned_by: ids.headCoach },
    { coach_id: ids.headCoach, schedule_slot_id: slots.draftMakeup, assigned_by: ids.super },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.arm1, assigned_by: ids.headCoach },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.arm2, assigned_by: ids.headCoach },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.arm3, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.arm4, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.adult1, assigned_by: ids.headCoach },
    { coach_id: ids.coachFull, schedule_slot_id: slots.adult2, assigned_by: ids.headCoach },
    { coach_id: ids.coachPart, schedule_slot_id: slots.private1, assigned_by: ids.headCoach },
    { coach_id: ids.coachPart, schedule_slot_id: slots.private2, assigned_by: ids.headCoach },
    { coach_id: ids.coachPart, schedule_slot_id: slots.private3, assigned_by: ids.headCoach },
    { coach_id: ids.coachPart, schedule_slot_id: slots.private4, assigned_by: ids.headCoach },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.pending1, assigned_by: ids.headCoach },
    { coach_id: ids.coachHalf, schedule_slot_id: slots.pending2, assigned_by: ids.headCoach },
  ]
  await expectNoError(await supabase.from('coach_assignments').insert(assignments), 'insert seed coach assignments')

  await expectNoError(
    await supabase.from('coach_checkins').insert([
      { coach_id: ids.coachFull, schedule_slot_id: slots.draft1, branch_id: branchA.id, checkin_time: toIso('2026-05-11', '16:35:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.9042, location_lng: 100.5278 },
      { coach_id: ids.coachHalf, schedule_slot_id: slots.draft2, branch_id: branchA.id, checkin_time: toIso('2026-05-12', '16:40:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.9042, location_lng: 100.5278 },
      { coach_id: ids.coachFull, schedule_slot_id: slots.draft3, branch_id: branchA.id, checkin_time: toIso('2026-05-13', '16:36:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.9042, location_lng: 100.5278 },
      { coach_id: ids.coachHalf, schedule_slot_id: slots.arm1, branch_id: branchA.id, checkin_time: toIso('2026-05-11', '09:36:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.9042, location_lng: 100.5278 },
      { coach_id: ids.coachPart, schedule_slot_id: slots.private1, branch_id: branchB.id, checkin_time: toIso('2026-05-14', '09:32:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.6503, location_lng: 100.6260 },
      { coach_id: ids.coachPart, schedule_slot_id: slots.private2, branch_id: branchB.id, checkin_time: toIso('2026-05-17', '09:35:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: 13.6503, location_lng: 100.6260 },
    ]),
    'insert seed coach checkins',
  )

  const sessionBySlot = new Map()
  ;[...draftBooking.sessions, ...armBooking.sessions, ...adultBooking.sessions, ...privateBooking.sessions, ...pendingBooking.sessions].forEach((session) => {
    sessionBySlot.set(session.schedule_slot_id, session)
  })

  await expectNoError(
    await supabase.from('attendance').insert([
      { booking_session_id: sessionBySlot.get(slots.draft1).id, student_id: childIds.draft, student_type: 'child', coach_id: ids.coachFull, status: 'present', checked_at: toIso('2026-05-11', '19:02:00') },
      { booking_session_id: sessionBySlot.get(slots.draft2).id, student_id: childIds.draft, student_type: 'child', coach_id: ids.coachHalf, status: 'absent', checked_at: toIso('2026-05-12', '19:02:00') },
      { booking_session_id: sessionBySlot.get(slots.draft3).id, student_id: childIds.draft, student_type: 'child', coach_id: ids.coachFull, status: 'late', checked_at: toIso('2026-05-13', '19:02:00') },
      { booking_session_id: sessionBySlot.get(slots.arm1).id, student_id: childIds.arm, student_type: 'child', coach_id: ids.coachHalf, status: 'present', checked_at: toIso('2026-05-11', '12:01:00') },
      { booking_session_id: sessionBySlot.get(slots.private1).id, student_id: ids.adult, student_type: 'adult', coach_id: ids.coachPart, status: 'present', checked_at: toIso('2026-05-14', '12:01:00') },
    ]),
    'insert seed attendance',
  )

  await expectNoError(
    await supabase.from('teaching_programs').insert([
      { coach_id: ids.coachFull, schedule_slot_id: slots.draft1, program_content: `${SEED_NOTE}: Footwork + basic clear drill`, status: 'approved', reviewed_by: ids.headCoach, reviewed_at: toIso('2026-05-11', '20:00:00'), notes: 'Seed approved program' },
      { coach_id: ids.coachHalf, schedule_slot_id: slots.draft2, program_content: `${SEED_NOTE}: Substitute class, game sense and serve receive`, status: 'submitted', reviewed_by: null, reviewed_at: null, notes: 'Seed pending review' },
      { coach_id: ids.coachPart, schedule_slot_id: slots.private1, program_content: `${SEED_NOTE}: Private correction for backhand clear`, status: 'approved', reviewed_by: ids.headCoach, reviewed_at: toIso('2026-05-14', '13:00:00'), notes: 'Seed private class' },
    ]),
    'insert seed teaching programs',
  )

  return {
    slots,
    bookings: { draftBooking, armBooking, adultBooking, privateBooking, pendingBooking },
  }
}

async function seedProgress(ids, childIds) {
  await expectNoError(
    await supabase.from('student_levels').insert([
      { student_id: childIds.draft, student_type: 'child', level: 28, updated_by: ids.coachFull, notes: `${SEED_NOTE}: คุมหน้าไม้และฟุตเวิร์กดีขึ้น` },
      { student_id: childIds.arm, student_type: 'child', level: 12, updated_by: ids.coachHalf, notes: `${SEED_NOTE}: เริ่มจับจังหวะลูกหน้าเน็ตได้ดี` },
      { student_id: ids.adult, student_type: 'adult', level: 36, updated_by: ids.coachPart, notes: `${SEED_NOTE}: ผู้ใหญ่กลุ่ม/Private มีพื้นฐานลูกตบดี` },
    ]),
    'insert seed student levels',
  )

  await expectNoError(
    await supabase.from('student_achievements').insert([
      { student_id: childIds.draft, student_type: 'child', emoji: '🏆', title: 'Seed แชมป์ภายในสาขา', description: 'ชนะ mini match ประจำสาขา', awarded_at: '2026-05-12', is_active: true, created_by: ids.coachFull },
      { student_id: childIds.arm, student_type: 'child', emoji: '🥉', title: 'Seed เหรียญทองแดง', description: 'ผลงานทดสอบ ranking ภายในคลาส', awarded_at: '2026-05-11', is_active: true, created_by: ids.coachHalf },
      { student_id: ids.adult, student_type: 'adult', emoji: '🔥', title: 'Seed ฟอร์มแรง', description: 'พัฒนาความสม่ำเสมอได้ดี', awarded_at: '2026-05-14', is_active: true, created_by: ids.coachPart },
    ]),
    'insert seed student achievements',
  )
}

async function seedWeeklySummaries(ids) {
  await expectNoError(
    await supabase.from('coach_weekly_teaching_summaries').insert([
      {
        coach_id: ids.coachPart,
        week_start: '2026-05-11',
        week_end: getWeekEnd('2026-05-11'),
        coach_employment_type: 'part_time',
        threshold_hours: 0,
        group_hours: 0,
        private_hours: 4,
        total_hours: 4,
        regular_hours: 0,
        payable_group_hours: 0,
        payable_private_hours: 4,
        payable_hours: 4,
        private_rate: 400,
        group_rate: 250,
        payable_amount: 1600,
        payable_session_count: 2,
        missing_checkin_count: 0,
        missing_photo_count: 0,
        status: 'closed',
        notes: `${SEED_NOTE}: Part-Time private weekly payout scenario`,
        snapshot: { seed: SEED_NOTE, scenario: 'part_time_private_weekly' },
        closed_by: ids.super,
        closed_at: toIso('2026-05-18', '09:00:00'),
      },
      {
        coach_id: ids.coachFull,
        week_start: '2026-05-11',
        week_end: getWeekEnd('2026-05-11'),
        coach_employment_type: 'full_time',
        threshold_hours: 25,
        group_hours: 4,
        private_hours: 0,
        total_hours: 4,
        regular_hours: 4,
        payable_group_hours: 0,
        payable_private_hours: 0,
        payable_hours: 0,
        private_rate: 400,
        group_rate: 200,
        payable_amount: 0,
        payable_session_count: 2,
        missing_checkin_count: 0,
        missing_photo_count: 0,
        status: 'closed',
        notes: `${SEED_NOTE}: Full-Time under threshold scenario`,
        snapshot: { seed: SEED_NOTE, scenario: 'full_time_under_threshold' },
        closed_by: ids.super,
        closed_at: toIso('2026-05-18', '09:05:00'),
      },
    ]),
    'insert seed weekly summaries',
  )
}

async function seedNotificationsComplaintsAndLogs(ids, master) {
  await expectNoError(
    await supabase.from('notifications').insert([
      { user_id: ids.parent, title: 'Seed: ชำระเงินสำเร็จ', message: 'ระบบยืนยันการชำระเงินของน้องดราฟแล้ว', type: 'payment', is_read: false, link_url: '/dashboard/history' },
      { user_id: ids.parent, title: 'Seed: ได้รับวันชดเชย', message: 'น้องดราฟมีสิทธิ์ชดเชยจากการขาดเรียน 12 พ.ค. 69', type: 'schedule', is_read: false, link_url: '/dashboard/schedule' },
      { user_id: ids.adult, title: 'Seed: รอบ Private ได้รับการยืนยัน', message: 'รอบเรียน Private ของคุณได้รับการยืนยันแล้ว', type: 'schedule', is_read: false, link_url: '/dashboard/schedule' },
      { user_id: ids.coachFull, title: 'Seed: มีรอบสอนที่ได้รับมอบหมาย', message: 'คุณได้รับมอบหมายรอบสอนของน้องดราฟและผู้ใหญ่กลุ่ม', type: 'schedule', is_read: false, link_url: '/coach/today' },
      { user_id: ids.coachHalf, title: 'Seed: สอนแทนรอบน้องดราฟ', message: 'คุณถูกมอบหมายสอนแทนรอบวันที่ 12 พ.ค. 69', type: 'schedule', is_read: false, link_url: '/coach/today' },
      { user_id: ids.super, title: 'Seed: ข้อมูลทดสอบพร้อมใช้งาน', message: 'ชุดข้อมูล NASC_SEED ถูกสร้างเพื่อทดสอบ flow end-to-end', type: 'system', is_read: false, link_url: '/admin' },
    ]),
    'insert seed notifications',
  )

  await expectNoError(
    await supabase.from('complaints').insert([
      {
        user_id: ids.parent,
        branch_id: master.branchA.id,
        subject: 'Seed: ขอสอบถามรอบชดเชย',
        message: 'ผู้ปกครองต้องการทราบว่ารอบชดเชยของน้องดราฟเลือกได้ถึงวันไหน',
        status: 'open',
        admin_note: null,
        last_updated_by: null,
      },
      {
        user_id: ids.adult,
        branch_id: master.branchB.id,
        subject: 'Seed: ขอเปลี่ยนเวลา Private',
        message: 'ผู้เรียนผู้ใหญ่ต้องการเปลี่ยนรอบ Private ในสัปดาห์ถัดไป',
        status: 'in_progress',
        admin_note: 'Seed admin กำลังตรวจสอบตารางโค้ช',
        last_updated_by: ids.admin,
      },
    ]),
    'insert seed complaints',
  )

  await expectNoError(
    await supabase.from('finance_expenses').insert([
      { expense_date: '2026-05-10', category: 'court_rental', description: `${SEED_NOTE}: ค่าเช่าสนามสำหรับทดสอบ finance overview`, amount: 2500, branch_id: master.branchA.id, created_by: ids.admin },
      { expense_date: '2026-05-12', category: 'equipment', description: `${SEED_NOTE}: ลูกแบดและอุปกรณ์ซ้อม`, amount: 1800, branch_id: master.branchB.id, created_by: ids.super },
    ]),
    'insert seed finance expenses',
  )

  await expectNoError(
    await supabase.from('activity_logs').insert([
      { user_id: ids.parent, action: 'seed_booking_created', entity_type: 'booking', entity_id: null, details: { seed: SEED_NOTE, flow: 'user_booking_payment' }, ip_address: null },
      { user_id: ids.headCoach, action: 'seed_coach_assigned', entity_type: 'coach_assignment', entity_id: null, details: { seed: SEED_NOTE, flow: 'coach_assignment' }, ip_address: null },
      { user_id: ids.coachFull, action: 'seed_level_evaluated', entity_type: 'student_level', entity_id: null, details: { seed: SEED_NOTE, flow: 'coach_level_ranking' }, ip_address: null },
    ]),
    'insert seed activity logs',
  )
}

async function main() {
  console.log('Seeding realistic NASC data into Supabase...')
  console.log(`Seed accounts use password: ${SEED_PASSWORD}`)

  const ids = await seedUsers()
  const master = await fetchMasterData()
  await seedCoachBranches(ids, master)
  const childIds = await seedChildren(ids)
  await seedBookingsAndTeaching(ids, childIds, master)
  await seedProgress(ids, childIds)
  await seedWeeklySummaries(ids)
  await seedNotificationsComplaintsAndLogs(ids, master)

  console.log('Seed completed.')
  console.log('Accounts:')
  for (const account of seedAccounts) {
    console.log(`- ${account.email} / ${SEED_PASSWORD} / ${account.role}`)
  }
  console.log('Primary test scenarios: verified bookings, pending payment, coupon used-up, coach assignment, substitute coach, check-in photo, attendance, levels, achievements, notifications, complaints, weekly teaching summary.')
}

main().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exit(1)
})
