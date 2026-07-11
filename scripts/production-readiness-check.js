const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SEED_PREFIX = 'seed.nasc+'
const SEED_DOMAIN = 'example.com'
const PLACEHOLDER_HOSTS = ['placehold.co', 'api.dicebear.com']
const REQUIRED_BUCKETS = ['payment-slips', 'coach-checkins', 'avatars']
const REQUIRED_SETTING_KEYS = [
  'admin_menu_permissions',
  'payment_transfer_settings',
  'coach_teaching_rules_settings',
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) return env

      const key = trimmed.slice(0, separatorIndex).trim()
      let value = trimmed.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      env[key] = value
      return env
    }, {})
}

function getConfig() {
  const envFile = loadEnvFile(path.join(process.cwd(), '.env.local'))
  const env = { ...envFile, ...process.env }

  return {
    supabaseUrl: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    slipokApiKey: env.SLIPOK_API_KEY,
    slipokApiUrl: env.SLIPOK_API_URL,
    slipokTestMode: String(env.SLIPOK_TEST_MODE || '').toLowerCase() === 'true',
  }
}

function makeReport() {
  return {
    blockers: [],
    warnings: [],
    passes: [],
    details: [],
  }
}

function addCountDetail(report, label, count) {
  report.details.push(`${label}: ${count}`)
}

async function countRows(supabase, table, applyFilter) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (applyFilter) query = applyFilter(query)

  const { count, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function fetchRows(supabase, table, columns, applyFilter) {
  let query = supabase.from(table).select(columns)
  if (applyFilter) query = applyFilter(query)

  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data || []
}

async function safeCheck(report, label, action) {
  try {
    return await action()
  } catch (error) {
    report.blockers.push(`${label}: ${error.message}`)
    return null
  }
}

function chunk(values, size = 100) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

async function countInChunks(supabase, table, column, values) {
  if (!values.length) return 0

  let total = 0
  for (const valueChunk of chunk(values)) {
    total += await countRows(supabase, table, (query) => query.in(column, valueChunk))
  }
  return total
}

async function listSeedAuthUsers(supabase) {
  const seedUsers = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)

    const users = data?.users || []
    seedUsers.push(...users.filter((user) => {
      const email = user.email || ''
      return email.startsWith(SEED_PREFIX) && email.endsWith(`@${SEED_DOMAIN}`)
    }))

    if (users.length < 1000) break
    page += 1
  }

  return seedUsers
}

