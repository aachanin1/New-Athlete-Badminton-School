export interface ExactCoachAssignmentGroup {
  schedule_slot_id?: string | null
  coach_id?: string | null
  coach_assignment_group_students?: {
    booking_session_id?: string | null
  }[] | null
}

export interface CoachAssignmentSessionProvenanceRow {
  id: string
  rescheduled_from_id?: string | null
  is_makeup?: boolean | null
}

export type CoachAssignmentSessionProvenance =
  | 'normal'
  | 'user_reschedule'
  | 'lesson_wallet'
  | 'admin_makeup'

interface QueryErrorLike {
  message: string
}

interface QueryResult<T> {
  data: T | null
  error?: QueryErrorLike | null
}

type WalletProvenanceQuery = PromiseLike<QueryResult<{ redeemed_session_id: string | null }[]>> & {
  in: (column: string, values: readonly string[]) => WalletProvenanceQuery
}

type WalletProvenanceSupabase = {
  from: (table: string) => {
    select: (columns: string) => WalletProvenanceQuery
  }
}

const WALLET_PROVENANCE_BATCH_SIZE = 100

export class CoachAssignmentDataUnavailableError extends Error {
  readonly code = 'COACH_ASSIGNMENT_DATA_UNAVAILABLE'

  constructor(context: string, causeMessage: string) {
    super(`${context}: ${causeMessage}`)
    this.name = 'CoachAssignmentDataUnavailableError'
  }
}

export function requireCoachAssignmentQueryData<T>(
  result: QueryResult<T>,
  context: string,
) {
  if (result.error) {
    throw new CoachAssignmentDataUnavailableError(context, result.error.message)
  }

  return result.data
}

export function slotUsesExactAssignmentModel(groups: readonly ExactCoachAssignmentGroup[]) {
  return groups.length > 0
}

export function coachHasExactSlotMembership(
  groups: readonly ExactCoachAssignmentGroup[],
  coachId: string,
) {
  return groups.some((group) => (
    group.coach_id === coachId
    && (group.coach_assignment_group_students || []).some((member) => Boolean(member.booking_session_id))
  ))
}

export function coachHasExactLearnerMembership(
  groups: readonly ExactCoachAssignmentGroup[],
  coachId: string,
  bookingSessionId: string,
) {
  return groups.some((group) => (
    group.coach_id === coachId
    && (group.coach_assignment_group_students || []).some(
      (member) => member.booking_session_id === bookingSessionId,
    )
  ))
}

export function classifyCoachAssignmentSessionProvenance(
  session: CoachAssignmentSessionProvenanceRow,
  walletRedeemedSessionIds: ReadonlySet<string>,
): CoachAssignmentSessionProvenance {
  if (session.is_makeup) return 'admin_makeup'
  if (walletRedeemedSessionIds.has(session.id)) return 'lesson_wallet'
  if (session.rescheduled_from_id) return 'user_reschedule'
  return 'normal'
}

export function isPendingUserRescheduleIn(input: {
  session: CoachAssignmentSessionProvenanceRow
  walletRedeemedSessionIds: ReadonlySet<string>
  hasExactMembership: boolean
}) {
  return !input.hasExactMembership
    && classifyCoachAssignmentSessionProvenance(
      input.session,
      input.walletRedeemedSessionIds,
    ) === 'user_reschedule'
}

export function getLegacyEligibleSessions<T extends CoachAssignmentSessionProvenanceRow>(
  sessions: readonly T[],
  walletRedeemedSessionIds: ReadonlySet<string>,
) {
  return sessions.filter((session) => !isPendingUserRescheduleIn({
    session,
    walletRedeemedSessionIds,
    hasExactMembership: false,
  }))
}

export async function loadWalletRedeemedSessionIds(
  supabaseClient: unknown,
  sessions: readonly CoachAssignmentSessionProvenanceRow[],
  context: string,
) {
  const candidateIds = Array.from(new Set(
    sessions
      .filter((session) => Boolean(session.rescheduled_from_id) && !session.is_makeup)
      .map((session) => session.id),
  ))
  if (candidateIds.length === 0) return new Set<string>()

  const supabase = supabaseClient as WalletProvenanceSupabase
  const results = await Promise.all(
    Array.from(
      { length: Math.ceil(candidateIds.length / WALLET_PROVENANCE_BATCH_SIZE) },
      (_, index) => candidateIds.slice(
        index * WALLET_PROVENANCE_BATCH_SIZE,
        (index + 1) * WALLET_PROVENANCE_BATCH_SIZE,
      ),
    ).map((batchIds) => supabase
      .from('lesson_wallet_credits')
      .select('redeemed_session_id')
      .in('redeemed_session_id', batchIds)),
  )
  const rows = results.flatMap((result, index) => (
    requireCoachAssignmentQueryData(
      result,
      `${context} wallet provenance query batch ${index + 1} failed`,
    ) || []
  ))

  return new Set(
    rows
      .map((row) => row.redeemed_session_id)
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  )
}

export function resolveCoachSlotAccess(input: {
  exactGroups: readonly ExactCoachAssignmentGroup[]
  coachId: string
  hasLegacyAssignment: boolean
  legacyEligibleLearnerCount: number
}) {
  if (slotUsesExactAssignmentModel(input.exactGroups)) {
    return {
      allowed: coachHasExactSlotMembership(input.exactGroups, input.coachId),
      source: 'exact' as const,
    }
  }

  return {
    allowed: input.hasLegacyAssignment && input.legacyEligibleLearnerCount > 0,
    source: 'legacy' as const,
  }
}

export function resolveCoachLearnerAccess(input: {
  exactGroups: readonly ExactCoachAssignmentGroup[]
  coachId: string
  bookingSessionId: string
  hasLegacyAssignment: boolean
  sessionProvenance: CoachAssignmentSessionProvenance
}) {
  if (slotUsesExactAssignmentModel(input.exactGroups)) {
    return {
      allowed: coachHasExactLearnerMembership(
        input.exactGroups,
        input.coachId,
        input.bookingSessionId,
      ),
      source: 'exact' as const,
    }
  }

  return {
    allowed: input.hasLegacyAssignment && input.sessionProvenance !== 'user_reschedule',
    source: 'legacy' as const,
  }
}

export function resolveAssignedCoachIds(input: {
  exactGroups: readonly ExactCoachAssignmentGroup[]
  bookingSessionId: string
  legacyCoachIds: readonly string[]
  sessionProvenance: CoachAssignmentSessionProvenance
}) {
  if (slotUsesExactAssignmentModel(input.exactGroups)) {
    return Array.from(new Set(
      input.exactGroups
        .filter((group) => (group.coach_assignment_group_students || []).some(
          (member) => member.booking_session_id === input.bookingSessionId,
        ))
        .map((group) => group.coach_id)
        .filter((coachId): coachId is string => Boolean(coachId)),
    ))
  }

  if (input.sessionProvenance === 'user_reschedule') return []
  return Array.from(new Set(input.legacyCoachIds.filter(Boolean)))
}

export function getExactModelSlotIds(groups: readonly ExactCoachAssignmentGroup[]) {
  return new Set(
    groups
      .map((group) => group.schedule_slot_id)
      .filter((slotId): slotId is string => Boolean(slotId)),
  )
}

export function getGenuineLegacyOnlySlotIds(
  legacySlotIds: readonly string[],
  exactGroups: readonly ExactCoachAssignmentGroup[],
) {
  const exactModelSlotIds = getExactModelSlotIds(exactGroups)
  return Array.from(new Set(legacySlotIds.filter((slotId) => !exactModelSlotIds.has(slotId))))
}
