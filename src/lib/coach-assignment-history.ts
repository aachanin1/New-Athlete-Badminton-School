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
  contextLines?: string[]
}

interface HistorySessionRow {
  id: string
  booking_id: string
  status: string
  child_id: string | null
  rescheduled_from_id: string | null
  date: string
  start_time: string | null
  end_time: string | null
  branches?: { name: string | null } | null
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
  original_session_id: string
  redeemed_session_id: string | null
  redeemed_at: string | null
  created_at: string
  original_date: string
  original_start_time: string
  original_end_time: string
  branches?: { name: string | null } | null
}

interface HistoryWalletMemberRow {
  credit_id: string
  original_session_id: string
  redeemed_session_id: string | null
}

interface ExactQueryResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

interface InternalHistoryEvent extends CoachAssignmentHistoryEvent {
  sortId: string
  businessKey: string
  evidenceRank?: number
}

export const ASSIGNMENT_HISTORY_LIMIT = 5
const HISTORY_SESSION_PAGE_SIZE = 1000
const HISTORY_SESSION_MAX_PAGES = 10
const HISTORY_SUPPORTING_BATCH_SIZE = 100
const HISTORY_SUPPORTING_MAX_BATCHES = 100

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

const LEGACY_EVIDENCE_WARNING = 'ต้องให้ Admin ตรวจสอบ'
const LEGACY_EVIDENCE_GAP = 'ระบบไม่พบหลักฐานเดิมที่ระบุว่าเกิดจากการย้ายวันหรือเก็บเข้ากระเป๋า'

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
    changedGroups(details.before, details.after).forEach((group) => addMany(group.student_session_ids))
  } else if (row.action === 'retire_coach_assignment_membership') {
    add(details.bookingSessionId)
  } else if (row.action === 'reschedule_booking_session') {
    add(row.entity_id)
    add(details.newSessionId)
  } else if (row.action === 'store_lesson_wallet_credit') {
    add(details.sessionId)
    addMany(details.participantSessionIds)
  } else if (row.action === 'redeem_lesson_wallet_credit') {
    add(details.newSessionId)
    addMany(details.newSessionIds)
  } else if (row.action.startsWith('attendance_gap_')) {
    add(row.entity_id)
    addMany(details.participantSessionIds)
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
    return `wallet_store:${sortedSessionIds || row.entity_id || row.id}`
  }
  if (row.action === 'redeem_lesson_wallet_credit') {
    return `wallet_redeem:${sortedSessionIds || row.entity_id || row.id}`
  }
  if (row.action.startsWith('attendance_gap_')) {
    return `${row.action}:${row.id}`
  }
  return `${row.action}:${row.id}`
}

export function deduplicateMeaningfulHistoryEvents(events: InternalHistoryEvent[]) {
  const merged = new Map<string, InternalHistoryEvent>()
  for (const event of events) {
    const previous = merged.get(event.businessKey)
    if (!previous) { merged.set(event.businessKey, event); continue }
    const preferred = (event.evidenceRank || 0) > (previous.evidenceRank || 0)
      || ((event.evidenceRank || 0) === (previous.evidenceRank || 0) && event.occurredAt > previous.occurredAt) ? event : previous
    merged.set(event.businessKey, {
      ...preferred,
      actorName: preferred.actorName || previous.actorName || event.actorName,
      learnerNames: previous.learnerNames.length > event.learnerNames.length ? previous.learnerNames : event.learnerNames,
      contextLines: [...new Set([...(previous.contextLines || []), ...(event.contextLines || [])])],
    })
  }
  return [...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.businessKey.localeCompare(a.businessKey))
}

export function finalizeMeaningfulHistoryEvents(events: InternalHistoryEvent[]) {
  return deduplicateMeaningfulHistoryEvents(events)
    .slice(0, ASSIGNMENT_HISTORY_LIMIT)
    .map(publicEvent)
}

function publicEvent({ sortId: _sortId, businessKey: _businessKey, evidenceRank: _rank, ...event }: InternalHistoryEvent) {
  return event
}

function snapshotGroups(value: unknown) {
  const groups = asRecord(value).groups
  return Array.isArray(groups) ? groups.map(asRecord) : []
}

function groupSignature(group: Record<string, unknown>) {
  return getSnapshotBusinessSignature({ groups: [group] })
}

