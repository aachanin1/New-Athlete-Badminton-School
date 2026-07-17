export interface AdminScheduleLearnerAssignmentRow {
  id: string
  status: string
}

export interface AdminScheduleCoachAssignmentEvidence {
  name?: string | null
  coach_id: string | null
  coach_profile_id: string | null
  coach_name: string | null
  coach_role: string | null
}

export interface AdminScheduleAssignmentGroup<TLearner extends AdminScheduleLearnerAssignmentRow>
  extends AdminScheduleCoachAssignmentEvidence {
  learners: TLearner[]
}

export function hasExactValidCoachAssignment(
  group: AdminScheduleCoachAssignmentEvidence,
) {
  return Boolean(
    group.name?.trim() !== 'ยังไม่จัดกลุ่ม'
    && group.coach_id
    && group.coach_profile_id === group.coach_id
    && group.coach_name?.trim()
    && (group.coach_role === 'coach' || group.coach_role === 'head_coach'),
  )
}

export function getAdminScheduleRoundLearnerBuckets<
  TLearner extends AdminScheduleLearnerAssignmentRow,
  TGroup extends AdminScheduleAssignmentGroup<TLearner>,
>(round: { groups: TGroup[]; unassigned_learners: TLearner[] }) {
  const assignedGroups: TGroup[] = []
  const unassignedGroups: TGroup[] = []
  const walletedLearners: TLearner[] = []

  round.groups.forEach((group) => {
    const activeLearners = group.learners.filter((learner) => {
      if (learner.status !== 'walleted') return true
      walletedLearners.push(learner)
      return false
    })

    if (activeLearners.length === 0) return

    const activeGroup = { ...group, learners: activeLearners }
    if (hasExactValidCoachAssignment(activeGroup)) {
      assignedGroups.push(activeGroup)
    } else {
      unassignedGroups.push(activeGroup)
    }
  })

  const unassignedLearners = round.unassigned_learners.filter((learner) => {
    if (learner.status !== 'walleted') return true
    walletedLearners.push(learner)
    return false
  })

  const coachedLearnerCount = assignedGroups.reduce(
    (sum, group) => sum + group.learners.length,
    0,
  )
  const groupedWaitingCoachCount = unassignedGroups.reduce(
    (sum, group) => sum + group.learners.length,
    0,
  )

  return {
    assignedGroups,
    unassignedGroups,
    unassignedLearners,
    walletedLearners,
    coachedLearnerCount,
    waitingCoachCount: groupedWaitingCoachCount + unassignedLearners.length,
  }
}
