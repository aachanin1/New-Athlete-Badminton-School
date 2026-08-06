import type { getServiceRoleClient } from '@/lib/auth/admin'
import { CoachAssignmentDataUnavailableError } from '@/lib/coach-assignment-resolution'

type HistoryReadClient = ReturnType<typeof getServiceRoleClient>

export type CoachAssignmentHistoryEventType =
  | 'assignment_saved'
  | 'booking_added'
  | 'reschedule_in'
  | 'reschedule_out'
  | 'wallet_redeem'
  | 'wallet_store'
  | 'admin_adjustment'
  | 'unknown'

export interface CoachAssignmentHistoryEvent {
  occurredAt: string
  type: CoachAssignmentHistoryEventType
  label: string
  actorName: string | null
  learnerNames: string[]
  reason: string | null
}

interface HistorySessionRow {
  id: string
  booking_id: string
  status: string
  child_id: string | null
  rescheduled_from_id: string | null
  date: string
  start_time: string | null
  created_at: string
  updated_at: string
  children?: {
    full_name: string | null
    nickname: string | null
  } | null
  bookings?: {
    user_id: string
    status: string
    profiles?: { full_name: string | null } | null
  } | null
}

interface HistoryActivityRow {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  profiles?: { full_name: string | null } | null
}

interface HistoryWalletRow {
  id: string
  redeemed_session_id: string | null
  redeemed_at: string | null
}

interface ExactQueryResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

interface LimitedQueryResult<T> {
  data: T[] | null
  error: { message: string } | null
}

interface InternalHistoryEvent extends CoachAssignmentHistoryEvent {
  sortId: string
  businessKey: string
}

export const ASSIGNMENT_HISTORY_LIMIT = 5
const HISTORY_ACTIVITY_SCAN_LIMIT = 50
const HISTORY_SESSION_PAGE_SIZE = 1000
const HISTORY_SESSION_MAX_PAGES = 10
const HISTORY_SUPPORTING_BATCH_SIZE = 100
const HISTORY_SUPPORTING_MAX_BATCHES = 10

const HISTORY_ACTIVITY_ACTIONS = [
  'save_coach_assignment_groups_v2',
  'retire_coach_assignment_membership',
  'reschedule_booking_session',
  'store_lesson_wallet_credit',
  'redeem_lesson_wallet_credit',
  'attendance_gap_move_learner_to_existing_group',
  'attendance_gap_replace_coach_round',
  'attendance_gap_assign_coach_round',
  'attendance_gap_resolve_unassigned_round',
  'attendance_gap_return_entitlement',
] as const

const LEGACY_EVIDENCE_GAP = 'ไม่พบสาเหตุที่ยืนยันได้'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : []
}

function getSnapshotSessionIds(value: unknown) {
  return getStringArray(asRecord(value).membership_session_ids)
}

export function getSnapshotBusinessSignature(value: unknown) {
  const snapshot = asRecord(value)
  const groups = Array.isArray(snapshot.groups) ? snapshot.groups : []
  const normalizedGroups = groups.map((group) => {
    const row = asRecord(group)
    return {
      name: getString(row.name) || '',
      coachId: getString(row.coach_id),
      levelMin: typeof row.level_min === 'number' ? row.level_min : null,
      levelMax: typeof row.level_max === 'number' ? row.level_max : null,
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      studentSessionIds: getStringArray(row.student_session_ids).sort(),
    }
  }).sort((a, b) => (
    a.sortOrder - b.sortOrder
    || a.name.localeCompare(b.name)
    || (a.coachId || '').localeCompare(b.coachId || '')
    || a.studentSessionIds.join(',').localeCompare(b.studentSessionIds.join(','))
  ))

  return JSON.stringify({
    groups: normalizedGroups,
    coachIds: getStringArray(snapshot.coach_ids).sort(),
    membershipSessionIds: getSnapshotSessionIds(snapshot).sort(),
  })
}

