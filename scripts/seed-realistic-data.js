const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SEED_PREFIX = 'seed.nasc+'
const SEED_DOMAIN = 'example.com'
const SEED_PASSWORD = 'NascSeed@2026'
const SEED_NOTE = 'NASC_SEED'
const SEED_DAYS = Number(process.env.SEED_DAYS || 7)
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

function todayLocal() {
  const now = new Date()
  return formatDate(now)
}

function parseDate(dateInput) {
  const [year, month, day] = dateInput.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateInput, days) {
  const date = parseDate(dateInput)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function getDayOfWeek(dateInput) {
  return parseDate(dateInput).getDay()
}

function getWeekStart(dateInput) {
  const date = parseDate(dateInput)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatDate(date)
}

function getWeekEnd(weekStart) {
  return addDays(weekStart, 6)
}

function toIso(dateInput, timeInput) {
  return new Date(`${dateInput}T${timeInput}+07:00`).toISOString()
}

function avatar(name) {
  return `${AVATAR_BASE}${encodeURIComponent(name)}`
}

function branchSlug(branch, index) {
  const raw = String(branch.slug || branch.name || `branch-${index + 1}`).toLowerCase()
  const clean = raw.replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
  return clean || `branch${index + 1}`
}

function buildSeedAccounts(branches) {
  const accounts = [
    { key: 'super', email: `${SEED_PREFIX}super@${SEED_DOMAIN}`, fullName: 'Seed Super Admin', phone: '080-000-9001', role: 'super_admin' },
    { key: 'admin', email: `${SEED_PREFIX}admin@${SEED_DOMAIN}`, fullName: 'Seed Admin Monitor', phone: '080-000-9002', role: 'admin' },
  ]

  branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    const label = branch.name || `สาขา ${index + 1}`
    accounts.push(
      { key: `head_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}head.${slug}@${SEED_DOMAIN}`, fullName: `หัวหน้าโค้ช Seed ${label}`, phone: `080-10${String(index).padStart(2, '0')}-0001`, role: 'head_coach', employmentType: 'full_time' },
      { key: `full_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}full.${slug}@${SEED_DOMAIN}`, fullName: `โค้ช Full-Time Seed ${label}`, phone: `080-10${String(index).padStart(2, '0')}-0002`, role: 'coach', employmentType: 'full_time' },
      { key: `half_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}half.${slug}@${SEED_DOMAIN}`, fullName: `โค้ช Half-Time Seed ${label}`, phone: `080-10${String(index).padStart(2, '0')}-0003`, role: 'coach', employmentType: 'half_time' },
      { key: `part_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}part.${slug}@${SEED_DOMAIN}`, fullName: `โค้ช Part-Time Seed ${label}`, phone: `080-10${String(index).padStart(2, '0')}-0004`, role: 'coach', employmentType: 'part_time' },
      { key: `parent_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}parent.${slug}@${SEED_DOMAIN}`, fullName: `ผู้ปกครอง Seed ${label}`, phone: `080-20${String(index).padStart(2, '0')}-0001`, role: 'user' },
      { key: `adult_group_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}adult.group.${slug}@${SEED_DOMAIN}`, fullName: `ผู้ใหญ่กลุ่ม Seed ${label}`, phone: `080-20${String(index).padStart(2, '0')}-0002`, role: 'user' },
      { key: `adult_private_${slug}`, branchSlug: slug, email: `${SEED_PREFIX}adult.private.${slug}@${SEED_DOMAIN}`, fullName: `ผู้ใหญ่ Private Seed ${label}`, phone: `080-20${String(index).padStart(2, '0')}-0003`, role: 'user' },
    )
  })

  return accounts
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

async function findAuthUserByEmail(email, authUsers) {
  return authUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

async function ensureAuthUser(account, authUsers) {
  const existing = await findAuthUserByEmail(account.email, authUsers)

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
  authUsers.push(data.user)
  return data.user.id
}

async function deleteWhereIn(table, column, values) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  if (!uniqueValues.length) return
  await expectNoError(await supabase.from(table).delete().in(column, uniqueValues), `delete ${table}`)
}

async function fetchSeedProfiles() {
  return expectNoError(
    await supabase.from('profiles').select('id, email').like('email', `${SEED_PREFIX}%`),
    'fetch seed profiles',
  )
}

