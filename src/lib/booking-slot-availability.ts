export interface BookingAvailabilitySlotInput {
  date: string
  startTime: string
  endTime: string
  branchId: string
  scheduleTemplateId?: string | null
}

export interface BookingAvailabilityTemplateRow {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface BookingAvailabilityScheduleSlotRow {
  id: string
  template_id: string | null
  branch_id: string
  course_type_id: string
  date: string
  start_time: string
  end_time: string
  status: string
}

export interface BookingAvailabilitySessionRow {
  schedule_slot_id: string | null
  booking_id: string
  cancelled_at: string | null
  status: string
  bookings: {
    status: string
    expires_at: string | null
  } | Array<{
    status: string
    expires_at: string | null
  }> | null
}

export type BookingAvailabilityReason =
  | 'invalid_template'
  | 'cancelled_slot'
  | 'slot_mismatch'

export interface BookingSlotAvailability {
  key: string
  date: string
  startTime: string
  endTime: string
  branchId: string
  scheduleTemplateId: string | null
  scheduleSlotId: string | null
  activeOccupancy: number
  valid: boolean
  unavailableReason: BookingAvailabilityReason | null
}

const ACTIVE_BOOKING_STATUSES = new Set(['pending_payment', 'paid', 'verified'])
const ACTIVE_SESSION_STATUSES = new Set(['scheduled', 'completed', 'absent'])

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

export function getBookingAvailabilitySlotKey(slot: BookingAvailabilitySlotInput) {
  return [slot.branchId, slot.date, normalizeTime(slot.startTime), normalizeTime(slot.endTime)].join('|')
}

function getBangkokDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function getBookingRelation(row: BookingAvailabilitySessionRow) {
  return Array.isArray(row.bookings) ? row.bookings[0] || null : row.bookings
}

function isActiveOccupancy(row: BookingAvailabilitySessionRow, nowMs: number, excludeBookingId?: string | null) {
  if (!row.schedule_slot_id || row.cancelled_at || !ACTIVE_SESSION_STATUSES.has(row.status)) return false
  if (excludeBookingId && row.booking_id === excludeBookingId) return false

  const booking = getBookingRelation(row)
  if (!booking || !ACTIVE_BOOKING_STATUSES.has(booking.status)) return false
  if (booking.status !== 'pending_payment' || !booking.expires_at) return true
  return new Date(booking.expires_at).getTime() > nowMs
}

function selectCanonicalTemplate(
  candidate: BookingAvailabilitySlotInput,
  courseTypeId: string,
  templates: BookingAvailabilityTemplateRow[],
) {
  const start = normalizeTime(candidate.startTime)
  const end = normalizeTime(candidate.endTime)
  return templates
    .filter((template) => (
      template.is_active
      && template.course_type_id === courseTypeId
      && template.branch_id === candidate.branchId
      && template.day_of_week === getBangkokDayOfWeek(candidate.date)
      && normalizeTime(template.start_time) <= start
      && normalizeTime(template.end_time) >= end
      && (!candidate.scheduleTemplateId || template.id === candidate.scheduleTemplateId)
    ))
    .sort((left, right) => (
      normalizeTime(right.start_time).localeCompare(normalizeTime(left.start_time))
      || normalizeTime(left.end_time).localeCompare(normalizeTime(right.end_time))
      || left.id.localeCompare(right.id)
    ))[0] || null
}

export function buildBookingSlotAvailability({
  courseTypeId,
  candidates,
  templates,
  scheduleSlots,
  bookingSessions,
  nowMs,
  excludeBookingId,
}: {
  courseTypeId: string
  candidates: BookingAvailabilitySlotInput[]
  templates: BookingAvailabilityTemplateRow[]
  scheduleSlots: BookingAvailabilityScheduleSlotRow[]
  bookingSessions: BookingAvailabilitySessionRow[]
  nowMs: number
  excludeBookingId?: string | null
}) {
  const occupancyBySlotId = new Map<string, number>()
  for (const session of bookingSessions) {
    if (!isActiveOccupancy(session, nowMs, excludeBookingId) || !session.schedule_slot_id) continue
    occupancyBySlotId.set(
      session.schedule_slot_id,
      (occupancyBySlotId.get(session.schedule_slot_id) || 0) + 1,
    )
  }

  const seen = new Set<string>()
  const result: BookingSlotAvailability[] = []
  for (const candidate of candidates) {
    const key = getBookingAvailabilitySlotKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)

    const canonicalTemplate = selectCanonicalTemplate(candidate, courseTypeId, templates)
    if (!canonicalTemplate) {
      result.push({
        key,
        date: candidate.date,
        startTime: normalizeTime(candidate.startTime),
        endTime: normalizeTime(candidate.endTime),
        branchId: candidate.branchId,
        scheduleTemplateId: candidate.scheduleTemplateId || null,
        scheduleSlotId: null,
        activeOccupancy: 0,
        valid: false,
        unavailableReason: 'invalid_template',
      })
      continue
    }

    const matchingStartSlot = scheduleSlots.find((slot) => (
      slot.course_type_id === courseTypeId
      && slot.branch_id === candidate.branchId
      && slot.date === candidate.date
      && normalizeTime(slot.start_time) === normalizeTime(candidate.startTime)
    )) || null
    const slotMatchesEnd = !matchingStartSlot
      || normalizeTime(matchingStartSlot.end_time) === normalizeTime(candidate.endTime)
    const slotCancelled = matchingStartSlot?.status === 'cancelled'
    const valid = slotMatchesEnd && !slotCancelled
    const activeOccupancy = matchingStartSlot
      ? occupancyBySlotId.get(matchingStartSlot.id) || 0
      : 0
    const unavailableReason: BookingAvailabilityReason | null = !slotMatchesEnd
      ? 'slot_mismatch'
      : slotCancelled
        ? 'cancelled_slot'
        : null

    result.push({
      key,
      date: candidate.date,
      startTime: normalizeTime(candidate.startTime),
      endTime: normalizeTime(candidate.endTime),
      branchId: candidate.branchId,
      scheduleTemplateId: canonicalTemplate.id,
      scheduleSlotId: matchingStartSlot?.id || null,
      activeOccupancy,
      valid,
      unavailableReason,
    })
  }

  return result
}