export function isMeaningfulHistoryReason(value: unknown) {
  const reason = getString(value)
  if (!reason || /^[-–—\s]+$/.test(reason)) return false
  return !new Set(['n/a', 'na', 'none', 'null', 'ไม่มี', 'ไม่ระบุ']).has(reason.toLowerCase())
}

function getMeaningfulHistoryReason(value: unknown) {
  return isMeaningfulHistoryReason(value) ? getString(value)?.slice(0, 240) || null : null
}

function formatEvidenceSchedule(dateValue: unknown, timeValue: unknown) {
  const date = getString(dateValue)
  const time = getString(timeValue)?.slice(0, 5)
  if (!date && !time) return ''
  return ` ${date ? `วันที่ ${date}` : ''}${date && time ? ' ' : ''}${time ? `เวลา ${time} น.` : ''}`
}

function getLearnerName(session: HistorySessionRow) {
  if (session.child_id) {
    return session.children?.nickname || session.children?.full_name || null
  }
  return session.bookings?.profiles?.full_name || null
}

function getActivitySessionIds(row: HistoryActivityRow) {
  const details = asRecord(row.details)
  const ids = new Set<string>()
  const add = (value: unknown) => {
    if (typeof value === 'string' && value) ids.add(value)
  }
  const addMany = (value: unknown) => getStringArray(value).forEach((id) => ids.add(id))

  if (row.action === 'save_coach_assignment_groups_v2') {
    const beforeIds = new Set(getSnapshotSessionIds(details.before))
    const afterIds = new Set(getSnapshotSessionIds(details.after))
    beforeIds.forEach((id) => {
      if (!afterIds.has(id)) ids.add(id)
    })
    afterIds.forEach((id) => {
      if (!beforeIds.has(id)) ids.add(id)
    })
  } else if (row.action === 'retire_coach_assignment_membership') {
    add(details.bookingSessionId)
  } else if (row.action === 'reschedule_booking_session') {
    add(row.entity_id)
    add(details.newSessionId)
  } else if (row.action === 'store_lesson_wallet_credit') {
    add(details.sessionId)
  } else if (row.action === 'redeem_lesson_wallet_credit') {
    add(details.newSessionId)
  } else if (row.action.startsWith('attendance_gap_')) {
    add(row.entity_id)
    addMany(details.movedSessionIds)
    addMany(details.assignedSessionIds)
    addMany(details.replacedSessionIds)
    addMany(details.resolvedSessionIds)
  }

  return Array.from(ids)
}