async function cleanupSeed({ deleteAuthUsers = false } = {}) {
  const seedProfiles = await fetchSeedProfiles()
  const seedUserIds = (seedProfiles || []).map((profile) => profile.id)
  const authUsers = await listAllAuthUsers()
  const seedAuthUsers = authUsers.filter((user) => user.email?.toLowerCase().startsWith(SEED_PREFIX))

  if (!seedUserIds.length && !seedAuthUsers.length) {
    console.log('No NASC seed data found.')
    return
  }

  const seedChildren = seedUserIds.length
    ? await expectNoError(await supabase.from('children').select('id').in('parent_id', seedUserIds), 'fetch seed children')
    : []
  const seedChildIds = (seedChildren || []).map((child) => child.id)

  const seedBookings = seedUserIds.length
    ? await expectNoError(await supabase.from('bookings').select('id').in('user_id', seedUserIds), 'fetch seed bookings')
    : []
  const seedBookingIds = (seedBookings || []).map((booking) => booking.id)

  const seedSessions = seedBookingIds.length
    ? await expectNoError(
      await supabase.from('booking_sessions').select('id, schedule_slot_id').in('booking_id', seedBookingIds),
      'fetch seed sessions',
    )
    : []
  const seedSessionIds = (seedSessions || []).map((session) => session.id)
  const seedSlotIds = Array.from(new Set((seedSessions || []).map((session) => session.schedule_slot_id).filter(Boolean)))

  const groupsByCoach = seedUserIds.length
    ? await expectNoError(await supabase.from('coach_assignment_groups').select('id').in('coach_id', seedUserIds), 'fetch seed groups by coach')
    : []
  const groupsByCreator = seedUserIds.length
    ? await expectNoError(await supabase.from('coach_assignment_groups').select('id').in('created_by', seedUserIds), 'fetch seed groups by creator')
    : []
  const groupsBySlot = seedSlotIds.length
    ? await expectNoError(await supabase.from('coach_assignment_groups').select('id').in('schedule_slot_id', seedSlotIds), 'fetch seed groups by slot')
    : []
  const seedGroupIds = Array.from(new Set([...groupsByCoach, ...groupsByCreator, ...groupsBySlot].map((group) => group.id)))

  const seedCoupons = seedUserIds.length
    ? await expectNoError(await supabase.from('coupons').select('id').in('created_by', seedUserIds), 'fetch seed coupons')
    : []
  const seedCouponIds = (seedCoupons || []).map((coupon) => coupon.id)

  await deleteWhereIn('coach_assignment_group_students', 'booking_session_id', seedSessionIds)
  await deleteWhereIn('coach_assignment_group_students', 'group_id', seedGroupIds)
  await deleteWhereIn('coach_assignment_groups', 'id', seedGroupIds)
  await deleteWhereIn('activity_logs', 'user_id', seedUserIds)
  await deleteWhereIn('notifications', 'user_id', seedUserIds)
  await deleteWhereIn('coach_weekly_teaching_summaries', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_payouts', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_teaching_hours', 'coach_id', seedUserIds)
  await deleteWhereIn('teaching_programs', 'coach_id', seedUserIds)
  await deleteWhereIn('attendance', 'booking_session_id', seedSessionIds)
  await deleteWhereIn('attendance', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_checkins', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_assignments', 'coach_id', seedUserIds)
  await deleteWhereIn('coach_assignments', 'assigned_by', seedUserIds)
  await deleteWhereIn('coupon_usages', 'booking_id', seedBookingIds)
  await deleteWhereIn('coupon_usages', 'coupon_id', seedCouponIds)
  await deleteWhereIn('payments', 'booking_id', seedBookingIds)
  await deleteWhereIn('payments', 'user_id', seedUserIds)
  await deleteWhereIn('booking_sessions', 'booking_id', seedBookingIds)
  await deleteWhereIn('bookings', 'id', seedBookingIds)
  await deleteWhereIn('student_levels', 'student_id', [...seedUserIds, ...seedChildIds])
  await deleteWhereIn('student_levels', 'updated_by', seedUserIds)
  await deleteWhereIn('student_achievements', 'student_id', [...seedUserIds, ...seedChildIds])
  await deleteWhereIn('student_achievements', 'created_by', seedUserIds)
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

  if (deleteAuthUsers) {
    for (const user of seedAuthUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error) throw error
    }
    await deleteWhereIn('profiles', 'id', seedUserIds)
  }

  console.log(`Cleaned NASC seed data for ${seedUserIds.length || seedAuthUsers.length} seed users.`)
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
  const courseByName = Object.fromEntries(courseTypes.map((course) => [course.name, course]))
  for (const name of ['kids_group', 'adult_group', 'private']) {
    if (!courseByName[name]) throw new Error(`Missing course type: ${name}`)
  }

  return { branches, courseByName, templates }
}

