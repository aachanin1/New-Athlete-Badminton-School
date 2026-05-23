const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const KEEP_SUPER_ADMIN_EMAIL = process.env.KEEP_SUPER_ADMIN_EMAIL || 'admin@admin.com'
const UUID_MIN = '00000000-0000-0000-0000-000000000000'

const MASTER_TABLES = [
  'branches',
  'course_types',
  'levels',
  'pricing_tiers',
  'schedule_templates',
  'system_settings',
]

const DELETE_ALL_TABLES = [
  'coach_assignment_group_students',
  'activity_logs',
  'notifications',
  'complaints',
  'finance_expenses',
  'student_achievements',
  'student_levels',
  'coach_weekly_teaching_summaries',
  'coach_teaching_hours',
  'coach_payouts',
  'teaching_programs',
  'coach_program_templates',
  'attendance',
  'coach_checkins',
  'coach_assignment_groups',
  'coach_assignments',
  'lesson_wallet_credits',
  'coupon_usages',
  'payments',
  'booking_sessions',
  'bookings',
  'schedule_slots',
  'children',
  'coach_branches',
  'coupons',
]

const STORAGE_BUCKETS = ['payment-slips', 'coach-checkins', 'avatars']

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const env = fs.readFileSync(filePath, 'utf8')
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

function getConfig() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return { supabaseUrl, serviceRoleKey }
}