export function getActivityPresentation(row: HistoryActivityRow) {
  const details = asRecord(row.details)
  if (row.action === 'save_coach_assignment_groups_v2') {
    if (getSnapshotBusinessSignature(details.before) === getSnapshotBusinessSignature(details.after)) {
      return null
    }
    return {
      type: 'assignment_saved' as const,
      label: 'บันทึกการแบ่งกลุ่ม',
      reason: null,
    }
  }
  if (row.action === 'retire_coach_assignment_membership') {
    const reason = getString(details.reason)
    if (reason === 'reschedule_out') {
      return {
        type: 'reschedule_out' as const,
        label: 'ย้ายผู้เรียนออกจากรอบนี้',
        reason: null,
      }
    }
    if (reason === 'wallet_store') {
      return {
        type: 'wallet_store' as const,
        label: 'เก็บรอบเรียนเข้ากระเป๋าวันเรียน',
        reason: null,
      }
    }
    return null
  }
  if (row.action === 'reschedule_booking_session') {
    return {
      type: 'reschedule_in' as const,
      label: `ย้ายผู้เรียนเข้ารอบ${formatEvidenceSchedule(details.newDate, details.newStartTime)}`,
      reason: null,
    }
  }
  if (row.action === 'store_lesson_wallet_credit') {
    return {
      type: 'wallet_store' as const,
      label: `เก็บรอบเรียนเข้ากระเป๋าวันเรียน${formatEvidenceSchedule(details.date, details.startTime)}`,
      reason: null,
    }
  }
  if (row.action === 'redeem_lesson_wallet_credit') {
    return {
      type: 'wallet_redeem' as const,
      label: `ใช้สิทธิ์จากกระเป๋าวันเรียน${formatEvidenceSchedule(details.targetDate, details.startTime)}`,
      reason: null,
    }
  }
  if (row.action === 'attendance_gap_move_learner_to_existing_group') {
    return {
      type: 'admin_adjustment' as const,
      label: 'Admin ย้ายผู้เรียนระหว่างกลุ่ม',
      reason: getMeaningfulHistoryReason(details.reason),
    }
  }
  if (row.action === 'attendance_gap_replace_coach_round') {
    return {
      type: 'admin_adjustment' as const,
      label: 'Admin เปลี่ยนโค้ชประจำรอบ',
      reason: getMeaningfulHistoryReason(details.reason),
    }
  }
  if (row.action === 'attendance_gap_assign_coach_round') {
    return {
      type: 'admin_adjustment' as const,
      label: 'Admin มอบหมายโค้ชประจำรอบ',
      reason: getMeaningfulHistoryReason(details.reason),
    }
  }
  if (row.action === 'attendance_gap_resolve_unassigned_round') {
    return {
      type: 'admin_adjustment' as const,
      label: 'Admin มอบหมายโค้ชและกลุ่มให้รอบที่ยังไม่มีผู้รับผิดชอบ',
      reason: getMeaningfulHistoryReason(details.reason),
    }
  }
  if (row.action === 'attendance_gap_return_entitlement') {
    return {
      type: 'wallet_store' as const,
      label: 'Admin คืนสิทธิ์รอบเรียนเข้ากระเป๋าวันเรียน',
      reason: getMeaningfulHistoryReason(details.reason),
    }
  }
  return null
}

export function getHistoryBusinessKey(row: HistoryActivityRow, sessionIds: string[]) {
  const details = asRecord(row.details)
  const sortedSessionIds = [...sessionIds].sort().join(',')
  if (row.action === 'retire_coach_assignment_membership') {
    const reason = getString(details.reason)
    return `${reason || 'retire'}:${getString(details.bookingSessionId) || row.id}`
  }
  if (row.action === 'reschedule_booking_session') {
    return `reschedule_out:${row.entity_id || getString(details.newSessionId) || row.id}`
  }
  if (row.action === 'store_lesson_wallet_credit') {
    return `wallet_store:${getString(details.sessionId) || row.id}`
  }
  if (row.action === 'redeem_lesson_wallet_credit') {
    return `wallet_redeem:${getString(details.newSessionId) || row.id}`
  }
  if (row.action.startsWith('attendance_gap_')) {
    return `${row.action}:${sortedSessionIds}`
  }
  return `${row.action}:${row.id}`
}

export function deduplicateMeaningfulHistoryEvents(events: InternalHistoryEvent[]) {
  const seenBusinessKeys = new Set<string>()
  return [...events]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.sortId.localeCompare(a.sortId))
    .filter((event) => {
      if (seenBusinessKeys.has(event.businessKey)) return false
      seenBusinessKeys.add(event.businessKey)
      return true
    })
}

export function finalizeMeaningfulHistoryEvents(events: InternalHistoryEvent[]) {
  return deduplicateMeaningfulHistoryEvents(events)
    .slice(0, ASSIGNMENT_HISTORY_LIMIT)
    .map(({ sortId: _sortId, businessKey: _businessKey, ...event }) => event)
}