async function seedUsers(accounts) {
  const authUsers = await listAllAuthUsers()
  const ids = {}

  for (const account of accounts) {
    ids[account.key] = await ensureAuthUser(account, authUsers)
  }

  const profileRows = accounts.map((account) => ({
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

async function seedCoachBranches(ids, master) {
  const rows = []
  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    rows.push(
      { coach_id: ids[`head_${slug}`], branch_id: branch.id, is_head_coach: true },
      { coach_id: ids[`full_${slug}`], branch_id: branch.id, is_head_coach: false },
      { coach_id: ids[`half_${slug}`], branch_id: branch.id, is_head_coach: false },
      { coach_id: ids[`part_${slug}`], branch_id: branch.id, is_head_coach: false },
    )
  })

  await expectNoError(
    await supabase.from('coach_branches').upsert(rows, { onConflict: 'coach_id,branch_id' }),
    'upsert seed coach branches',
  )
}

async function seedLearners(ids, master) {
  const learnersByBranch = {}
  const childRows = []

  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    childRows.push(
      {
        key: `kid_beginner_${slug}`,
        parent_id: ids[`parent_${slug}`],
        full_name: `ด.ช. Seed Beginner ${branch.name}`,
        nickname: `น้องเบสิก ${index + 1}`,
        date_of_birth: '2018-01-10',
        gender: 'male',
        avatar_url: avatar(`น้องเบสิก ${branch.name}`),
      },
      {
        key: `kid_intermediate_${slug}`,
        parent_id: ids[`parent_${slug}`],
        full_name: `ด.ญ. Seed Rally ${branch.name}`,
        nickname: `น้องแรลลี่ ${index + 1}`,
        date_of_birth: '2016-06-15',
        gender: 'female',
        avatar_url: avatar(`น้องแรลลี่ ${branch.name}`),
      },
      {
        key: `kid_advanced_${slug}`,
        parent_id: ids[`parent_${slug}`],
        full_name: `ด.ช. Seed Smash ${branch.name}`,
        nickname: `น้องสแมช ${index + 1}`,
        date_of_birth: '2014-09-20',
        gender: 'male',
        avatar_url: avatar(`น้องสแมช ${branch.name}`),
      },
    )
  })

  const insertedChildren = await expectNoError(
    await supabase
      .from('children')
      .insert(childRows.map(({ key, ...row }) => row))
      .select('id, full_name, nickname'),
    'insert seed children',
  )

  let childIndex = 0
  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    learnersByBranch[slug] = {
      beginner: { studentId: insertedChildren[childIndex++].id, studentType: 'child', learnerType: 'child', level: 0, label: `น้องเบสิก ${index + 1}` },
      intermediate: { studentId: insertedChildren[childIndex++].id, studentType: 'child', learnerType: 'child', level: 22, label: `น้องแรลลี่ ${index + 1}` },
      advanced: { studentId: insertedChildren[childIndex++].id, studentType: 'child', learnerType: 'child', level: 58, label: `น้องสแมช ${index + 1}` },
      adultGroup: { studentId: ids[`adult_group_${slug}`], studentType: 'adult', learnerType: 'self', level: 18, label: `ผู้ใหญ่กลุ่ม ${index + 1}` },
      adultPrivate: { studentId: ids[`adult_private_${slug}`], studentType: 'adult', learnerType: 'self', level: 42, label: `ผู้ใหญ่ Private ${index + 1}` },
    }
  })

  return learnersByBranch
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
    max_students: slot.maxStudents,
    current_students: slot.currentStudents,
    status: 'open',
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

async function createBooking({ userId, learnerType, childId = null, branchId, courseTypeId, sessions, totalPrice, status = 'verified' }) {
  const start = parseDate(sessions[0].date)
  const booking = await expectNoError(
    await supabase
      .from('bookings')
      .insert({
        user_id: userId,
        learner_type: learnerType,
        child_id: childId,
        branch_id: branchId,
        course_type_id: courseTypeId,
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        total_sessions: sessions.length,
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
    is_makeup: false,
  }))

  const insertedSessions = await expectNoError(
    await supabase
      .from('booking_sessions')
      .insert(sessionRows)
      .select('id, booking_id, schedule_slot_id, date, start_time, end_time, status'),
    'insert seed booking sessions',
  )

  return { bookingId: booking.id, sessions: insertedSessions }
}

function branchLocation(index) {
  return {
    lat: 13.72 + index * 0.018,
    lng: 100.48 + index * 0.017,
  }
}

async function insertGroup({ slotId, coachId, name, levelMin, levelMax, sortOrder, createdBy, students }) {
  const group = await expectNoError(
    await supabase
      .from('coach_assignment_groups')
      .insert({
        schedule_slot_id: slotId,
        coach_id: coachId,
        name,
        level_min: levelMin,
        level_max: levelMax,
        sort_order: sortOrder,
        notes: `${SEED_NOTE}: generated group assignment`,
        created_by: createdBy,
      })
      .select('id')
      .single(),
    'insert seed assignment group',
  )

  await expectNoError(
    await supabase.from('coach_assignment_group_students').insert(students.map((student) => ({
      group_id: group.id,
      booking_session_id: student.bookingSessionId,
      student_id: student.studentId,
      student_type: student.studentType,
    }))),
    'insert seed assignment group students',
  )

  return group.id
}

