import { CoachCheckinsClient } from '@/components/admin/coach-checkins-client'
import {
  createCoachCheckinSignedUrlMap,
  getResolvedCoachCheckinPhotoUrl,
} from '@/lib/coach-checkin-photos'
import { createClient } from '@/lib/supabase/server'

interface SlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
  schedule_slots?: SlotRow | null
}

interface AssignmentGroupRow {
  id: string
  coach_id: string | null
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
  schedule_slots?: SlotRow | null
  coach_assignment_group_students?: { booking_session_id: string | null }[] | null
}

interface BookingSessionStatusRow {
  id: string
  schedule_slot_id: string | null
}

interface CheckinRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  branch_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  created_at: string
}

interface BranchRow {
  id: string
  name: string
}

interface DbQueryError {
  message: string
}

interface CheckinAuditRow {
  assignment_id: string
  coach_id: string
  coach_name: string
  schedule_slot_id: string
  branch_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
}

const ACTIVE_SESSION_STATUSES = ['scheduled', 'completed', 'absent'] as const
const ACTIVE_BOOKING_STATUSES = ['verified'] as const
const ACTIVE_SESSION_QUERY_CHUNK_SIZE = 80

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return { start: toInput(start), end: toInput(end) }
}

function getAssignmentKey(coachId: string, scheduleSlotId: string) {
  return `${coachId}:${scheduleSlotId}`
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function formatLoadError(scope: string, error: DbQueryError | null | undefined) {
  return error ? `${scope}: ${error.message}` : null
}

async function fetchActiveSessionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  column: 'id' | 'schedule_slot_id',
  values: string[]
) {
  const rows: BookingSessionStatusRow[] = []
  const errors: string[] = []

  for (const valueChunk of chunkArray(values, ACTIVE_SESSION_QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase
      .from('booking_sessions')
      .select('id, schedule_slot_id, bookings!inner(status)')
      .in(column, valueChunk)
      .in('status', ACTIVE_SESSION_STATUSES)
      .in('bookings.status', ACTIVE_BOOKING_STATUSES)
      .limit(5000) as unknown as PromiseLike<{ data: BookingSessionStatusRow[] | null; error: DbQueryError | null }>)

    if (error) {
      errors.push(`booking_sessions.${column}: ${error.message}`)
      continue
    }

    rows.push(...(data || []))
  }

  return { rows, errors }
}

function createAuditRow(params: {
  assignmentId: string
  coachId: string
  coachName: string | null | undefined
  slot: SlotRow
  checkin: CheckinRow | null
  signedPhotoUrlMap: Map<string, string>
}): CheckinAuditRow {
  return {
    assignment_id: params.assignmentId,
    coach_id: params.coachId,
    coach_name: params.coachName || 'Unknown',
    schedule_slot_id: params.slot.id,
    branch_id: params.slot.branch_id,
    branch_name: params.slot.branches?.name || 'Unknown',
    course_type: params.slot.course_types?.name || '',
    date: params.slot.date,
    start_time: params.slot.start_time,
    end_time: params.slot.end_time,
    checkin_id: params.checkin?.id || null,
    checkin_time: params.checkin?.checkin_time || null,
    photo_url: getResolvedCoachCheckinPhotoUrl(params.checkin?.photo_url, params.signedPhotoUrlMap),
    location_lat: params.checkin?.location_lat || null,
    location_lng: params.checkin?.location_lng || null,
  }
}

