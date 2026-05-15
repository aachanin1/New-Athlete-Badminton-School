const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

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

async function selectCount(table, applyFilter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (applyFilter) query = applyFilter(query)
  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .like('email', 'seed.nasc+%')

  if (profileError) throw profileError

  const seedUserIds = (profiles || []).map((profile) => profile.id)
  const bookingRows = seedUserIds.length
    ? await supabase.from('bookings').select('id').in('user_id', seedUserIds)
    : { data: [] }
  if (bookingRows.error) throw bookingRows.error

  const bookingIds = (bookingRows.data || []).map((booking) => booking.id)
  const linkedMakeups = bookingIds.length
    ? await supabase
      .from('booking_sessions')
      .select('id', { count: 'exact', head: true })
      .in('booking_id', bookingIds)
      .eq('is_makeup', true)
      .not('rescheduled_from_id', 'is', null)
    : { count: 0, error: null }
  if (linkedMakeups.error) throw linkedMakeups.error

  const results = {
    profiles: profiles?.length || 0,
    children: seedUserIds.length ? await selectCount('children', (query) => query.in('parent_id', seedUserIds)) : 0,
    bookings: bookingIds.length,
    booking_sessions: bookingIds.length ? await selectCount('booking_sessions', (query) => query.in('booking_id', bookingIds)) : 0,
    linked_makeup_sessions: linkedMakeups.count || 0,
    payments: bookingIds.length ? await selectCount('payments', (query) => query.in('booking_id', bookingIds)) : 0,
    coupon_usages: bookingIds.length ? await selectCount('coupon_usages', (query) => query.in('booking_id', bookingIds)) : 0,
    coupons: await selectCount('coupons', (query) => query.like('code', 'NASCSEED%')),
    coach_assignments: seedUserIds.length ? await selectCount('coach_assignments', (query) => query.in('coach_id', seedUserIds)) : 0,
    coach_checkins: seedUserIds.length ? await selectCount('coach_checkins', (query) => query.in('coach_id', seedUserIds)) : 0,
    attendance: seedUserIds.length ? await selectCount('attendance', (query) => query.in('coach_id', seedUserIds)) : 0,
    student_levels: seedUserIds.length ? await selectCount('student_levels', (query) => query.in('updated_by', seedUserIds)) : 0,
    student_achievements: seedUserIds.length ? await selectCount('student_achievements', (query) => query.in('created_by', seedUserIds)) : 0,
    notifications: seedUserIds.length ? await selectCount('notifications', (query) => query.in('user_id', seedUserIds)) : 0,
    complaints: seedUserIds.length ? await selectCount('complaints', (query) => query.in('user_id', seedUserIds)) : 0,
    weekly_summaries: seedUserIds.length ? await selectCount('coach_weekly_teaching_summaries', (query) => query.in('coach_id', seedUserIds)) : 0,
  }

  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