function changedGroups(before: unknown, after: unknown) {
  const oldGroups = snapshotGroups(before), newGroups = snapshotGroups(after)
  const oldKeys = new Set(oldGroups.map(groupSignature)), newKeys = new Set(newGroups.map(groupSignature))
  return [...oldGroups.filter((g) => !newKeys.has(groupSignature(g))), ...newGroups.filter((g) => !oldKeys.has(groupSignature(g)))]
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
        id, booking_id, status, child_id, rescheduled_from_id, date, start_time, end_time, created_at, updated_at,
        children(full_name, nickname), branches(name),
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

async function readAll<T>(query: (start: number, end: number) => PromiseLike<ExactQueryResult<T>>, context: string) {
  const rows: T[] = []
  const seen = new Set<string>()
  let count: number | null = null
  for (let page = 0; page < HISTORY_SESSION_MAX_PAGES; page += 1) {
    const result = await query(page * HISTORY_SESSION_PAGE_SIZE, (page + 1) * HISTORY_SESSION_PAGE_SIZE - 1)
    if (result.error || !Array.isArray(result.data) || !Number.isInteger(result.count)) {
      throw new CoachAssignmentDataUnavailableError(context, result.error?.message || 'exact count unavailable')
    }
    if (count !== null && count !== result.count) throw new CoachAssignmentDataUnavailableError(context, 'evidence changed during pagination')
    count = result.count
    for (const row of result.data) {
      const value = asRecord(row)
      const id = getString(value.id) || `${getString(value.credit_id)}:${getString(value.original_session_id)}`
      if (seen.has(id)) throw new CoachAssignmentDataUnavailableError(context, 'duplicate evidence during pagination')
      seen.add(id)
    }
    rows.push(...result.data)
    if (rows.length === count) return rows
    if (result.data.length < HISTORY_SESSION_PAGE_SIZE) throw new CoachAssignmentDataUnavailableError(context, 'incomplete evidence')
  }
  throw new CoachAssignmentDataUnavailableError(context, 'bounded evidence limit exceeded')
}

async function readBatches<T>(ids: string[], query: (batch: string[], start: number, end: number) => PromiseLike<ExactQueryResult<T>>) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length > HISTORY_SUPPORTING_BATCH_SIZE * HISTORY_SUPPORTING_MAX_BATCHES) {
    throw new CoachAssignmentDataUnavailableError('History supporting query failed', 'bounded IN limit exceeded')
  }
  const rows: T[] = []
  for (let i = 0; i < unique.length; i += HISTORY_SUPPORTING_BATCH_SIZE) {
    const batch = unique.slice(i, i + HISTORY_SUPPORTING_BATCH_SIZE)
    rows.push(...await readAll((start, end) => query(batch, start, end), 'History supporting query failed'))
  }
  return rows
}

async function loadWalletEvidence(client: HistoryReadClient, sessionIds: string[]) {
  const memberQuery = (field: 'original_session_id' | 'redeemed_session_id' | 'credit_id', ids: string[]) => readBatches<HistoryWalletMemberRow>(ids, (batch, start, end) => client
    .from('lesson_wallet_credit_members').select('credit_id, original_session_id, redeemed_session_id', { count: 'exact' })
    .in(field, batch).order('credit_id').order('original_session_id').range(start, end) as unknown as PromiseLike<ExactQueryResult<HistoryWalletMemberRow>>)
  const creditQuery = (field: 'original_session_id' | 'redeemed_session_id' | 'id', ids: string[]) => readBatches<HistoryWalletRow>(ids, (batch, start, end) => client
    .from('lesson_wallet_credits').select('id, original_session_id, redeemed_session_id, redeemed_at, created_at, original_date, original_start_time, original_end_time, branches(name)', { count: 'exact' })
    .in(field, batch).order('id').range(start, end) as unknown as PromiseLike<ExactQueryResult<HistoryWalletRow>>)
  const [originalMembers, redeemedMembers, originalCredits, redeemedCredits] = await Promise.all([
    memberQuery('original_session_id', sessionIds), memberQuery('redeemed_session_id', sessionIds),
    creditQuery('original_session_id', sessionIds), creditQuery('redeemed_session_id', sessionIds),
  ])
  const credits = new Map([...originalCredits, ...redeemedCredits].map(c => [c.id, c]))
  const memberCredits = [...new Set([...originalMembers, ...redeemedMembers].map(m => m.credit_id))]
  const missing = memberCredits.filter(id => !credits.has(id))
  for (const credit of await creditQuery('id', missing)) credits.set(credit.id, credit)
  if (memberCredits.some(id => !credits.has(id))) throw new CoachAssignmentDataUnavailableError('History wallet query failed', 'member credit missing')
  const members = await memberQuery('credit_id', [...credits.keys()])
  return { credits: [...credits.values()], members }
}

export interface CoachAssignmentHistoryPage {
  events: CoachAssignmentHistoryEvent[]
  nextCursor: string | null
}

