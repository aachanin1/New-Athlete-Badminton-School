export const COACH_ASSIGNMENT_ELIGIBLE_SESSION_STATUSES = [
  'scheduled',
  'completed',
  'absent',
] as const

export interface AssignmentGroupComparisonShape {
  name: string
  coachId: string | null
  levelMin: number | null
  levelMax: number | null
  studentSessionIds: readonly string[]
}

export interface CanonicalAssignmentGroup extends AssignmentGroupComparisonShape {
  id: string
  sortOrder: number
}

export function normalizeAssignmentGroupsForComparison(
  groups: readonly AssignmentGroupComparisonShape[],
) {
  return groups
    .filter((group) => group.studentSessionIds.length > 0)
    .map((group) => ({
      name: group.name.trim(),
      coachId: group.coachId || null,
      levelMin: group.levelMin,
      levelMax: group.levelMax,
      studentSessionIds: Array.from(new Set(group.studentSessionIds)).sort(),
    }))
    .sort((a, b) => {
      const aKey = `${a.name}:${a.coachId || ''}:${a.studentSessionIds.join(',')}`
      const bKey = `${b.name}:${b.coachId || ''}:${b.studentSessionIds.join(',')}`
      return aKey.localeCompare(bKey)
    })
}

export function getAssignmentGroupsSignature(
  groups: readonly AssignmentGroupComparisonShape[],
) {
  return JSON.stringify(normalizeAssignmentGroupsForComparison(groups))
}

export function reconcileAssignmentDraft<T extends AssignmentGroupComparisonShape>(input: {
  currentDraft: readonly T[]
  previousServerDerivedDraft: readonly T[]
  nextServerDerivedDraft: readonly T[]
  previousPersistedGroups: readonly AssignmentGroupComparisonShape[]
  nextPersistedGroups: readonly AssignmentGroupComparisonShape[]
}) {
  const currentDraftSignature = getAssignmentGroupsSignature(input.currentDraft)
  const previousDraftSignature = getAssignmentGroupsSignature(input.previousServerDerivedDraft)
  const previousServerSignature = getAssignmentGroupsSignature(input.previousPersistedGroups)
  const nextServerSignature = getAssignmentGroupsSignature(input.nextPersistedGroups)
  const userEdited = currentDraftSignature !== previousDraftSignature
  const serverChanged = previousServerSignature !== nextServerSignature

  if (!userEdited) {
    return {
      draft: [...input.nextServerDerivedDraft],
      baseline: [...input.nextServerDerivedDraft],
      userEdited: false,
      serverChanged,
      needsRefreshReview: false,
    }
  }

  return {
    draft: [...input.currentDraft],
    baseline: [...input.previousServerDerivedDraft],
    userEdited: true,
    serverChanged,
    needsRefreshReview: serverChanged,
  }
}

interface DatabaseCanonicalGroup {
  id?: unknown
  name?: unknown
  coach_id?: unknown
  level_min?: unknown
  level_max?: unknown
  sort_order?: unknown
  student_session_ids?: unknown
}

export function parseCanonicalAssignmentGroups(value: unknown): CanonicalAssignmentGroup[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const group = item as DatabaseCanonicalGroup
    if (typeof group.id !== 'string' || typeof group.name !== 'string') return []
    const sessionIds = Array.isArray(group.student_session_ids)
      ? group.student_session_ids.filter((id): id is string => typeof id === 'string')
      : []

    return [{
      id: group.id,
      name: group.name,
      coachId: typeof group.coach_id === 'string' ? group.coach_id : null,
      levelMin: typeof group.level_min === 'number' ? group.level_min : null,
      levelMax: typeof group.level_max === 'number' ? group.level_max : null,
      sortOrder: typeof group.sort_order === 'number' ? group.sort_order : 0,
      studentSessionIds: sessionIds,
    }]
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}