async function collectSeedData(report, supabase) {
  const seedProfiles = await safeCheck(report, 'seed profiles', () => fetchRows(
    supabase,
    'profiles',
    'id,email,role,full_name,avatar_url',
    (query) => query.ilike('email', `${SEED_PREFIX}%@${SEED_DOMAIN}`),
  )) || []

  const seedUserIds = seedProfiles.map((profile) => profile.id)
  const seedAuthUsers = await safeCheck(report, 'seed auth users', () => listSeedAuthUsers(supabase)) || []

  addCountDetail(report, 'Seed profiles', seedProfiles.length)
  addCountDetail(report, 'Seed auth users', seedAuthUsers.length)

  if (seedProfiles.length || seedAuthUsers.length) {
    report.warnings.push('Seed users still exist. Back up the DB first, then run npm run seed:cleanup only when ready to remove demo data.')
  } else {
    report.passes.push('No seed users found by email prefix.')
  }

  if (!seedUserIds.length) return

  const seedChildren = await safeCheck(report, 'seed children', () => fetchRows(
    supabase,
    'children',
    'id',
    (query) => query.in('parent_id', seedUserIds),
  )) || []
  const seedChildIds = seedChildren.map((child) => child.id)

  const seedBookings = await safeCheck(report, 'seed bookings', () => fetchRows(
    supabase,
    'bookings',
    'id',
    (query) => query.in('user_id', seedUserIds),
  )) || []
  const seedBookingIds = seedBookings.map((booking) => booking.id)

  const seedSessions = seedBookingIds.length
    ? await safeCheck(report, 'seed booking sessions', () => fetchRows(
      supabase,
      'booking_sessions',
      'id,schedule_slot_id',
      (query) => query.in('booking_id', seedBookingIds),
    )) || []
    : []
  const seedSessionIds = seedSessions.map((session) => session.id)
  const seedSlotIds = Array.from(new Set(seedSessions.map((session) => session.schedule_slot_id).filter(Boolean)))

  addCountDetail(report, 'Seed children', seedChildIds.length)
  addCountDetail(report, 'Seed bookings', seedBookingIds.length)
  addCountDetail(report, 'Seed booking sessions', seedSessionIds.length)

  const dependentCounts = {
    payments: seedBookingIds.length ? await countInChunks(supabase, 'payments', 'booking_id', seedBookingIds) : 0,
    coupon_usages: seedBookingIds.length ? await countInChunks(supabase, 'coupon_usages', 'booking_id', seedBookingIds) : 0,
    attendance: seedSessionIds.length ? await countInChunks(supabase, 'attendance', 'booking_session_id', seedSessionIds) : 0,
    coach_checkins: await countInChunks(supabase, 'coach_checkins', 'coach_id', seedUserIds),
    coach_assignments: seedSlotIds.length ? await countInChunks(supabase, 'coach_assignments', 'schedule_slot_id', seedSlotIds) : 0,
    teaching_programs: await countInChunks(supabase, 'teaching_programs', 'coach_id', seedUserIds),
    coach_program_templates: await countInChunks(supabase, 'coach_program_templates', 'coach_id', seedUserIds),
    student_levels: await countInChunks(supabase, 'student_levels', 'updated_by', seedUserIds),
    student_achievements: await countInChunks(supabase, 'student_achievements', 'created_by', seedUserIds),
    notifications: await countInChunks(supabase, 'notifications', 'user_id', seedUserIds),
    complaints: await countInChunks(supabase, 'complaints', 'user_id', seedUserIds),
    finance_expenses: await countInChunks(supabase, 'finance_expenses', 'created_by', seedUserIds),
    coach_weekly_teaching_summaries: await countInChunks(supabase, 'coach_weekly_teaching_summaries', 'coach_id', seedUserIds),
  }

  for (const [table, count] of Object.entries(dependentCounts)) {
    addCountDetail(report, `Seed ${table}`, count)
  }

  const placeholderPaymentCount = await safeCheck(report, 'placeholder payment slips', () => countRows(
    supabase,
    'payments',
    (query) => query.or(PLACEHOLDER_HOSTS.map((host) => `slip_image_url.ilike.%${host}%`).join(',')),
  ))
  const placeholderCheckinCount = await safeCheck(report, 'placeholder coach checkins', () => countRows(
    supabase,
    'coach_checkins',
    (query) => query.or(PLACEHOLDER_HOSTS.map((host) => `photo_url.ilike.%${host}%`).join(',')),
  ))

  if ((placeholderPaymentCount || 0) > 0) {
    report.warnings.push(`Placeholder payment slip URLs found: ${placeholderPaymentCount}. Remove seed data before production.`)
  }
  if ((placeholderCheckinCount || 0) > 0) {
    report.warnings.push(`Placeholder coach check-in photo URLs found: ${placeholderCheckinCount}. Remove seed data before production.`)
  }
}

async function collectMasterData(report, supabase) {
  const activeBranches = await safeCheck(report, 'active branches', () => countRows(
    supabase,
    'branches',
    (query) => query.eq('is_active', true),
  ))
  const courseTypes = await safeCheck(report, 'course types', () => fetchRows(
    supabase,
    'course_types',
    'id,name',
  )) || []
  const activeScheduleTemplates = await safeCheck(report, 'active schedule templates', () => countRows(
    supabase,
    'schedule_templates',
    (query) => query.eq('is_active', true),
  ))
  const activeLevels = await safeCheck(report, 'active levels', () => countRows(
    supabase,
    'levels',
    (query) => query.eq('is_active', true),
  ))
  const pricingTiers = await safeCheck(report, 'pricing tiers', () => countRows(supabase, 'pricing_tiers'))
  const settings = await safeCheck(report, 'system settings', () => fetchRows(
    supabase,
    'system_settings',
    'key',
    (query) => query.in('key', REQUIRED_SETTING_KEYS),
  )) || []

  addCountDetail(report, 'Active branches', activeBranches || 0)
  addCountDetail(report, 'Course types', courseTypes.length)
  addCountDetail(report, 'Active schedule templates', activeScheduleTemplates || 0)
  addCountDetail(report, 'Active levels', activeLevels || 0)
  addCountDetail(report, 'Pricing tiers', pricingTiers || 0)
  addCountDetail(report, 'System settings found', settings.length)

  if (!activeBranches) report.blockers.push('No active branches found.')
  if (courseTypes.length < 3) report.warnings.push('Expected at least 3 course types: kids group, adult group, and private.')
  if (!activeScheduleTemplates) report.blockers.push('No active schedule templates found.')
  if (!activeLevels) report.blockers.push('No active levels found.')
  if (!pricingTiers) report.blockers.push('No pricing tiers found.')

  const settingKeys = new Set(settings.map((setting) => setting.key))
  for (const key of REQUIRED_SETTING_KEYS) {
    if (!settingKeys.has(key)) {
      report.warnings.push(`System setting "${key}" is not saved yet. App defaults may work, but production should save it through Super Admin settings.`)
    }
  }
}

