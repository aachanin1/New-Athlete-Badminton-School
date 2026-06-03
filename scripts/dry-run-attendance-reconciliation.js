const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const PAGE_SIZE = 1000
const CHUNK_SIZE = 50
const MAX_RETRIES = 3
const WRITE_MODE = process.argv.includes('--write')

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

function isWritableAttendanceStatus(status) {
  return status === 'present' || status === 'late' || status === 'absent'
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

function getSessionStudentKey(sessionId, studentId) {
  return `${sessionId}:${studentId}`
}

function buildLatestAttendanceBySessionStudentKey(rows) {
  const map = new Map()

  rows.forEach((row) => {
    if (!row.student_id) return

    const key = getSessionStudentKey(row.booking_session_id, row.student_id)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, row)
      return
    }

    const existingTime = existing.checked_at ? new Date(existing.checked_at).getTime() : -1
    const rowTime = row.checked_at ? new Date(row.checked_at).getTime() : -1
    if (rowTime >= existingTime) map.set(key, row)
  })

  return map
}

function getExpectedStudentId(session) {
  return session.child_id || session.bookings?.user_id || null
}

function learnerLabel(session) {
  return session.children?.nickname || session.children?.full_name || session.bookings?.user_id || 'unknown learner'
}

async function writeStatusMismatches(supabase, statusMismatches) {
  const results = []

  for (const { session, latestAttendance, expectedStatus } of statusMismatches) {
    if (!isWritableAttendanceStatus(latestAttendance.status)) {
      throw new Error(`Refusing to write unknown attendance status "${latestAttendance.status}" for session ${session.id}`)
    }

    const { data, error } = await withRetry(`booking_sessions update ${session.id}`, () => supabase
      .from('booking_sessions')
      .update({ status: expectedStatus })
      .eq('id', session.id)
      .eq('status', session.status)
      .select('id, status')
      .maybeSingle())

    if (error) throw new Error(`booking_sessions update ${session.id}: ${error.message}`)

    if (!data) {
      const { data: current, error: currentError } = await supabase
        .from('booking_sessions')
        .select('id, status')
        .eq('id', session.id)
        .maybeSingle()

      if (currentError) throw new Error(`booking_sessions verify ${session.id}: ${currentError.message}`)
      if (current?.status === expectedStatus) {
        results.push({ session, latestAttendance, expectedStatus, skipped: 'already-updated' })
        continue
      }

      throw new Error(`booking_sessions update ${session.id}: row changed before reconciliation`)
    }

    results.push({ session, latestAttendance, expectedStatus, skipped: null })
  }

  return results
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
  const latestAttendanceBySessionStudent = buildLatestAttendanceBySessionStudentKey(attendanceRows)
  const statusMismatches = []
  const studentScopeMismatches = []
  const statusWithoutAttendance = []

  sessions.forEach((session) => {
    const expectedStudentId = getExpectedStudentId(session)
    const exactAttendance = expectedStudentId
      ? latestAttendanceBySessionStudent.get(getSessionStudentKey(session.id, expectedStudentId))
      : null
    const legacyAttendance = latestAttendanceBySessionId.get(session.id)
    const latestAttendance = exactAttendance || (
      legacyAttendance && (!legacyAttendance.student_id || !expectedStudentId) ? legacyAttendance : null
    )

    if (!exactAttendance && legacyAttendance?.student_id && expectedStudentId) {
      studentScopeMismatches.push({
        session,
        expectedStudentId,
        latestAttendance: legacyAttendance,
      })
    }

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

  console.log(WRITE_MODE
    ? '[WRITE] Attendance reconciliation report before write'
    : '[DRY RUN] Attendance reconciliation report')
  console.log(WRITE_MODE
    ? 'Production data has not been modified yet. Safety checks run before writing.'
    : 'No production data was modified.')
  console.log(`Verified teaching sessions checked: ${sessions.length}`)
  console.log(`Attendance rows checked: ${attendanceRows.length}`)
  console.log(`Student-scope attendance mismatches: ${studentScopeMismatches.length}`)
  console.log(`Status mismatches: ${statusMismatches.length}`)
  console.log(`Booking status without attendance: ${statusWithoutAttendance.length}`)

  if (studentScopeMismatches.length > 0) {
    console.log('\nTop student-scope attendance mismatches:')
    studentScopeMismatches.slice(0, 25).forEach(({ session, expectedStudentId, latestAttendance }) => {
      console.log([
        `- session=${session.id}`,
        `date=${session.date}`,
        `time=${String(session.start_time).slice(0, 5)}-${String(session.end_time).slice(0, 5)}`,
        `learner=${learnerLabel(session)}`,
        `expected_student_id=${expectedStudentId || '-'}`,
        `attendance_student_id=${latestAttendance.student_id || '-'}`,
        `attendance=${latestAttendance.status}`,
        `checked_at=${latestAttendance.checked_at || '-'}`,
      ].join(' | '))
    })
  }

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

  if (!WRITE_MODE) {
    console.log('\nThis command is report-only. Confirm before running any production reconciliation write.')
    return
  }

  if (studentScopeMismatches.length > 0) {
    throw new Error('Refusing to write because student-scope attendance mismatches were found.')
  }

  if (statusMismatches.length === 0) {
    console.log('\n[WRITE] No status mismatches to reconcile.')
    return
  }

  console.log(`\n[WRITE] Updating ${statusMismatches.length} booking_sessions.status rows from attendance source of truth...`)
  const writeResults = await writeStatusMismatches(supabase, statusMismatches)

  writeResults.forEach(({ session, latestAttendance, expectedStatus, skipped }) => {
    console.log([
      skipped ? '- skipped' : '- updated',
      `session=${session.id}`,
      `date=${session.date}`,
      `time=${String(session.start_time).slice(0, 5)}-${String(session.end_time).slice(0, 5)}`,
      `learner=${learnerLabel(session)}`,
      `attendance=${latestAttendance.status}`,
      `booking_status=${session.status}->${expectedStatus}`,
      skipped ? `reason=${skipped}` : null,
    ].filter(Boolean).join(' | '))
  })

  console.log(`\n[WRITE] Completed. Rows processed: ${writeResults.length}. Run dry-run again to verify Status mismatches is 0.`)
}

main().catch((error) => {
  console.error(`[DRY RUN] Failed: ${error.message}`)
  process.exitCode = 1
})
