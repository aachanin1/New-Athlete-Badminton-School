const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const COACH_TEACHING_RULES_SETTING_KEY = 'coach_teaching_rules_settings'

const DEFAULT_COACH_TEACHING_RULES = {
  full_time: {
    employmentType: 'full_time',
    label: 'Full-Time',
    shortLabel: 'FT',
    thresholdHours: 25,
    privateRate: 400,
    groupRate: 200,
    paysAllHours: false,
  },
  half_time: {
    employmentType: 'half_time',
    label: 'Half-Time',
    shortLabel: 'HT',
    thresholdHours: 12.5,
    privateRate: 400,
    groupRate: 200,
    paysAllHours: false,
  },
  part_time: {
    employmentType: 'part_time',
    label: 'Part-Time',
    shortLabel: 'PT',
    thresholdHours: 0,
    privateRate: 400,
    groupRate: 250,
    paysAllHours: true,
  },
}

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

async function main() {
  const { data: existing, error: fetchError } = await supabase
    .from('system_settings')
    .select('key')
    .eq('key', COACH_TEACHING_RULES_SETTING_KEY)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (existing) {
    console.log(`${COACH_TEACHING_RULES_SETTING_KEY} already exists; skipped.`)
    return
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: COACH_TEACHING_RULES_SETTING_KEY,
      value: {
        rules: DEFAULT_COACH_TEACHING_RULES,
        updatedAt: new Date().toISOString(),
      },
      updated_by: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) throw error

  console.log(`Saved ${COACH_TEACHING_RULES_SETTING_KEY}.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