async function seedBookingsTeachingAndGroups(ids, learnersByBranch, master, startDate) {
  const kids = master.courseByName.kids_group
  const adult = master.courseByName.adult_group
  const privateCourse = master.courseByName.private
  const allSessions = []
  const allSlots = []
  const assignments = []
  const checkins = []
  const attendance = []
  const teachingPrograms = []

  for (const [branchIndex, branch] of master.branches.entries()) {
    const slug = branchSlug(branch, branchIndex)
    const learners = learnersByBranch[slug]
    const branchSlots = []

    for (let dayIndex = 0; dayIndex < SEED_DAYS; dayIndex += 1) {
      const date = addDays(startDate, dayIndex)
      const kidsSlotId = await ensureSlot(master, {
        branchId: branch.id,
        courseTypeId: kids.id,
        date,
        startTime: '17:00',
        endTime: '19:00',
        maxStudents: kids.max_students,
        currentStudents: 3,
      })
      const adultSlotId = await ensureSlot(master, {
        branchId: branch.id,
        courseTypeId: adult.id,
        date,
        startTime: '10:00',
        endTime: '12:00',
        maxStudents: adult.max_students,
        currentStudents: 1,
      })
      const privateSlotId = await ensureSlot(master, {
        branchId: branch.id,
        courseTypeId: privateCourse.id,
        date,
        startTime: '15:00',
        endTime: '17:00',
        maxStudents: privateCourse.max_students,
        currentStudents: 1,
      })

      branchSlots.push({ date, kidsSlotId, adultSlotId, privateSlotId })
      allSlots.push(kidsSlotId, adultSlotId, privateSlotId)
    }

    const beginnerBooking = await createBooking({
      userId: ids[`parent_${slug}`],
      learnerType: 'child',
      childId: learners.beginner.studentId,
      branchId: branch.id,
      courseTypeId: kids.id,
      totalPrice: 4900,
      sessions: branchSlots.map((slot, index) => ({
        slotId: slot.kidsSlotId,
        date: slot.date,
        startTime: '17:00',
        endTime: '19:00',
        status: index === 0 ? 'completed' : 'scheduled',
      })),
    })
    const intermediateBooking = await createBooking({
      userId: ids[`parent_${slug}`],
      learnerType: 'child',
      childId: learners.intermediate.studentId,
      branchId: branch.id,
      courseTypeId: kids.id,
      totalPrice: 4900,
      sessions: branchSlots.map((slot, index) => ({
        slotId: slot.kidsSlotId,
        date: slot.date,
        startTime: '17:00',
        endTime: '19:00',
        status: index === 0 ? 'absent' : 'scheduled',
      })),
    })
    const advancedBooking = await createBooking({
      userId: ids[`parent_${slug}`],
      learnerType: 'child',
      childId: learners.advanced.studentId,
      branchId: branch.id,
      courseTypeId: kids.id,
      totalPrice: 4900,
      sessions: branchSlots.map((slot, index) => ({
        slotId: slot.kidsSlotId,
        date: slot.date,
        startTime: '17:00',
        endTime: '19:00',
        status: index === 0 ? 'completed' : 'scheduled',
      })),
    })
    const adultGroupBooking = await createBooking({
      userId: learners.adultGroup.studentId,
      learnerType: 'self',
      branchId: branch.id,
      courseTypeId: adult.id,
      totalPrice: 4200,
      sessions: branchSlots.map((slot, index) => ({
        slotId: slot.adultSlotId,
        date: slot.date,
        startTime: '10:00',
        endTime: '12:00',
        status: index === 0 ? 'completed' : 'scheduled',
      })),
    })
    const privateBooking = await createBooking({
      userId: learners.adultPrivate.studentId,
      learnerType: 'self',
      branchId: branch.id,
      courseTypeId: privateCourse.id,
      totalPrice: 5600,
      sessions: branchSlots.map((slot, index) => ({
        slotId: slot.privateSlotId,
        date: slot.date,
        startTime: '15:00',
        endTime: '17:00',
        status: index === 0 ? 'completed' : 'scheduled',
      })),
    })

    const branchSessionRows = [
      ...beginnerBooking.sessions.map((session) => ({ ...session, learner: learners.beginner, coachId: ids[`full_${slug}`] })),
      ...intermediateBooking.sessions.map((session) => ({ ...session, learner: learners.intermediate, coachId: ids[`full_${slug}`] })),
      ...advancedBooking.sessions.map((session) => ({ ...session, learner: learners.advanced, coachId: ids[`half_${slug}`] })),
      ...adultGroupBooking.sessions.map((session, index) => ({ ...session, learner: learners.adultGroup, coachId: index % 3 === 0 ? ids[`head_${slug}`] : ids[`full_${slug}`] })),
      ...privateBooking.sessions.map((session) => ({ ...session, learner: learners.adultPrivate, coachId: ids[`part_${slug}`] })),
    ]
    allSessions.push(...branchSessionRows)

    await expectNoError(
      await supabase.from('payments').insert([
        { booking_id: beginnerBooking.bookingId, user_id: ids[`parent_${slug}`], amount: 4900, method: 'transfer', slip_image_url: SLIP_URL, status: 'approved', verified_by: ids.super, verified_at: toIso(startDate, '08:30:00'), notes: `${SEED_NOTE}: beginner kid 7-day booking` },
        { booking_id: intermediateBooking.bookingId, user_id: ids[`parent_${slug}`], amount: 4700, method: 'transfer', slip_image_url: SLIP_URL, status: 'approved', verified_by: ids.super, verified_at: toIso(startDate, '08:35:00'), notes: `${SEED_NOTE}: intermediate kid coupon booking` },
        { booking_id: advancedBooking.bookingId, user_id: ids[`parent_${slug}`], amount: 4900, method: 'transfer', slip_image_url: SLIP_URL, status: 'approved', verified_by: ids.admin, verified_at: toIso(startDate, '08:40:00'), notes: `${SEED_NOTE}: advanced kid booking` },
        { booking_id: adultGroupBooking.bookingId, user_id: learners.adultGroup.studentId, amount: 4200, method: 'transfer', slip_image_url: SLIP_URL, status: 'approved', verified_by: ids.admin, verified_at: toIso(startDate, '08:45:00'), notes: `${SEED_NOTE}: adult group booking` },
        { booking_id: privateBooking.bookingId, user_id: learners.adultPrivate.studentId, amount: 5600, method: 'transfer', slip_image_url: SLIP_URL, status: 'approved', verified_by: ids.super, verified_at: toIso(startDate, '08:50:00'), notes: `${SEED_NOTE}: private booking` },
      ]),
      'insert seed payments',
    )

    for (let dayIndex = 0; dayIndex < branchSlots.length; dayIndex += 1) {
      const slot = branchSlots[dayIndex]
      const kidsSessions = [
        beginnerBooking.sessions[dayIndex],
        intermediateBooking.sessions[dayIndex],
        advancedBooking.sessions[dayIndex],
      ]
      const adultSession = adultGroupBooking.sessions[dayIndex]
      const privateSession = privateBooking.sessions[dayIndex]
      const adultCoachId = dayIndex % 3 === 0 ? ids[`head_${slug}`] : ids[`full_${slug}`]

      assignments.push(
        { coach_id: ids[`full_${slug}`], schedule_slot_id: slot.kidsSlotId, assigned_by: ids[`head_${slug}`] },
        { coach_id: ids[`half_${slug}`], schedule_slot_id: slot.kidsSlotId, assigned_by: ids[`head_${slug}`] },
        { coach_id: adultCoachId, schedule_slot_id: slot.adultSlotId, assigned_by: ids[`head_${slug}`] },
        { coach_id: ids[`part_${slug}`], schedule_slot_id: slot.privateSlotId, assigned_by: ids[`head_${slug}`] },
      )

      await insertGroup({
        slotId: slot.kidsSlotId,
        coachId: ids[`full_${slug}`],
        name: 'กลุ่มพื้นฐาน-กลาง',
        levelMin: 0,
        levelMax: 30,
        sortOrder: 1,
        createdBy: ids[`head_${slug}`],
        students: [
          { bookingSessionId: kidsSessions[0].id, studentId: learners.beginner.studentId, studentType: learners.beginner.studentType },
          { bookingSessionId: kidsSessions[1].id, studentId: learners.intermediate.studentId, studentType: learners.intermediate.studentType },
        ],
      })
      await insertGroup({
        slotId: slot.kidsSlotId,
        coachId: ids[`half_${slug}`],
        name: 'กลุ่มพัฒนาแข่งขัน',
        levelMin: 45,
        levelMax: 70,
        sortOrder: 2,
        createdBy: ids[`head_${slug}`],
        students: [
          { bookingSessionId: kidsSessions[2].id, studentId: learners.advanced.studentId, studentType: learners.advanced.studentType },
        ],
      })
      await insertGroup({
        slotId: slot.adultSlotId,
        coachId: adultCoachId,
        name: 'ผู้ใหญ่กลุ่ม',
        levelMin: 10,
        levelMax: 35,
        sortOrder: 1,
        createdBy: ids[`head_${slug}`],
        students: [
          { bookingSessionId: adultSession.id, studentId: learners.adultGroup.studentId, studentType: learners.adultGroup.studentType },
        ],
      })
      await insertGroup({
        slotId: slot.privateSlotId,
        coachId: ids[`part_${slug}`],
        name: 'Private พัฒนาเฉพาะบุคคล',
        levelMin: 35,
        levelMax: 60,
        sortOrder: 1,
        createdBy: ids[`head_${slug}`],
        students: [
          { bookingSessionId: privateSession.id, studentId: learners.adultPrivate.studentId, studentType: learners.adultPrivate.studentType },
        ],
      })

      if (dayIndex === 0) {
        const location = branchLocation(branchIndex)
        checkins.push(
          { coach_id: ids[`head_${slug}`], schedule_slot_id: slot.adultSlotId, branch_id: branch.id, checkin_time: toIso(slot.date, '09:35:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: location.lat, location_lng: location.lng },
          { coach_id: ids[`full_${slug}`], schedule_slot_id: slot.kidsSlotId, branch_id: branch.id, checkin_time: toIso(slot.date, '16:35:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: location.lat, location_lng: location.lng },
          { coach_id: ids[`half_${slug}`], schedule_slot_id: slot.kidsSlotId, branch_id: branch.id, checkin_time: toIso(slot.date, '16:38:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: location.lat, location_lng: location.lng },
          { coach_id: ids[`part_${slug}`], schedule_slot_id: slot.privateSlotId, branch_id: branch.id, checkin_time: toIso(slot.date, '14:35:00'), photo_url: CHECKIN_PHOTO_URL, location_lat: location.lat, location_lng: location.lng },
        )
        attendance.push(
          { booking_session_id: kidsSessions[0].id, student_id: learners.beginner.studentId, student_type: 'child', coach_id: ids[`full_${slug}`], status: 'present', checked_at: toIso(slot.date, '19:02:00') },
          { booking_session_id: kidsSessions[1].id, student_id: learners.intermediate.studentId, student_type: 'child', coach_id: ids[`full_${slug}`], status: 'absent', checked_at: toIso(slot.date, '19:03:00') },
          { booking_session_id: kidsSessions[2].id, student_id: learners.advanced.studentId, student_type: 'child', coach_id: ids[`half_${slug}`], status: 'late', checked_at: toIso(slot.date, '19:04:00') },
          { booking_session_id: adultSession.id, student_id: learners.adultGroup.studentId, student_type: 'adult', coach_id: ids[`head_${slug}`], status: 'present', checked_at: toIso(slot.date, '12:02:00') },
          { booking_session_id: privateSession.id, student_id: learners.adultPrivate.studentId, student_type: 'adult', coach_id: ids[`part_${slug}`], status: 'present', checked_at: toIso(slot.date, '17:02:00') },
        )
        teachingPrograms.push(
          { coach_id: ids[`head_${slug}`], schedule_slot_id: slot.adultSlotId, program_content: `${SEED_NOTE}: adult group rally control and serve receive`, status: 'approved', reviewed_by: ids.super, reviewed_at: toIso(slot.date, '13:00:00'), notes: 'Seed approved adult group program' },
          { coach_id: ids[`full_${slug}`], schedule_slot_id: slot.kidsSlotId, program_content: `${SEED_NOTE}: beginner/intermediate footwork, clear, and net approach`, status: 'approved', reviewed_by: ids[`head_${slug}`], reviewed_at: toIso(slot.date, '20:00:00'), notes: 'Seed kids group program' },
          { coach_id: ids[`half_${slug}`], schedule_slot_id: slot.kidsSlotId, program_content: `${SEED_NOTE}: advanced match pattern and attack transition`, status: 'submitted', reviewed_by: null, reviewed_at: null, notes: 'Seed pending review' },
          { coach_id: ids[`part_${slug}`], schedule_slot_id: slot.privateSlotId, program_content: `${SEED_NOTE}: private backhand correction and smash timing`, status: 'approved', reviewed_by: ids[`head_${slug}`], reviewed_at: toIso(slot.date, '18:00:00'), notes: 'Seed private program' },
        )
      }
    }
  }

  await expectNoError(await supabase.from('coach_assignments').upsert(assignments, { onConflict: 'coach_id,schedule_slot_id' }), 'upsert seed coach assignments')
  await expectNoError(await supabase.from('coach_checkins').insert(checkins), 'insert seed coach checkins')
  await expectNoError(await supabase.from('attendance').insert(attendance), 'insert seed attendance')
  await expectNoError(await supabase.from('teaching_programs').insert(teachingPrograms), 'insert seed teaching programs')

  return { allSessions, allSlots }
}

async function seedCoupons(ids, master, startDate) {
  const validTo = addDays(startDate, 30)
  const rows = [
    { code: 'NASCSEED1', discount_type: 'fixed', discount_value: 200, min_purchase: 1000, max_uses: 1, current_uses: 1, valid_from: startDate, valid_to: validTo, created_by: ids.super, is_active: false },
    { code: 'NASCSEED50', discount_type: 'percent', discount_value: 10, min_purchase: 1000, max_uses: 50, current_uses: 0, valid_from: startDate, valid_to: validTo, created_by: ids.super, is_active: true },
  ]
  const coupons = await expectNoError(await supabase.from('coupons').insert(rows).select('id, code'), 'insert seed coupons')

  const parentIds = master.branches.map((branch, index) => ids[`parent_${branchSlug(branch, index)}`])
  const firstParentBookings = await expectNoError(
    await supabase.from('bookings').select('id, user_id').in('user_id', parentIds).limit(1),
    'fetch seed booking for coupon usage',
  )
  const usedCoupon = coupons.find((coupon) => coupon.code === 'NASCSEED1')
  if (usedCoupon && firstParentBookings?.[0]) {
    await expectNoError(
      await supabase.from('coupon_usages').insert({
        coupon_id: usedCoupon.id,
        user_id: firstParentBookings[0].user_id,
        booking_id: firstParentBookings[0].id,
        discount_amount: 200,
        used_at: toIso(startDate, '08:20:00'),
      }),
      'insert seed coupon usage',
    )
  }
}

async function seedProgress(ids, learnersByBranch, master, startDate) {
  const levelRows = []
  const achievementRows = []

  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    const learners = learnersByBranch[slug]
    const updatedBy = ids[`head_${slug}`]
    const coachFull = ids[`full_${slug}`]
    const coachHalf = ids[`half_${slug}`]
    const coachPart = ids[`part_${slug}`]

    levelRows.push(
      { student_id: learners.beginner.studentId, student_type: 'child', level: learners.beginner.level, updated_by: coachFull, notes: `${SEED_NOTE}: เริ่มต้นจาก Level 0` },
      { student_id: learners.intermediate.studentId, student_type: 'child', level: learners.intermediate.level, updated_by: coachFull, notes: `${SEED_NOTE}: คุมหน้าไม้และฟุตเวิร์กพื้นฐานได้ดี` },
      { student_id: learners.advanced.studentId, student_type: 'child', level: learners.advanced.level, updated_by: coachHalf, notes: `${SEED_NOTE}: พร้อมซ้อมกลุ่มแข่งขัน` },
      { student_id: learners.adultGroup.studentId, student_type: 'adult', level: learners.adultGroup.level, updated_by: updatedBy, notes: `${SEED_NOTE}: ผู้ใหญ่กลุ่ม เน้นจังหวะและความสม่ำเสมอ` },
      { student_id: learners.adultPrivate.studentId, student_type: 'adult', level: learners.adultPrivate.level, updated_by: coachPart, notes: `${SEED_NOTE}: Private เน้นแก้รายละเอียดรายบุคคล` },
    )
    achievementRows.push(
      { student_id: learners.advanced.studentId, student_type: 'child', emoji: '🏆', title: `แชมป์ Seed ${branch.name}`, description: 'ชนะ mini match ประจำสาขา', awarded_at: startDate, is_active: true, created_by: coachHalf },
      { student_id: learners.intermediate.studentId, student_type: 'child', emoji: '🥉', title: `พัฒนาดี Seed ${branch.name}`, description: 'พัฒนา footwork และ rally ได้ต่อเนื่อง', awarded_at: startDate, is_active: true, created_by: coachFull },
      { student_id: learners.adultPrivate.studentId, student_type: 'adult', emoji: '🔥', title: `ฟอร์มแรง Seed ${branch.name}`, description: 'แก้จังหวะตีและการเคลื่อนที่ได้ดี', awarded_at: startDate, is_active: true, created_by: coachPart },
    )
  })

  await expectNoError(await supabase.from('student_levels').insert(levelRows), 'insert seed student levels')
  await expectNoError(await supabase.from('student_achievements').insert(achievementRows), 'insert seed student achievements')
}

async function seedWeeklySummaries(ids, master, startDate) {
  const weekStart = getWeekStart(startDate)
  const weekEnd = getWeekEnd(weekStart)
  const rows = []

  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    rows.push(
      {
        coach_id: ids[`head_${slug}`],
        week_start: weekStart,
        week_end: weekEnd,
        coach_employment_type: 'full_time',
        threshold_hours: 25,
        group_hours: 2,
        private_hours: 0,
        total_hours: 2,
        regular_hours: 2,
        payable_group_hours: 0,
        payable_private_hours: 0,
        payable_hours: 0,
        private_rate: 400,
        group_rate: 200,
        payable_amount: 0,
        payable_session_count: 1,
        missing_checkin_count: 0,
        missing_photo_count: 0,
        status: 'closed',
        notes: `${SEED_NOTE}: current week head coach teaching scenario`,
        snapshot: { seed: SEED_NOTE, scenario: 'head_coach_teaches_adult_group' },
        closed_by: ids.super,
        closed_at: toIso(startDate, '21:00:00'),
      },
      {
        coach_id: ids[`part_${slug}`],
        week_start: weekStart,
        week_end: weekEnd,
        coach_employment_type: 'part_time',
        threshold_hours: 0,
        group_hours: 0,
        private_hours: 2,
        total_hours: 2,
        regular_hours: 0,
        payable_group_hours: 0,
        payable_private_hours: 2,
        payable_hours: 2,
        private_rate: 400,
        group_rate: 250,
        payable_amount: 800,
        payable_session_count: 1,
        missing_checkin_count: 0,
        missing_photo_count: 0,
        status: 'closed',
        notes: `${SEED_NOTE}: part-time private payout scenario`,
        snapshot: { seed: SEED_NOTE, scenario: 'part_time_private' },
        closed_by: ids.super,
        closed_at: toIso(startDate, '21:05:00'),
      },
    )
  })

  await expectNoError(await supabase.from('coach_weekly_teaching_summaries').insert(rows), 'insert seed weekly summaries')
}

async function seedNotificationsComplaintsAndLogs(ids, learnersByBranch, master, startDate) {
  const notifications = []
  const complaints = []
  const expenses = []
  const logs = []

  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    const learners = learnersByBranch[slug]
    notifications.push(
      { user_id: ids[`parent_${slug}`], title: `Seed: ชำระเงินสำเร็จ ${branch.name}`, message: `ระบบยืนยัน booking 7 วันของ ${learners.beginner.label}, ${learners.intermediate.label}, ${learners.advanced.label}`, type: 'payment', is_read: false, link_url: '/dashboard/history' },
      { user_id: ids[`head_${slug}`], title: `Seed: มีรอบต้องจัดกลุ่ม ${branch.name}`, message: 'มีนักเรียนหลายระดับในรอบเด็กกลุ่ม 17:00-19:00 ให้ตรวจการจัดกลุ่ม', type: 'schedule', is_read: false, link_url: '/coach/assign-groups' },
      { user_id: ids[`full_${slug}`], title: `Seed: ได้รับมอบหมายรอบสอน ${branch.name}`, message: 'คุณได้รับกลุ่มพื้นฐาน-กลางและผู้ใหญ่กลุ่มใน 7 วันข้างหน้า', type: 'schedule', is_read: false, link_url: '/coach/today' },
      { user_id: ids[`part_${slug}`], title: `Seed: Private class ${branch.name}`, message: 'มีรอบ Private ทุกวันสำหรับทดสอบชั่วโมงสอน Part-Time', type: 'schedule', is_read: false, link_url: '/coach/hours' },
    )
    complaints.push({
      user_id: ids[`parent_${slug}`],
      branch_id: branch.id,
      subject: `Seed: สอบถามการจัดกลุ่ม ${branch.name}`,
      message: 'ผู้ปกครองต้องการทราบว่านักเรียนต่าง Level ถูกแยกกลุ่มอย่างไร',
      status: index % 2 === 0 ? 'open' : 'in_progress',
    })
    expenses.push({
      expense_date: startDate,
      category: 'court_rental',
      description: `${SEED_NOTE}: ค่าเช่าสนามทดสอบ ${branch.name}`,
      amount: 1500 + index * 100,
      branch_id: branch.id,
      created_by: ids.admin,
    })
    logs.push(
      { user_id: ids[`head_${slug}`], action: 'seed_assignment_groups_created', entity_type: 'coach_assignment_group', entity_id: null, details: { seed: SEED_NOTE, branch: branch.name }, ip_address: null },
      { user_id: ids[`full_${slug}`], action: 'seed_coach_schedule_ready', entity_type: 'schedule_slot', entity_id: null, details: { seed: SEED_NOTE, days: SEED_DAYS }, ip_address: null },
    )
  })

  notifications.push({ user_id: ids.super, title: 'Seed: ข้อมูลจำลอง 7 วันพร้อมทดสอบ', message: `สร้างข้อมูลตั้งแต่ ${startDate} จำนวน ${SEED_DAYS} วัน ครบทุกสาขา`, type: 'system', is_read: false, link_url: '/admin' })

  await expectNoError(await supabase.from('notifications').insert(notifications), 'insert seed notifications')
  await expectNoError(await supabase.from('complaints').insert(complaints), 'insert seed complaints')
  await expectNoError(await supabase.from('finance_expenses').insert(expenses), 'insert seed finance expenses')
  await expectNoError(await supabase.from('activity_logs').insert(logs), 'insert seed activity logs')
}