async function collectStorageData(report, supabase) {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    report.blockers.push(`storage buckets: ${error.message}`)
    return
  }

  const buckets = data || []
  const bucketNames = new Set(buckets.map((bucket) => bucket.name))
  for (const bucket of REQUIRED_BUCKETS) {
    if (!bucketNames.has(bucket)) {
      report.blockers.push(`Missing Storage bucket "${bucket}".`)
    }
  }

  const publicPaymentBucket = buckets.find((bucket) => bucket.name === 'payment-slips')
  if (publicPaymentBucket && publicPaymentBucket.public !== true) {
    report.warnings.push('payment-slips bucket is not public. Users may not be able to view their own slip through saved public URLs.')
  }

  const checkinBucket = buckets.find((bucket) => bucket.name === 'coach-checkins')
  if (checkinBucket && checkinBucket.public === true) {
    report.warnings.push('coach-checkins bucket is public. Consider keeping coach selfie evidence private before production.')
  }

  addCountDetail(report, 'Storage buckets', buckets.map((bucket) => bucket.name).join(', ') || 'none')
}

async function collectSlipOkData(report, config) {
  if (config.slipokTestMode || !config.slipokApiKey || !config.slipokApiUrl) return

  const quotaUrl = `${config.slipokApiUrl.replace(/\/$/, '')}/quota`
  try {
    const response = await fetch(quotaUrl, {
      method: 'GET',
      headers: {
        'x-authorization': config.slipokApiKey,
      },
    })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    if (!response.ok) {
      const code = payload?.code ? ` ${payload.code}` : ''
      const message = payload?.message || `HTTP ${response.status}`
      report.blockers.push(`SlipOK quota check failed:${code} ${message}`)
      return
    }

    const data = payload?.data || {}
    addCountDetail(report, 'SlipOK quota remaining', data.quota ?? 'unknown')
    addCountDetail(report, 'SlipOK package end date', data.endDate || 'unknown')
    report.passes.push('SlipOK production credentials can read quota.')
  } catch (error) {
    report.blockers.push(`SlipOK quota check failed: ${error.message}`)
  }
}

function collectEnvData(report, config) {
  if (!config.supabaseUrl) report.blockers.push('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.')
  if (!config.publishableKey) report.blockers.push('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  if (!config.serviceRoleKey) report.blockers.push('Missing SUPABASE_SERVICE_ROLE_KEY.')

  if (config.slipokTestMode) {
    report.passes.push('SLIPOK_TEST_MODE=true matches the current Owner-approved shared Legacy/Progressive Test Mode policy.')
  }

  if (!config.slipokTestMode && (!config.slipokApiKey || !config.slipokApiUrl)) {
    report.warnings.push('SlipOK production credentials are incomplete. Payment verification may fail outside test mode.')
  }

  if (config.supabaseUrl && config.publishableKey && config.serviceRoleKey) {
    report.passes.push('Required Supabase environment variables are present.')
  }
}

function printReport(report) {
  console.log('Production readiness check')
  console.log('==========================')

  if (report.passes.length) {
    console.log('\nPasses')
    for (const item of report.passes) console.log(`- ${item}`)
  }

  if (report.details.length) {
    console.log('\nDetails')
    for (const item of report.details) console.log(`- ${item}`)
  }

  if (report.warnings.length) {
    console.log('\nWarnings')
    for (const item of report.warnings) console.log(`- ${item}`)
  }

  if (report.blockers.length) {
    console.log('\nBlockers')
    for (const item of report.blockers) console.log(`- ${item}`)
  }

  console.log(`\nResult: ${report.blockers.length ? 'NOT READY' : 'READY WITH WARNINGS/PASSES'}`)
}

async function main() {
  const config = getConfig()
  const report = makeReport()

  collectEnvData(report, config)

  if (config.supabaseUrl && config.serviceRoleKey) {
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    await collectSeedData(report, supabase)
    await collectMasterData(report, supabase)
    await collectStorageData(report, supabase)
  }

  await collectSlipOkData(report, config)

  printReport(report)
  process.exit(report.blockers.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
