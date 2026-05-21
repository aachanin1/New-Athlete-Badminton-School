type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

interface BookingSessionSlotRow {
  id: string
  schedule_slot_id: string | null
}

interface ActivityLogReviewRow {
  entity_id: string | null
  details: Record<string, unknown> | null
}

function getNotifiedCoachIds(details: Record<string, unknown> | null) {
  const ids = details?.notifiedCoachIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

export async function getAdminReturnedAttendanceSlotIds(
  supabaseClient: unknown,
  coachId: string,
  scheduleSlotIds: string[],
) {
  const uniqueSlotIds = Array.from(new Set(scheduleSlotIds.filter(Boolean)))
  if (uniqueSlotIds.length === 0) return new Set<string>()

  const supabase = supabaseClient as SupabaseLike
  const { data: sessions } = await supabase
    .from('booking_sessions')
    .select('id, schedule_slot_id')
    .in('schedule_slot_id', uniqueSlotIds) as { data: BookingSessionSlotRow[] | null }

  const rows = sessions || []
  const sessionIds = rows.map((row) => row.id)
  if (sessionIds.length === 0) return new Set<string>()

  const slotIdBySessionId = new Map(rows.map((row) => [row.id, row.schedule_slot_id]))
  const { data: reviewLogs } = await supabase
    .from('activity_logs')
    .select('entity_id, details')
    .eq('action', 'attendance_gap_request_coach_review')
    .eq('entity_type', 'booking_sessions')
    .in('entity_id', sessionIds)
    .order('created_at', { ascending: false }) as { data: ActivityLogReviewRow[] | null }

  const allowedSlotIds = new Set<string>()
  ;(reviewLogs || []).forEach((log) => {
    if (!log.entity_id) return
    const notifiedCoachIds = getNotifiedCoachIds(log.details)
    if (!notifiedCoachIds.includes(coachId)) return

    const slotId = typeof log.details?.scheduleSlotId === 'string'
      ? log.details.scheduleSlotId
      : slotIdBySessionId.get(log.entity_id)

    if (slotId && uniqueSlotIds.includes(slotId)) allowedSlotIds.add(slotId)
  })

  return allowedSlotIds
}

export async function canCoachRetroCheckinFromAdminReview(
  supabaseClient: unknown,
  coachId: string,
  scheduleSlotId: string,
) {
  const allowedSlotIds = await getAdminReturnedAttendanceSlotIds(supabaseClient, coachId, [scheduleSlotId])
  return allowedSlotIds.has(scheduleSlotId)
}
