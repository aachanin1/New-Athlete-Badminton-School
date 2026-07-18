import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  resolveAssignmentGroupName,
  stripDynamicMemberCount,
  UNGROUPED_ASSIGNMENT_NAME,
} from '@/lib/coach-assignment-group-naming'
import { loadAssignmentGroupNamingStudents } from '@/lib/coach-assignment-group-naming-server'

type ServiceRoleClient = ReturnType<typeof getServiceRoleClient>

interface AtomicAssignmentGroupRow {
  id: string
  name: string
  coach_id: string | null
  level_min: number | null
  level_max: number | null
  sort_order: number
  coach_assignment_group_students?: { booking_session_id: string }[] | null
}

export interface AtomicAssignmentGroupDraft {
  persistedId?: string
  name: string
  coachId: string | null
  levelMin: number | null
  levelMax: number | null
  sortOrder: number
  studentSessionIds: string[]
}

export interface AtomicAssignmentSaveResultGroup {
  id: string
  sort_order: number
  coach_id: string | null
}

export async function loadAtomicAssignmentGroups(
  supabase: ServiceRoleClient,
  scheduleSlotId: string,
) {
  const { data, error } = await supabase
    .from('coach_assignment_groups')
    .select(`
      id, name, coach_id, level_min, level_max, sort_order,
      coach_assignment_group_students(booking_session_id)
    `)
    .eq('schedule_slot_id', scheduleSlotId)
    .order('sort_order') as unknown as {
      data: AtomicAssignmentGroupRow[] | null
      error: { message: string } | null
    }

  if (error) throw new Error(error.message)

  return (data || []).map((group) => ({
    persistedId: group.id,
    name: group.name || '',
    coachId: group.coach_id,
    levelMin: group.level_min,
    levelMax: group.level_max,
    sortOrder: group.sort_order,
    studentSessionIds: Array.from(new Set(
      (group.coach_assignment_group_students || []).map((student) => student.booking_session_id),
    )),
  })) satisfies AtomicAssignmentGroupDraft[]
}

async function normalizeAtomicAssignmentGroups(
  supabase: ServiceRoleClient,
  groups: AtomicAssignmentGroupDraft[],
) {
  const sessionIds = Array.from(new Set(groups.flatMap((group) => group.studentSessionIds)))
  const namingStudentsBySessionId = await loadAssignmentGroupNamingStudents(supabase, sessionIds)

  return groups.map((group, index) => {
    const students = group.studentSessionIds
      .map((sessionId) => namingStudentsBySessionId.get(sessionId))
      .filter((student): student is NonNullable<typeof student> => Boolean(student))
    const resolvedName = resolveAssignmentGroupName({ currentName: group.name, students })
    const unassignedName = stripDynamicMemberCount(group.name) || UNGROUPED_ASSIGNMENT_NAME

    return {
      ...group,
      name: group.coachId ? (resolvedName.name || unassignedName) : unassignedName,
      levelMin: resolvedName.autoNamed ? resolvedName.levelMin : group.levelMin,
      levelMax: resolvedName.autoNamed ? resolvedName.levelMax : group.levelMax,
      sortOrder: index,
      studentSessionIds: Array.from(new Set(group.studentSessionIds)),
    }
  })
}

export async function saveAtomicAssignmentGroups({
  supabase,
  scheduleSlotId,
  actorId,
  groups,
}: {
  supabase: ServiceRoleClient
  scheduleSlotId: string
  actorId: string
  groups: AtomicAssignmentGroupDraft[]
}) {
  if (groups.length === 0) throw new Error('ต้องมีอย่างน้อย 1 กลุ่ม')

  const normalizedGroups = await normalizeAtomicAssignmentGroups(supabase, groups)
  const coachIds = normalizedGroups.map((group) => group.coachId).filter((coachId): coachId is string => Boolean(coachId))
  if (new Set(coachIds).size !== coachIds.length) {
    throw new Error('โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้')
  }

  const { data, error } = await supabase.rpc('save_coach_assignment_groups_v1', {
    p_schedule_slot_id: scheduleSlotId,
    p_actor_id: actorId,
    p_groups: normalizedGroups,
  }) as unknown as {
    data: { groups?: AtomicAssignmentSaveResultGroup[] } | null
    error: { message: string } | null
  }

  if (error) throw new Error(error.message)
  const savedGroups = data?.groups || []
  if (savedGroups.length !== normalizedGroups.length) {
    throw new Error('ผลการบันทึกกลุ่มแบบ atomic ไม่ครบตามจำนวนที่ส่ง')
  }

  return {
    groups: savedGroups,
    submittedGroups: normalizedGroups,
  }
}

export async function mutateAtomicAssignmentGroups({
  supabase,
  scheduleSlotId,
  actorId,
  mutate,
}: {
  supabase: ServiceRoleClient
  scheduleSlotId: string
  actorId: string
  mutate: (groups: AtomicAssignmentGroupDraft[]) => AtomicAssignmentGroupDraft[]
}) {
  const currentGroups = await loadAtomicAssignmentGroups(supabase, scheduleSlotId)
  return saveAtomicAssignmentGroups({
    supabase,
    scheduleSlotId,
    actorId,
    groups: mutate(currentGroups.map((group) => ({ ...group, studentSessionIds: [...group.studentSessionIds] }))),
  })
}