async function main() {
  const cleanupOnly = process.argv.includes('--cleanup')
  const startDate = process.env.SEED_START_DATE || todayLocal()

  if (cleanupOnly) {
    console.log('Cleaning NASC realistic seed data from Supabase...')
    await cleanupSeed({ deleteAuthUsers: true })
    console.log('Seed cleanup completed.')
    return
  }

  console.log('Seeding realistic NASC data into Supabase...')
  console.log(`Seed window: ${startDate} to ${addDays(startDate, SEED_DAYS - 1)} (${SEED_DAYS} days)`)
  console.log(`Seed accounts use password: ${SEED_PASSWORD}`)

  const master = await fetchMasterData()
  const accounts = buildSeedAccounts(master.branches)

  await cleanupSeed({ deleteAuthUsers: true })
  const ids = await seedUsers(accounts)
  await seedCoachBranches(ids, master)
  const learnersByBranch = await seedLearners(ids, master)
  await seedBookingsTeachingAndGroups(ids, learnersByBranch, master, startDate)
  await seedCoupons(ids, master, startDate)
  await seedProgress(ids, learnersByBranch, master, startDate)
  await seedWeeklySummaries(ids, master, startDate)
  await seedNotificationsComplaintsAndLogs(ids, learnersByBranch, master, startDate)

  console.log('Seed completed.')
  console.log('Primary accounts:')
  console.log(`- ${SEED_PREFIX}super@${SEED_DOMAIN} / ${SEED_PASSWORD} / super_admin`)
  console.log(`- ${SEED_PREFIX}admin@${SEED_DOMAIN} / ${SEED_PASSWORD} / admin`)
  master.branches.forEach((branch, index) => {
    const slug = branchSlug(branch, index)
    console.log(`- ${SEED_PREFIX}head.${slug}@${SEED_DOMAIN} / ${SEED_PASSWORD} / head_coach / ${branch.name}`)
    console.log(`- ${SEED_PREFIX}full.${slug}@${SEED_DOMAIN} / ${SEED_PASSWORD} / coach full_time / ${branch.name}`)
    console.log(`- ${SEED_PREFIX}part.${slug}@${SEED_DOMAIN} / ${SEED_PASSWORD} / coach part_time / ${branch.name}`)
  })
  console.log('Scenarios: all branches, head/full/half/part coaches, kids beginner/intermediate/advanced, adult group, private, 7-day slots, group assignment by Level, check-in evidence, attendance, levels, achievements, notifications, complaints, and weekly summaries.')
  console.log('Cleanup: npm run seed:cleanup')
}

main().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exit(1)
})