async function listAllAuthUsers(supabase) {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth users: ${error.message}`)
    const pageUsers = data?.users || []
    users.push(...pageUsers)
    if (pageUsers.length < perPage) break
    page += 1
  }

  return users
}

async function fetchAllRows(supabase, table, columns = '*') {
  const rows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function countRows(supabase, table, applyFilter) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (applyFilter) query = applyFilter(query)
  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function deleteAllRows(supabase, table) {
  const before = await countRows(supabase, table)
  if (before === 0) return 0

  const { error } = await supabase.from(table).delete().gte('id', UUID_MIN)
  if (error) throw new Error(`delete ${table}: ${error.message}`)
  return before
}

async function listStorageObjects(supabase, bucket, prefix = '') {
  const objects = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)

  for (const item of data || []) {
    const objectPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      objects.push(...await listStorageObjects(supabase, bucket, objectPath))
    } else {
      objects.push(objectPath)
    }
  }

  return objects
}

function isKeptAvatarPath(objectPath, keepUserId) {
  const lower = objectPath.toLowerCase()
  return lower.includes(keepUserId.toLowerCase()) || lower.includes('logo')
}

async function removeStorageObjects(supabase, bucket, objectPaths) {
  if (!objectPaths.length) return 0

  let removed = 0
  for (let index = 0; index < objectPaths.length; index += 100) {
    const chunk = objectPaths.slice(index, index + 100)
    const { error } = await supabase.storage.from(bucket).remove(chunk)
    if (error) throw new Error(`storage ${bucket}: ${error.message}`)
    removed += chunk.length
  }
  return removed
}

async function verifyMasterCountsUnchanged(supabase, before) {
  const after = {}
  for (const table of MASTER_TABLES) {
    after[table] = await countRows(supabase, table)
    if (after[table] !== before[table]) {
      throw new Error(`Master table changed unexpectedly: ${table} before ${before[table]}, after ${after[table]}`)
    }
  }
  return after
}

async function main() {
  const shouldExecute = process.argv.includes('--execute')
  const confirm = process.env.CONFIRM_PRODUCTION_RESET === 'YES'

  if (!shouldExecute || !confirm) {
    console.error('Refusing to reset production data.')
    console.error('Required: CONFIRM_PRODUCTION_RESET=YES and --execute')
    process.exit(1)
  }

  const { supabaseUrl, serviceRoleKey } = getConfig()
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const authUsers = await listAllAuthUsers(supabase)
  const keepAuthUser = authUsers.find((user) => user.email?.toLowerCase() === KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  if (!keepAuthUser) throw new Error(`Keep Super Admin auth user not found: ${KEEP_SUPER_ADMIN_EMAIL}`)

  const profiles = await fetchAllRows(supabase, 'profiles', 'id,email,role,full_name')
  const keepProfile = profiles.find((profile) => profile.email?.toLowerCase() === KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  if (!keepProfile || keepProfile.role !== 'super_admin') {
    throw new Error(`Keep Super Admin profile not found or not super_admin: ${KEEP_SUPER_ADMIN_EMAIL}`)
  }

  const deleteProfiles = profiles.filter((profile) => profile.email?.toLowerCase() !== KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  const deleteProfileIds = deleteProfiles.map((profile) => profile.id)
  const deleteAuthUsers = authUsers.filter((user) => user.email?.toLowerCase() !== KEEP_SUPER_ADMIN_EMAIL.toLowerCase())

  if (deleteProfileIds.includes(keepProfile.id) || deleteAuthUsers.some((user) => user.id === keepAuthUser.id)) {
    throw new Error('Guard failed: keep Super Admin was included in delete list')
  }

  const masterCountsBefore = {}
  for (const table of MASTER_TABLES) {
    masterCountsBefore[table] = await countRows(supabase, table)
  }

  console.log(`Keeping Super Admin: ${KEEP_SUPER_ADMIN_EMAIL} (${keepProfile.id})`)
  console.log(`Profiles to delete: ${deleteProfiles.length}`)
  console.log(`Auth users to delete: ${deleteAuthUsers.length}`)

  const storageRemoved = {}
  for (const bucket of STORAGE_BUCKETS) {
    const objects = await listStorageObjects(supabase, bucket)
    const objectsToRemove = bucket === 'avatars'
      ? objects.filter((objectPath) => !isKeptAvatarPath(objectPath, keepProfile.id))
      : objects
    storageRemoved[bucket] = await removeStorageObjects(supabase, bucket, objectsToRemove)
  }

  if (deleteProfileIds.length) {
    const { error } = await supabase
      .from('system_settings')
      .update({ updated_by: keepProfile.id, updated_at: new Date().toISOString() })
      .in('updated_by', deleteProfileIds)
    if (error) throw new Error(`system_settings updated_by reassignment: ${error.message}`)
  }

  const deletedTables = {}
  for (const table of DELETE_ALL_TABLES) {
    deletedTables[table] = await deleteAllRows(supabase, table)
  }

  if (deleteProfileIds.length) {
    const { error } = await supabase.from('profiles').delete().in('id', deleteProfileIds)
    if (error) throw new Error(`delete profiles: ${error.message}`)
  }

  for (const user of deleteAuthUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`delete auth user ${user.email || user.id}: ${error.message}`)
  }

  const profileCount = await countRows(supabase, 'profiles')
  const keepProfileCount = await countRows(supabase, 'profiles', (query) => query.eq('email', KEEP_SUPER_ADMIN_EMAIL))
  const authUsersAfter = await listAllAuthUsers(supabase)
  const operationalCountsAfter = {}
  for (const table of DELETE_ALL_TABLES) {
    operationalCountsAfter[table] = await countRows(supabase, table)
  }
  const masterCountsAfter = await verifyMasterCountsUnchanged(supabase, masterCountsBefore)

  const nonZeroOperational = Object.entries(operationalCountsAfter).filter(([, count]) => count !== 0)
  if (profileCount !== 1 || keepProfileCount !== 1) {
    throw new Error(`Unexpected profile count after reset: total ${profileCount}, kept ${keepProfileCount}`)
  }
  if (authUsersAfter.length !== 1 || authUsersAfter[0]?.email?.toLowerCase() !== KEEP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Unexpected auth users after reset: ${authUsersAfter.map((user) => user.email).join(', ')}`)
  }
  if (nonZeroOperational.length) {
    throw new Error(`Operational tables not empty: ${nonZeroOperational.map(([table, count]) => `${table}=${count}`).join(', ')}`)
  }

  console.log('Production operational data reset completed.')
  console.log('Deleted table rows:')
  for (const [table, count] of Object.entries(deletedTables)) {
    console.log(`- ${table}: ${count}`)
  }
  console.log('Deleted profiles/auth users:')
  console.log(`- profiles: ${deleteProfiles.length}`)
  console.log(`- auth users: ${deleteAuthUsers.length}`)
  console.log('Deleted storage objects:')
  for (const [bucket, count] of Object.entries(storageRemoved)) {
    console.log(`- ${bucket}: ${count}`)
  }
  console.log('Master/config counts kept:')
  for (const [table, count] of Object.entries(masterCountsAfter)) {
    console.log(`- ${table}: ${count}`)
  }
  console.log('Verification passed: only admin@admin.com remains and operational tables are empty.')
}

main().catch((error) => {
  console.error(`Production reset failed: ${error.message}`)
  process.exit(1)
})
