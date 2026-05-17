const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const SEED_PREFIX = 'seed.nasc+'
const SEED_DAYS = Number(process.env.SEED_DAYS || 7)

function loadEnv() {
  if (!fs.existsSync('.env.local')) return {}
  return fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).reduce((env, line) => {
    const value = line.trim()
    if (!value || value.startsWith('#')) return env
    const index = value.indexOf('=')
    if (index === -1) return env
    const key = value.slice(0, index)
    let raw = value.slice(index + 1)
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      raw = raw.slice(1, -1)
    }
    env[key] = raw
    return env
  }, {})
}

const env = { ...loadEnv(), ...process.env }
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function selectRows(table, columns, applyFilter) {
  let query = supabase.from(table).select(columns)
  if (applyFilter) query = applyFilter(query)
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data || []
}

async function selectCount(table, applyFilter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (applyFilter) query = applyFilter(query)
  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

function assertAtLeast(results, key, expected) {
  if (results[key] < expected) {
    throw new Error(`Seed verification failed: ${key} expected at least ${expected}, got ${results[key]}`)
  }
}

async function main() {
  const branches = await selectRows('branches', 'id, name, is_active', (query) => query.eq('is_active', true))
  const branchCount = branches.length
  if (!branchCount) throw new Error('No active branches found')

  const profiles = await selectRows('profiles', 'id, email, role', (query) => query.like('email', `${SEED_PREFIX}%`))
  const seedUserIds = profiles.map((profile) => profile.id)

  const bookings = seedUserIds.length
    ? await selectRows('bookings', 'id, user_id', (query) => query.in('user_id', seedUserIds))
    : []
  const bookingIds = bookings.map((booking) => booking.id)

  const sessions = bookingIds.length
    ? await selectRows('booking_sessions', 'id, schedule_slot_id, date', (query) => query.in('booking_id', bookingIds))
    : []
  const sessionIds = sessions.map((session) => session.id)
  const slotIds = Array.from(new Set(sessions.map((session) => session.schedule_slot_id).filter(Boolean)))

  const groups = seedUserIds.length
    ? await selectRows('coach_assignment_groups', 'id, schedule_slot_id, coach_id, created_by', (query) => query.in('created_by', seedUserIds))
    : []
  const groupIds = groups.map((group) => group.id)

  const duplicateCoachSlots = new Map()
  groups.forEach((group) => {
    if (!group.schedule_slot_id || !group.coach_id) return
    const key = `${group.schedule_slot_id}:${group.coach_id}`
    duplicateCoachSlots.set(key, (duplicateCoachSlots.get(key) || 0) + 1)
  })
  const duplicateCoachGroupCount = Array.from(duplicateCoachSlots.values()).filter((count) => count > 1).length
  if (duplicateCoachGroupCount > 0) {
    throw new Error(`Seed verification failed: ${duplicateCoachGroupCount} slot(s) assign the same coach to multiple groups at the same time`)
  }

  const results = {
    active_branches: branchCount,
    profiles: profiles.length,
    head_coaches: profiles.filter((profile) => profile.role === 'head_coach').length,
    coaches: profiles.filter((profile) => profile.role === 'coach').length,
    users: profiles.filter((profile) => profile.role === 'user').length,
    coach_branches: seedUserIds.length ? await selectCount('coach_branches', (query) => query.in('coach_id', seedUserIds)) : 0,
    children: seedUserIds.length ? await selectCount('children', (query) => query.in('parent_id', seedUserIds)) : 0,
    bookings: bookingIds.length,
    booking_sessions: sessions.length,
    unique_schedule_slots: slotIds.length,
    payments: bookingIds.length ? await selectCount('payments', (query) => query.in('booking_id', bookingIds)) : 0,
    coupons: seedUserIds.length ? await selectCount('coupons', (query) => query.in('created_by', seedUserIds)) : 0,
    coupon_usages: bookingIds.length ? await selectCount('coupon_usages', (query) => query.in('booking_id', bookingIds)) : 0,
    coach_assignments: seedUserIds.length ? await selectCount('coach_assignments', (query) => query.in('coach_id', seedUserIds)) : 0,
    assignment_groups: groupIds.length,
    duplicate_coach_group_slots: duplicateCoachGroupCount,
    assignment_group_students: groupIds.length ? await selectCount('coach_assignment_group_students', (query) => query.in('group_id', groupIds)) : 0,
    coach_checkins: seedUserIds.length ? await selectCount('coach_checkins', (query) => query.in('coach_id', seedUserIds)) : 0,
    attendance: sessionIds.length ? await selectCount('attendance', (query) => query.in('booking_session_id', sessionIds)) : 0,
    teaching_programs: seedUserIds.length ? await selectCount('teaching_programs', (query) => query.in('coach_id', seedUserIds)) : 0,
    coach_program_templates: seedUserIds.length ? await selectCount('coach_program_templates', (query) => query.in('coach_id', seedUserIds)) : 0,
    student_levels: seedUserIds.length ? await selectCount('student_levels', (query) => query.in('updated_by', seedUserIds)) : 0,
    student_achievements: seedUserIds.length ? await selectCount('student_achievements', (query) => query.in('created_by', seedUserIds)) : 0,
    notifications: seedUserIds.length ? await selectCount('notifications', (query) => query.in('user_id', seedUserIds)) : 0,
    complaints: seedUserIds.length ? await selectCount('complaints', (query) => query.in('user_id', seedUserIds)) : 0,
    weekly_summaries: seedUserIds.length ? await selectCount('coach_weekly_teaching_summaries', (query) => query.in('coach_id', seedUserIds)) : 0,
  }

  const expected = {
    profiles: 2 + branchCount * 7,
    head_coaches: branchCount,
    coaches: branchCount * 3,
    users: branchCount * 3,
    coach_branches: branchCount * 4,
    children: branchCount * 3,
    bookings: branchCount * 5,
    booking_sessions: branchCount * 5 * SEED_DAYS,
    unique_schedule_slots: branchCount * 3 * SEED_DAYS,
    payments: branchCount * 5,
    coupons: 2,
    coach_assignments: branchCount * 4 * SEED_DAYS,
    assignment_groups: branchCount * 4 * SEED_DAYS,
    assignment_group_students: branchCount * 5 * SEED_DAYS,
    coach_checkins: branchCount * 4,
    attendance: branchCount * 5,
    teaching_programs: branchCount * 4,
    coach_program_templates: branchCount * 4,
    student_levels: branchCount * 5,
    student_achievements: branchCount * 3,
    notifications: branchCount * 4 + 1,
    complaints: branchCount,
    weekly_summaries: branchCount * 2,
  }

  Object.entries(expected).forEach(([key, value]) => assertAtLeast(results, key, value))

  console.log(JSON.stringify({ results, expected, seed_days: SEED_DAYS }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