async function loadCompleteHistorySessions(
  client: HistoryReadClient,
  scheduleSlotId: string,
  branchId: string,
) {
  const rows: HistorySessionRow[] = []
  const seenIds = new Set<string>()
  let expectedCount: number | null = null

  for (let pageIndex = 0; pageIndex < HISTORY_SESSION_MAX_PAGES; pageIndex += 1) {
    const pageStart = pageIndex * HISTORY_SESSION_PAGE_SIZE
    const pageEnd = pageStart + HISTORY_SESSION_PAGE_SIZE - 1
    const result = await client
      .from('booking_sessions')
      .select(`
        id, booking_id, status, child_id, rescheduled_from_id, date, start_time, created_at, updated_at,
        children(full_name, nickname),
        bookings!inner(user_id, status, profiles!bookings_user_id_fkey(full_name))
      `, { count: 'exact' })
      .eq('schedule_slot_id', scheduleSlotId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(pageStart, pageEnd) as unknown as ExactQueryResult<HistorySessionRow>

    if (result.error || !Array.isArray(result.data) || !Number.isInteger(result.count)) {
      throw new CoachAssignmentDataUnavailableError(
        'Coach assignment history session query failed',
        result.error?.message || 'exact row count was unavailable',
      )
    }
    if (expectedCount === null) expectedCount = result.count
    else if (expectedCount !== result.count) {
      throw new CoachAssignmentDataUnavailableError('Coach assignment history session query failed', 'row count changed during pagination')
    }

    for (const row of result.data) {
      if (seenIds.has(row.id)) {
        throw new CoachAssignmentDataUnavailableError('Coach assignment history session query failed', 'duplicate booking_session id during pagination')
      }
      seenIds.add(row.id)
      rows.push(row)
    }

    if (result.data.length < HISTORY_SESSION_PAGE_SIZE) {
      if (rows.length !== expectedCount) {
        throw new CoachAssignmentDataUnavailableError('Coach assignment history session query failed', 'pagination ended before exact row count')
      }
      return rows
    }
  }

  throw new CoachAssignmentDataUnavailableError('Coach assignment history session query failed', 'exceeded bounded pagination')
}

async function loadWalletEvidence(
  client: HistoryReadClient,
  sessionIds: string[],
) {
  const uniqueIds = Array.from(new Set(sessionIds.filter(Boolean)))
  if (uniqueIds.length === 0) return [] as HistoryWalletRow[]

  const batchCount = Math.ceil(uniqueIds.length / HISTORY_SUPPORTING_BATCH_SIZE)
  if (batchCount > HISTORY_SUPPORTING_MAX_BATCHES) {
    throw new CoachAssignmentDataUnavailableError('Coach assignment history wallet query failed', 'supporting query exceeded bounded IN batches')
  }

  const results = await Promise.all(Array.from({ length: batchCount }, (_, index) => (
    uniqueIds.slice(index * HISTORY_SUPPORTING_BATCH_SIZE, (index + 1) * HISTORY_SUPPORTING_BATCH_SIZE)
  )).map((batch) => client
    .from('lesson_wallet_credits')
    .select('id, redeemed_session_id, redeemed_at', { count: 'exact' })
    .in('redeemed_session_id', batch)
    .order('redeemed_at', { ascending: false })
    .order('id', { ascending: false }) as unknown as PromiseLike<ExactQueryResult<HistoryWalletRow>>))

  return results.flatMap((result) => {
    if (result.error || !Array.isArray(result.data) || result.count !== result.data.length) {
      throw new CoachAssignmentDataUnavailableError(
        'Coach assignment history wallet query failed',
        result.error?.message || 'supporting query was incomplete',
      )
    }
    return result.data
  })
}

export async function getCoachAssignmentHistory(client: HistoryReadClient, input: {
  scheduleSlotId: string
  branchId: string
}) {
  const { scheduleSlotId, branchId } = input
  const [sessions, activityResult] = await Promise.all([
    loadCompleteHistorySessions(client, scheduleSlotId, branchId),
    client
      .from('activity_logs')
      .select('id, user_id, action, entity_type, entity_id, details, created_at, profiles!activity_logs_user_id_fkey(full_name)')
      .in('action', [...HISTORY_ACTIVITY_ACTIONS])
      .contains('details', { scheduleSlotId })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HISTORY_ACTIVITY_SCAN_LIMIT) as unknown as PromiseLike<LimitedQueryResult<HistoryActivityRow>>,
  ])

  if (activityResult.error || !Array.isArray(activityResult.data)) {
    throw new CoachAssignmentDataUnavailableError(
      'Coach assignment history audit query failed',
      activityResult.error?.message || 'query returned no row payload',
    )
  }
  const walletEvidence = await loadWalletEvidence(
    client,
    sessions.filter((session) => Boolean(session.rescheduled_from_id)).map((session) => session.id),
  )
  const walletByRedeemedSessionId = new Map(walletEvidence
    .filter((credit) => Boolean(credit.redeemed_session_id))
    .map((credit) => [credit.redeemed_session_id as string, credit]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const explicitSessionIds = new Set<string>()
  const events: InternalHistoryEvent[] = activityResult.data.flatMap((row) => {
    const activitySessionIds = getActivitySessionIds(row)
    const presentation = getActivityPresentation(row)
    if (!presentation) return []
    activitySessionIds.forEach((sessionId) => explicitSessionIds.add(sessionId))
    const learnerNames = Array.from(new Set(activitySessionIds
      .map((sessionId) => sessionById.get(sessionId))
      .filter((session): session is HistorySessionRow => Boolean(session))
      .map(getLearnerName)
      .filter((name): name is string => Boolean(name))))

    return [{
      occurredAt: row.created_at,
      type: presentation.type,
      label: presentation.label,
      actorName: row.profiles?.full_name || null,
      learnerNames,
      reason: presentation.reason,
      sortId: row.id,
      businessKey: getHistoryBusinessKey(row, activitySessionIds),
    }]
  })

  sessions.forEach((session) => {
    if (explicitSessionIds.has(session.id)) return
    const learnerName = getLearnerName(session)
    const learnerNames = learnerName ? [learnerName] : []
    const walletEvidenceForSession = walletByRedeemedSessionId.get(session.id)

    if (walletEvidenceForSession) {
      events.push({
        occurredAt: walletEvidenceForSession.redeemed_at || session.created_at,
        type: 'wallet_redeem',
        label: `ใช้สิทธิ์จากกระเป๋าวันเรียน${formatEvidenceSchedule(session.date, session.start_time)}`,
        actorName: null,
        learnerNames,
        reason: null,
        sortId: session.id,
        businessKey: `wallet_redeem:${session.id}`,
      })
      return
    }
    if (session.rescheduled_from_id) {
      events.push({
        occurredAt: session.created_at,
        type: 'reschedule_in',
        label: `ย้ายผู้เรียนเข้ารอบ${formatEvidenceSchedule(session.date, session.start_time)}`,
        actorName: null,
        learnerNames,
        reason: null,
        sortId: session.id,
        businessKey: `reschedule_out:${session.rescheduled_from_id}`,
      })
      return
    }
    if (session.status === 'rescheduled' || session.status === 'walleted') {
      events.push({
        occurredAt: session.updated_at,
        type: 'unknown',
        label: 'การเปลี่ยนแปลงของรายชื่อที่ไม่มีหลักฐานยืนยัน',
        actorName: null,
        learnerNames,
        reason: LEGACY_EVIDENCE_GAP,
        sortId: session.id,
        businessKey: `unknown:${session.id}`,
      })
      return
    }

    if (session.bookings?.status === 'verified') {
      events.push({
        occurredAt: session.created_at,
        type: 'booking_added',
        label: 'เพิ่มผู้เรียนจากการจอง',
        actorName: null,
        learnerNames,
        reason: null,
        sortId: session.id,
        businessKey: `booking:${session.booking_id}`,
      })
    }
  })

  return finalizeMeaningfulHistoryEvents(events)
}
