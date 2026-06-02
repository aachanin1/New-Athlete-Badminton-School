const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const PAGE_SIZE = 1000
const CHUNK_SIZE = 50
const MAX_RETRIES = 3

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env

      const index = trimmed.indexOf('=')
      if (index === -1) return env

      const key = trimmed.slice(0, index).trim()
      let value = trimmed.slice(index + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

async function fetchPaged(supabase, table, columns, applyFilter) {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(table).select(columns)
    if (applyFilter) query = applyFilter(query)

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)

    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

async function withRetry(label, action) {
  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (attempt === MAX_RETRIES) break
      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }

  const cause = lastError?.cause?.message ? ` (${lastError.cause.message})` : ''
  throw new Error(`${label}: ${lastError?.message || String(lastError)}${cause}`)
}

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function expectedBookingStatusFromAttendanceStatus(status) {
  return status === 'absent' ? 'absent' : 'completed'
}

function buildLatestAttendanceBySessionId(rows) {
  const map = new Map()

  rows.forEach((row) => {
    const existing = map.get(row.booking_session_id)
    if (!existing) {
      map.set(row.booking_session_id, row)
      return
    }

    const existingTime = existing.checked_at ? new Date(existing.checked_at).getTime() : -1
    const rowTime = row.checked_at ? new Date(row.checked_at).getTime() : -1
    if (rowTime >= existingTime) map.set(row.booking_session_id, row)
  })

  return map
}

function learnerLabel(session) {
  return session.children?.nickname || session.children?.full_name || session.bookings?.user_id || 'unknown learner'
}

async function main() {
  const config = getConfig()

  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const sessions = await fetchPaged(
    supabase,
    'booking_sessions',
    `
      id, booking_id, date, start_time, end_time, status, child_id, schedule_slot_id,
      children(full_name, nickname),
      bookings!inner(status, user_id)
    `,
    (query) => query
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled')
      .neq('status', 'walleted')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
  )

  const sessionIds = sessions.map((session) => session.id)
  const attendanceRows = []

  for (const ids of chunk(sessionIds, CHUNK_SIZE)) {
    const { data, error } = await withRetry(`attendance chunk ${ids[0]}..${ids[ids.length - 1]}`, () => supabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at, coach_id')
      .in('booking_session_id', ids)
      .order('checked_at', { ascending: true }))

    if (error) throw new Error(`attendance: ${error.message}`)
    attendanceRows.push(...(data || []))
  }

  const latestAttendanceBySessionId = buildLatestAttendanceBySessionId(attendanceRows)
  const statusMismatches = []
  const statusWithoutAttendance = []

  sessions.forEach((session) => {
    const latestAttendance = latestAttendanceBySessionId.get(session.id)

    if (latestAttendance) {
      const expectedStatus = expectedBookingStatusFromAttendanceStatus(latestAttendance.status)
      if (session.status !== expectedStatus) {
        statusMismatches.push({
          session,
          latestAttendance,
          expectedStatus,
        })
      }
      return
    }

    if (session.status === 'completed' || session.status === 'absent') {
      statusWithoutAttendance.push(session)
    }
  })

  console.log('[DRY RUN] Attendance reconciliation report')
  console.log('No production data was modified.')
  console.log(`Verified teaching sessions checked: ${sessions.length}`)
  console.log(`Attendance rows checked: ${attendanceRows.length}`)
  console.log(`Status mismatches: ${statusMismatches.length}`)
  console.log(`Booking status without attendance: ${statusWithoutAttendance.length}`)

  if (statusMismatches.length > 0) {
    console.log('\nTop status mismatches:')
    statusMismatches.slice(0, 25).forEach(({ session, latestAttendance, expectedStatus }) => {
      console.log([
        `- session=${session.id}`,
        `date=${session.date}`,
        `time=${String(session.start_time).slice(0, 5)}-${String(session.end_time).slice(0, 5)}`,
        `learner=${learnerLabel(session)}`,
        `booking_status=${session.status}`,
        `attendance=${latestAttendance.status}`,
        `expected_booking_status=${expectedStatus}`,
        `checked_at=${latestAttendance.checked_at || '-'}`,
      ].join(' | '))
    })
  }

  if (statusWithoutAttendance.length > 0) {
    console.log('\nTop booking statuses without attendance rows:')
    statusWithoutAttendance.slice(0, 25).forEach((session) => {
      console.log([
        `- session=${session.id}`,
        `date=${session.date}`,
        `time=${String(session.start_time).slice(0, 5)}-${String(session.end_time).slice(0, 5)}`,
        `learner=${learnerLabel(session)}`,
        `booking_status=${session.status}`,
      ].join(' | '))
    })
  }

  console.log('\nThis command is report-only. Confirm before running any production reconciliation write.')
}

main().catch((error) => {
  console.error(`[DRY RUN] Failed: ${error.message}`)
  process.exitCode = 1
})
