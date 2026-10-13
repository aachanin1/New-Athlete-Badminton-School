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

export function getAssignmentCoverage(sessionIds: readonly string[], groups: readonly AssignmentGroupComparisonShape[], validCoachIds?: ReadonlySet<string>) {
  const active = new Set(sessionIds), coached = new Set<string>()
  let waitingGroups = 0
  for (const group of groups) {
    const members = group.studentSessionIds.filter(id => active.has(id))
    if (!members.length) continue
    if (group.name !== 'ยังไม่จัดกลุ่ม' && group.coachId && (!validCoachIds || validCoachIds.has(group.coachId))) members.forEach(id => coached.add(id))
    else waitingGroups += 1
  }
  return { total: active.size, coached: coached.size, waiting: active.size - coached.size, waitingGroups }
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

// Persisted concurrency evidence includes empty groups and inactive memberships.
// Draft/coverage comparisons above intentionally describe the visible roster.
export function getPersistedAssignmentGroupsSignature(groups: readonly AssignmentGroupComparisonShape[]) {
  const normalized = groups.map(group => ({
    name: group.name.trim(), coachId: group.coachId || null,
    levelMin: group.levelMin, levelMax: group.levelMax,
    studentSessionIds: [...group.studentSessionIds].sort(),
  }))
  normalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return JSON.stringify(normalized)
}

export function projectActiveAssignmentGroups<T extends AssignmentGroupComparisonShape>(groups: readonly T[], sessionIds: readonly string[]) {
  const active = new Set(sessionIds)
  return groups.map(group => ({ ...group, studentSessionIds: group.studentSessionIds.filter(id => active.has(id)) }))
    .filter(group => group.studentSessionIds.length > 0)
}

export function getAssignmentRosterSignature(sessionIds: readonly string[]) {
  return JSON.stringify([...sessionIds].sort())
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
  const previousServerSignature = getPersistedAssignmentGroupsSignature(input.previousPersistedGroups)
  const nextServerSignature = getPersistedAssignmentGroupsSignature(input.nextPersistedGroups)
  const userEdited = currentDraftSignature !== previousDraftSignature
  const serverChanged = previousServerSignature !== nextServerSignature
    || previousDraftSignature !== getAssignmentGroupsSignature(input.nextServerDerivedDraft)

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