export default async function CoachCheckinsPage() {
  const supabase = await createClient()
  const range = getMonthRange()

  const [
    { data: groupAssignments, error: groupAssignmentsError },
    { data: legacyAssignments, error: legacyAssignmentsError },
    { data: checkins, error: checkinsError },
    { data: branches, error: branchesError },
  ] = await Promise.all([
    (supabase
      .from('coach_assignment_groups')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignment_groups_coach_id_fkey(full_name),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        ),
        coach_assignment_group_students(booking_session_id)
      `)
      .gte('schedule_slots.date', range.start)
      .lt('schedule_slots.date', range.end)
      .limit(1200) as unknown as PromiseLike<{ data: AssignmentGroupRow[] | null; error: DbQueryError | null }>),
    (supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignments_coach_id_fkey(full_name),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        )
      `)
      .gte('schedule_slots.date', range.start)
      .lt('schedule_slots.date', range.end)
      .limit(1200) as unknown as PromiseLike<{ data: AssignmentRow[] | null; error: DbQueryError | null }>),
    (supabase
      .from('coach_checkins')
      .select('id, coach_id, schedule_slot_id, branch_id, checkin_time, photo_url, location_lat, location_lng, created_at')
      .gte('checkin_time', `${range.start}T00:00:00`)
      .lt('checkin_time', `${range.end}T00:00:00`)
      .order('checkin_time', { ascending: false })
      .limit(1200) as unknown as PromiseLike<{ data: CheckinRow[] | null; error: DbQueryError | null }>),
    (supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: BranchRow[] | null; error: DbQueryError | null }>),
  ])

  const loadErrors = [
    formatLoadError('coach_assignment_groups', groupAssignmentsError),
    formatLoadError('coach_assignments', legacyAssignmentsError),
    formatLoadError('coach_checkins', checkinsError),
    formatLoadError('branches', branchesError),
  ].filter((message): message is string => Boolean(message))

  const groupSessionIds = Array.from(new Set(
    (groupAssignments || []).flatMap((assignment) => (
      assignment.coach_assignment_group_students || []
    ).map((student) => student.booking_session_id).filter(Boolean))
  )) as string[]
  const legacySlotIds = Array.from(new Set((legacyAssignments || []).map((assignment) => assignment.schedule_slot_id)))

  const [activeGroupedResult, activeLegacyResult] = await Promise.all([
    groupSessionIds.length > 0
      ? fetchActiveSessionRows(supabase, 'id', groupSessionIds)
      : Promise.resolve({ rows: [] as BookingSessionStatusRow[], errors: [] as string[] }),
    legacySlotIds.length > 0
      ? fetchActiveSessionRows(supabase, 'schedule_slot_id', legacySlotIds)
      : Promise.resolve({ rows: [] as BookingSessionStatusRow[], errors: [] as string[] }),
  ])
  loadErrors.push(...activeGroupedResult.errors, ...activeLegacyResult.errors)

  const activeGroupedSessionIds = new Set(activeGroupedResult.rows.map((session) => session.id))
  const activeLegacySlotIds = new Set(activeLegacyResult.rows
    .map((session) => session.schedule_slot_id)
    .filter(Boolean))

  const checkinMap = new Map<string, CheckinRow>()
  ;(checkins || []).forEach((checkin) => {
    const key = getAssignmentKey(checkin.coach_id, checkin.schedule_slot_id)
    if (!checkinMap.has(key)) checkinMap.set(key, checkin)
  })
  const signedPhotoUrlMap = await createCoachCheckinSignedUrlMap((checkins || []).map((checkin) => checkin.photo_url))

  const emittedKeys = new Set<string>()
  const groupedSlotIds = new Set((groupAssignments || []).map((assignment) => assignment.schedule_slot_id))

  const groupedRows = (groupAssignments || [])
    .filter((assignment) => {
      if (!assignment.coach_id || !assignment.schedule_slots) return false
      const hasActiveStudent = (assignment.coach_assignment_group_students || [])
        .some((student) => student.booking_session_id && activeGroupedSessionIds.has(student.booking_session_id))
      if (!hasActiveStudent) return false
      const key = getAssignmentKey(assignment.coach_id, assignment.schedule_slot_id)
      if (emittedKeys.has(key)) return false
      emittedKeys.add(key)
      return true
    })
    .map((assignment) => createAuditRow({
      assignmentId: assignment.id,
      coachId: assignment.coach_id || '',
      coachName: assignment.profiles?.full_name,
      slot: assignment.schedule_slots as SlotRow,
      checkin: assignment.coach_id ? checkinMap.get(getAssignmentKey(assignment.coach_id, assignment.schedule_slot_id)) || null : null,
      signedPhotoUrlMap,
    }))

  const legacyRows = (legacyAssignments || [])
    .filter((assignment) => {
      if (!assignment.schedule_slots) return false
      if (groupedSlotIds.has(assignment.schedule_slot_id)) return false
      if (!activeLegacySlotIds.has(assignment.schedule_slot_id)) return false
      const key = getAssignmentKey(assignment.coach_id, assignment.schedule_slot_id)
      if (emittedKeys.has(key)) return false
      emittedKeys.add(key)
      return true
    })
    .map((assignment) => createAuditRow({
      assignmentId: assignment.id,
      coachId: assignment.coach_id,
      coachName: assignment.profiles?.full_name,
      slot: assignment.schedule_slots as SlotRow,
      checkin: checkinMap.get(getAssignmentKey(assignment.coach_id, assignment.schedule_slot_id)) || null,
      signedPhotoUrlMap,
    }))

  const auditRows = [...groupedRows, ...legacyRows]
    .sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`))

  return <CoachCheckinsClient rows={auditRows} branches={branches || []} loadErrors={loadErrors} />
}
