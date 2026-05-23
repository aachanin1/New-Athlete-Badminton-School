const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const KEEP_SUPER_ADMIN_EMAIL = process.env.KEEP_SUPER_ADMIN_EMAIL || 'admin@admin.com'
const BACKUP_ROOT = process.env.PRODUCTION_RESET_BACKUP_ROOT || path.join(process.cwd(), 'backups', 'production-reset')

const MASTER_TABLES = [
  'branches',
  'course_types',
  'levels',
  'pricing_tiers',
  'schedule_templates',
  'system_settings',
]

const OPERATIONAL_TABLES = [
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
  'coach_assignment_group_students',
  'coach_assignment_groups',
  'coach_assignments',
  'coach_checkins',
  'attendance',
  'lesson_wallet_credits',
  'coupon_usages',
  'coupons',
  'payments',
  'booking_sessions',
  'bookings',
  'schedule_slots',
  'children',
  'coach_branches',
  'profiles',
]

const STORAGE_BUCKETS = ['avatars', 'coach-checkins', 'payment-slips']

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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function timestampForFolder() {
  const now = new Date()
  const bangkok = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const pad = (input) => String(input).padStart(2, '0')
  return [
    bangkok.getFullYear(),
    pad(bangkok.getMonth() + 1),
    pad(bangkok.getDate()),
    '-',
    pad(bangkok.getHours()),
    pad(bangkok.getMinutes()),
    pad(bangkok.getSeconds()),
  ].join('')
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

async function fetchAllRows(supabase, table) {
  const rows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return rows
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
      objects.push({
        bucket,
        path: objectPath,
        id: item.id,
        name: item.name,
        updated_at: item.updated_at,
        created_at: item.created_at,
        last_accessed_at: item.last_accessed_at,
        metadata: item.metadata || null,
      })
    }
  }

  return objects
}

async function downloadStorageObject(supabase, bucket, objectPath, outputRoot) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath)
  if (error) throw new Error(`${bucket}/${objectPath}: ${error.message}`)

  const arrayBuffer = await data.arrayBuffer()
  const targetPath = path.join(outputRoot, bucket, ...objectPath.split('/').map(safeFilePart))
  ensureDir(path.dirname(targetPath))
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer))
  return path.relative(outputRoot, targetPath).replace(/\\/g, '/')
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = getConfig()
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const backupDir = path.join(BACKUP_ROOT, timestampForFolder())
  const tablesDir = path.join(backupDir, 'tables')
  const masterDir = path.join(backupDir, 'master-kept')
  const storageDir = path.join(backupDir, 'storage')

  ensureDir(backupDir)

  const authUsers = await listAllAuthUsers(supabase)
  const keepAuthUser = authUsers.find((user) => user.email?.toLowerCase() === KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  if (!keepAuthUser) {
    throw new Error(`Keep Super Admin auth user not found: ${KEEP_SUPER_ADMIN_EMAIL}`)
  }

  const profiles = await fetchAllRows(supabase, 'profiles')
  const keepProfile = profiles.find((profile) => profile.email?.toLowerCase() === KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  if (!keepProfile || keepProfile.role !== 'super_admin') {
    throw new Error(`Keep Super Admin profile not found or not super_admin: ${KEEP_SUPER_ADMIN_EMAIL}`)
  }

  const deleteProfiles = profiles.filter((profile) => profile.email?.toLowerCase() !== KEEP_SUPER_ADMIN_EMAIL.toLowerCase())
  const deleteUserIds = new Set(deleteProfiles.map((profile) => profile.id))
  const deleteAuthUsers = authUsers.filter((user) => user.email?.toLowerCase() !== KEEP_SUPER_ADMIN_EMAIL.toLowerCase())

  const manifest = {
    createdAt: new Date().toISOString(),
    backupDir,
    keepSuperAdminEmail: KEEP_SUPER_ADMIN_EMAIL,
    keepSuperAdminId: keepProfile.id,
    note: 'Application-level restore point before production reset. Auth password hashes cannot be exported by Supabase Admin API; use Supabase backups/PITR for full auth rollback.',
    tables: {},
    masterTables: {},
    authUsersToDelete: deleteAuthUsers.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    })),
    storage: {},
  }

  for (const table of OPERATIONAL_TABLES) {
    const rows = await fetchAllRows(supabase, table)
    writeJson(path.join(tablesDir, `${table}.json`), rows)
    manifest.tables[table] = {
      rows: rows.length,
      file: `tables/${table}.json`,
    }
  }

  for (const table of MASTER_TABLES) {
    const rows = await fetchAllRows(supabase, table)
    writeJson(path.join(masterDir, `${table}.json`), rows)
    manifest.masterTables[table] = {
      rows: rows.length,
      file: `master-kept/${table}.json`,
    }
  }

  writeJson(path.join(backupDir, 'auth-users-to-delete.json'), manifest.authUsersToDelete)

  for (const bucket of STORAGE_BUCKETS) {
    try {
      const objects = await listStorageObjects(supabase, bucket)
      const downloaded = []
      for (const object of objects) {
        const file = await downloadStorageObject(supabase, bucket, object.path, storageDir)
        downloaded.push({ ...object, file: `storage/${file}` })
      }
      manifest.storage[bucket] = {
        objects: downloaded.length,
        files: downloaded,
      }
    } catch (error) {
      manifest.storage[bucket] = {
        objects: 0,
        error: error.message,
      }
    }
  }

  writeJson(path.join(backupDir, 'manifest.json'), manifest)

  console.log('Production reset restore point created.')
  console.log(`Backup directory: ${backupDir}`)
  console.log(`Keep Super Admin: ${KEEP_SUPER_ADMIN_EMAIL} (${keepProfile.id})`)
  console.log(`Profiles that would be removed: ${deleteProfiles.length}`)
  console.log(`Auth users that would be removed: ${deleteAuthUsers.length}`)
  console.log('Operational table snapshots:')
  for (const [table, detail] of Object.entries(manifest.tables)) {
    console.log(`- ${table}: ${detail.rows}`)
  }
  console.log('Storage snapshots:')
  for (const [bucket, detail] of Object.entries(manifest.storage)) {
    console.log(`- ${bucket}: ${detail.objects}${detail.error ? ` (${detail.error})` : ''}`)
  }
  console.log('No data was deleted.')
}

main().catch((error) => {
  console.error(`Restore point failed: ${error.message}`)
  process.exit(1)
})