function historyCursor(event: InternalHistoryEvent) {
  return `${event.occurredAt}|${event.businessKey}`
}

export async function getCoachAssignmentHistory(client: HistoryReadClient, input: {
  scheduleSlotId: string
  branchId: string
  before?: string | null
}): Promise<CoachAssignmentHistoryPage> {
  const sessions = await loadCompleteHistorySessions(client, input.scheduleSlotId, input.branchId)
  const { credits, members } = await loadWalletEvidence(client, sessions.map(s => s.id))
  const creditById = new Map(credits.map(c => [c.id, c]))
  const storeCredit = new Map<string, HistoryWalletRow>(), redeemCredit = new Map<string, HistoryWalletRow>()
  const originalIds = (credit: HistoryWalletRow) => [...new Set([credit.original_session_id, ...members.filter(m => m.credit_id === credit.id).map(m => m.original_session_id)])]
  const redeemedIds = (credit: HistoryWalletRow) => [...new Set([credit.redeemed_session_id, ...members.filter(m => m.credit_id === credit.id).map(m => m.redeemed_session_id)].filter((id): id is string => Boolean(id)))]
  credits.forEach(c => { originalIds(c).forEach(id => storeCredit.set(id, c)); redeemedIds(c).forEach(id => redeemCredit.set(id, c)) })
  const auditSelect = 'id, user_id, action, entity_type, entity_id, details, created_at, profiles!activity_logs_user_id_fkey(full_name)'
  const [slotAudits, entityAudits] = await Promise.all([
    readAll<HistoryActivityRow>((start, end) => client.from('activity_logs').select(auditSelect, { count: 'exact' })
      .in('action', [...HISTORY_ACTIVITY_ACTIONS]).contains('details', { scheduleSlotId: input.scheduleSlotId })
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, end) as unknown as PromiseLike<ExactQueryResult<HistoryActivityRow>>, 'History audit query failed'),
    readBatches<HistoryActivityRow>([...credits.map(c => c.id), ...sessions.map(s => s.id)], (batch, start, end) => client.from('activity_logs').select(auditSelect, { count: 'exact' })
      .in('action', [...HISTORY_ACTIVITY_ACTIONS]).in('entity_id', batch)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, end) as unknown as PromiseLike<ExactQueryResult<HistoryActivityRow>>),
  ])
  const audits = [...new Map([...slotAudits, ...entityAudits].map(row => [row.id, row])).values()]
  const coachIds = audits.flatMap(row => [...snapshotGroups(asRecord(row.details).before), ...snapshotGroups(asRecord(row.details).after)]
    .map(g => getString(g.coach_id)).filter((id): id is string => Boolean(id)))
  const coachRows = await readBatches<{ id: string; full_name: string | null }>(coachIds, (batch, start, end) => client.from('profiles')
    .select('id, full_name', { count: 'exact' }).in('id', batch).order('id').range(start, end) as unknown as PromiseLike<ExactQueryResult<{ id: string; full_name: string | null }>>)
  const coachNames = new Map(coachRows.map(c => [c.id, c.full_name]))
  const sessionById = new Map(sessions.map(s => [s.id, s]))
  // Keep one name per exact learner. Equal display names do not merge people.
  const names = (ids: string[]) => {
    const learners = new Map<string, string>()
    ids.forEach(id => { const s = sessionById.get(id); if (!s) return; const name = getLearnerName(s); if (name) learners.set(s.child_id || s.bookings?.user_id || s.id, name) })
    return [...learners.values()]
  }
  const localIds = (ids: string[]) => ids.filter(id => sessionById.has(id))
  const schedule = (s: HistorySessionRow) => `${s.date} ${s.start_time?.slice(0, 5) || ''}–${s.end_time?.slice(0, 5) || ''}${s.branches?.name ? ` · ${s.branches.name}` : ''}`
  const groupLine = (group: Record<string, unknown>) => {
    const coachId = getString(group.coach_id)
    return `${getString(group.name) || 'กลุ่มไม่ระบุชื่อ'} · ${coachId ? coachNames.get(coachId) || 'ไม่พบชื่อโค้ชจากหลักฐาน' : 'ยังไม่มีโค้ช'} · ผู้เรียน ${names(getStringArray(group.student_session_ids)).join(', ') || 'ไม่พบชื่อจากหลักฐาน'}`
  }
  const walletRetirementLines = (credit: HistoryWalletRow) => {
    const affectedIds = new Set(originalIds(credit))
    const retirements = audits.filter(row => row.action === 'retire_coach_assignment_membership'
      && asRecord(row.details).reason === 'wallet_store'
      && affectedIds.has(getString(asRecord(row.details).bookingSessionId) || ''))
    const beforeByGroup = new Map<string, Record<string, unknown>>()
    const remainingByGroup = new Map<string, number>()
    for (const row of retirements) {
      const detail = asRecord(row.details), affected = getString(detail.bookingSessionId)
      for (const group of snapshotGroups(detail.before).filter(g => affected && getStringArray(g.student_session_ids).includes(affected))) {
        const id = getString(group.id) || groupSignature(group), previous = beforeByGroup.get(id)
        if (!previous || getStringArray(group.student_session_ids).length > getStringArray(previous.student_session_ids).length) beforeByGroup.set(id, group)
        const after = snapshotGroups(detail.after).find(g => g.id === group.id)
        const remaining = getStringArray(after?.student_session_ids).length
        remainingByGroup.set(id, Math.min(remaining, remainingByGroup.get(id) ?? remaining))
      }
    }
    return [...beforeByGroup].flatMap(([id, group]) => [`ออกจาก ${groupLine(group)}`, `กลุ่ม ${getString(group.name) || 'ไม่ระบุชื่อ'} เหลือ ${remainingByGroup.get(id)} คนหลังรายการนี้`])
  }
  const events: InternalHistoryEvent[] = []
  const removalEvidence = new Set<string>()
  const returnedCredits = new Set(audits.filter(row => row.action === 'attendance_gap_return_entitlement')
    .map(row => getString(asRecord(row.details).creditId) || getString(asRecord(row.details).credit_id))
    .filter((id): id is string => Boolean(id && creditById.has(id))))
  for (const row of audits) {
    const activityPresentation = getActivityPresentation(row)
    if (!activityPresentation) continue
    const presentation: Pick<CoachAssignmentHistoryEvent, 'type' | 'label' | 'reason'> = { ...activityPresentation }
    const details = asRecord(row.details)
    let ids = getActivitySessionIds(row), key = getHistoryBusinessKey(row, ids)
    let rank = 1
    const lines: string[] = []
    if (presentation.type === 'wallet_store' || presentation.type === 'wallet_redeem') {
      const isStore = presentation.type === 'wallet_store'
      const credit = (row.entity_id ? creditById.get(row.entity_id) : undefined)
        || ids.map(id => (isStore ? storeCredit : redeemCredit).get(id)).find(Boolean)
      if (credit) {
        ids = isStore ? originalIds(credit) : redeemedIds(credit)
        key = `${presentation.type}:${credit.id}`
        if (isStore && returnedCredits.has(credit.id)) {
          presentation.type = 'admin_adjustment'
          presentation.label = 'Admin คืนสิทธิ์รอบเรียนเข้ากระเป๋าวันเรียน'
          key = `wallet_return:${credit.id}`
        }
        lines.push(`ต้นทาง ${credit.original_date} ${credit.original_start_time.slice(0, 5)}–${credit.original_end_time.slice(0, 5)}${credit.branches?.name ? ` · ${credit.branches.name}` : ''}`)
        if (isStore) lines.push(...walletRetirementLines(credit))
        if (!isStore) {
          const target = ids.map(id => sessionById.get(id)).find(Boolean)
          if (target) lines.push(`ปลายทาง ${schedule(target)}`)
        }
      }
      if (row.action !== 'retire_coach_assignment_membership') rank = 2
    }
    if (row.action === 'attendance_gap_return_entitlement') {
      const credit = creditById.get(getString(details.creditId) || getString(details.credit_id) || '')
      if (credit) {
        ids = originalIds(credit)
        key = `wallet_return:${credit.id}`
        rank = 2
        lines.push(...walletRetirementLines(credit))
      }
    }
    if (row.action === 'reschedule_booking_session' && row.entity_id && sessionById.has(row.entity_id) && !sessionById.has(getString(details.newSessionId) || '')) {
      presentation.type = 'reschedule_out'
      presentation.label = `ย้ายผู้เรียนออกจากรอบนี้${formatEvidenceSchedule(details.newDate, details.newStartTime)}`
      ids = [row.entity_id]
    }
    if (row.action === 'save_coach_assignment_groups_v2') {
      const changed = new Set(changedGroups(details.before, details.after).map(groupSignature))
      snapshotGroups(details.before).filter(g => changed.has(groupSignature(g))).forEach(g => lines.push(`ก่อน: ${groupLine(g)}`))
      snapshotGroups(details.after).filter(g => changed.has(groupSignature(g))).forEach(g => lines.push(`หลัง: ${groupLine(g)}`))
    } else if (row.action === 'retire_coach_assignment_membership' && presentation.type !== 'wallet_store' && !key.startsWith('wallet_return:')) {
      const affected = getString(details.bookingSessionId)
      const before = snapshotGroups(details.before).filter(g => affected && getStringArray(g.student_session_ids).includes(affected))
      before.forEach(g => {
        lines.push(`ออกจาก ${groupLine(g)}`)
        const after = snapshotGroups(details.after).find(next => next.id === g.id)
        lines.push(`กลุ่ม ${getString(g.name) || 'ไม่ระบุชื่อ'} เหลือ ${getStringArray(after?.student_session_ids).length} คน`)
      })
      if (localIds(ids).length) lines.push(`รอบนี้เหลือสมาชิกกลุ่ม ${getSnapshotSessionIds(details.after).length} คน`)
    }
    ids = localIds(ids)
    if (!ids.length && row.action !== 'save_coach_assignment_groups_v2') continue
    if (['wallet_store', 'reschedule_out'].includes(presentation.type) || key.startsWith('wallet_return:')) ids.forEach(id => removalEvidence.add(id))
    events.push({ occurredAt: row.created_at, ...presentation, actorName: row.profiles?.full_name || null, learnerNames: names(ids),
      contextLines: lines, sortId: row.id, businessKey: key, evidenceRank: rank })
  }
  for (const credit of credits) {
    const ids = localIds(originalIds(credit))
    if (ids.length) {
      ids.forEach(id => removalEvidence.add(id))
      if (!returnedCredits.has(credit.id)) {
      events.push({ occurredAt: credit.created_at, type: 'wallet_store', label: 'เก็บรอบเรียนเข้ากระเป๋าวันเรียน', actorName: null,
        learnerNames: names(ids), reason: null, sortId: credit.id, businessKey: `wallet_store:${credit.id}`, evidenceRank: 0,
        contextLines: [`ต้นทาง ${credit.original_date} ${credit.original_start_time.slice(0, 5)}–${credit.original_end_time.slice(0, 5)}${credit.branches?.name ? ` · ${credit.branches.name}` : ''}`, ...walletRetirementLines(credit)] })
      }
    }
    const redeemed = localIds(redeemedIds(credit))
    if (redeemed.length) events.push({ occurredAt: credit.redeemed_at || sessionById.get(redeemed[0])!.created_at, type: 'wallet_redeem',
      label: 'ใช้สิทธิ์จากกระเป๋าวันเรียน', actorName: null, learnerNames: names(redeemed), reason: null,
      sortId: credit.id, businessKey: `wallet_redeem:${credit.id}`, evidenceRank: 0 })
  }
  for (const session of sessions) {
    if (session.rescheduled_from_id && !redeemCredit.has(session.id)) {
      events.push({ occurredAt: session.created_at, type: 'reschedule_in', label: `ย้ายผู้เรียนเข้ารอบ${formatEvidenceSchedule(session.date, session.start_time)}`,
        actorName: null, learnerNames: names([session.id]), reason: null, sortId: session.id, businessKey: `reschedule_out:${session.rescheduled_from_id}`, evidenceRank: 0 })
    } else if (!session.rescheduled_from_id && session.bookings?.status === 'verified') {
      events.push({ occurredAt: session.created_at, type: 'booking_added', label: 'เพิ่มผู้เรียนจากการจอง', actorName: null,
        learnerNames: names(sessions.filter(s => s.booking_id === session.booking_id && !s.rescheduled_from_id).map(s => s.id)),
        reason: null, sortId: session.id, businessKey: `booking:${session.booking_id}`, evidenceRank: 0,
        contextLines: [`รอบ ${schedule(session)} · เวลานี้เป็นเวลาสร้างรอบเรียน`] })
    }
    if (['walleted', 'rescheduled'].includes(session.status) && !removalEvidence.has(session.id)) {
      events.push({ occurredAt: session.updated_at, type: 'unknown', label: LEGACY_EVIDENCE_WARNING, actorName: null,
        learnerNames: names([session.id]), reason: LEGACY_EVIDENCE_GAP, sortId: session.id, businessKey: `unknown:${session.id}` })
    }
  }
  const sorted = deduplicateMeaningfulHistoryEvents(events)
  const before = input.before
  const remaining = before ? sorted.filter(e => historyCursor(e).localeCompare(before) < 0) : sorted
  const page = remaining.slice(0, ASSIGNMENT_HISTORY_LIMIT)
  return { events: page.map(publicEvent), nextCursor: remaining.length > page.length ? historyCursor(page[page.length - 1]) : null }
}
