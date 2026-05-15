import type { User } from '@supabase/supabase-js'

import type { StudentType, UserRole } from '@/types/database'

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  neq: (column: string, value: unknown) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
  single: () => PromiseLike<unknown>
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

const BOOKING_VISIBLE_STATUSES = ['pending_payment', 'paid', 'verified']
const STAFF_ALL_ACCESS_ROLES: UserRole[] = ['admin', 'super_admin']
const COACH_ROLES: UserRole[] = ['coach', 'head_coach']

interface CoachProfileRow {
  role: UserRole | null
}

interface CoachBranchRow {
  branch_id: string
  branches?: { name: string | null } | null
}

interface CoachAssignmentRow {
  schedule_slot_id: string | null
}

interface AssignmentGroupStudentRow {
  booking_session_id: string
  coach_assignment_groups?: {
    coach_id: string | null
    schedule_slot_id: string
  } | null
}

interface VisibleSessionRow {
  id: string
  date: string
  child_id: string | null
  branch_id: string | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
    profiles?: {
      id?: string
      full_name: string | null
    } | null
  } | null
  children?: {
    id: string
    full_name: string
    nickname: string | null
  } | null
}

export interface CoachVisibleStudent {
  id: string
  name: string
  type: StudentType
  parentName: string | null
  branchName: string | null
  sessionCount: number
  lastSessionDate: string | null
  source: 'assignment_group' | 'assigned_slot' | 'head_coach_branch'
}

function getStudentKey(type: StudentType, id: string) {
  return `${type}:${id}`
}

function isStaffAllAccess(role: UserRole | null | undefined) {
  return Boolean(role && STAFF_ALL_ACCESS_ROLES.includes(role))
}

function isCoachRole(role: UserRole | null | undefined) {
  return Boolean(role && COACH_ROLES.includes(role))
}

export async function getCoachRole(supabaseClient: unknown, userId: string): Promise<UserRole | null> {
  const supabase = supabaseClient as SupabaseLike
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single() as { data: CoachProfileRow | null }

  return data?.role || null
}

async function getCoachBranches(supabase: SupabaseLike, userId: string) {
  const { data } = await supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', userId) as { data: CoachBranchRow[] | null }

  const branchMap = new Map<string, string>()
  ;(data || []).forEach((row) => {
    if (row.branch_id) branchMap.set(row.branch_id, row.branches?.name || '')
  })

  return {
    branchIds: Array.from(branchMap.keys()),
    branchMap,
  }
}

async function getAssignedSlotIds(supabase: SupabaseLike, userId: string) {
  const { data } = await supabase
    .from('coach_assignments')
    .select('schedule_slot_id')
    .eq('coach_id', userId) as { data: CoachAssignmentRow[] | null }

  return Array.from(new Set((data || []).map((row) => row.schedule_slot_id).filter(Boolean))) as string[]
}

async function getAssignedGroupSessionIds(supabase: SupabaseLike, userId: string) {
  const { data } = await supabase
    .from('coach_assignment_group_students')
    .select(`
      booking_session_id,
      coach_assignment_groups!inner(coach_id, schedule_slot_id)
    `)
    .eq('coach_assignment_groups.coach_id', userId) as { data: AssignmentGroupStudentRow[] | null }

  return Array.from(new Set((data || []).map((row) => row.booking_session_id).filter(Boolean)))
}

async function getGroupedSlotIds(supabase: SupabaseLike, slotIds: string[]) {
  if (slotIds.length === 0) return new Set<string>()

  const { data } = await supabase
    .from('coach_assignment_groups')
    .select('schedule_slot_id')
    .in('schedule_slot_id', slotIds) as { data: { schedule_slot_id: string }[] | null }

  return new Set((data || []).map((row) => row.schedule_slot_id))
}

async function getSessionsByIds(supabase: SupabaseLike, sessionIds: string[]) {
  if (sessionIds.length === 0) return []

  const { data } = await supabase
    .from('booking_sessions')
    .select(`
      id, date, child_id, branch_id, schedule_slot_id,
      bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(id, full_name)),
      children(id, full_name, nickname)
    `)
    .in('id', sessionIds)
    .neq('status', 'rescheduled')
    .in('bookings.status', BOOKING_VISIBLE_STATUSES)
    .order('date', { ascending: false }) as { data: VisibleSessionRow[] | null }

  return data || []
}

async function getSessionsBySlots(supabase: SupabaseLike, slotIds: string[]) {
  if (slotIds.length === 0) return []

  const { data } = await supabase
    .from('booking_sessions')
    .select(`
      id, date, child_id, branch_id, schedule_slot_id,
      bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(id, full_name)),
      children(id, full_name, nickname)
    `)
    .in('schedule_slot_id', slotIds)
    .neq('status', 'rescheduled')
    .in('bookings.status', BOOKING_VISIBLE_STATUSES)
    .order('date', { ascending: false }) as { data: VisibleSessionRow[] | null }

  return data || []
}

async function getSessionsByBranches(supabase: SupabaseLike, branchIds: string[]) {
  if (branchIds.length === 0) return []

  const { data } = await supabase
    .from('booking_sessions')
    .select(`
      id, date, child_id, branch_id, schedule_slot_id,
      bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(id, full_name)),
      children(id, full_name, nickname)
    `)
    .in('branch_id', branchIds)
    .neq('status', 'rescheduled')
    .in('bookings.status', BOOKING_VISIBLE_STATUSES)
    .order('date', { ascending: false }) as { data: VisibleSessionRow[] | null }

  return data || []
}

async function getVisibleSessionRows(
  supabase: SupabaseLike,
  userId: string,
  role: UserRole,
  branchIds: string[],
) {
  const groupSessionIds = await getAssignedGroupSessionIds(supabase, userId)

  if (groupSessionIds.length > 0) {
    return {
      rows: await getSessionsByIds(supabase, groupSessionIds),
      source: 'assignment_group' as const,
    }
  }

  const assignedSlotIds = await getAssignedSlotIds(supabase, userId)
  if (assignedSlotIds.length > 0) {
    const groupedSlotIds = await getGroupedSlotIds(supabase, assignedSlotIds)
    const fallbackSlotIds = assignedSlotIds.filter((slotId) => !groupedSlotIds.has(slotId))

    return {
      rows: await getSessionsBySlots(supabase, fallbackSlotIds),
      source: 'assigned_slot' as const,
    }
  }

  if ((role === 'head_coach' || role === 'super_admin') && branchIds.length > 0) {
    return {
      rows: await getSessionsByBranches(supabase, branchIds),
      source: 'head_coach_branch' as const,
    }
  }

  return {
    rows: [],
    source: 'assigned_slot' as const,
  }
}

export async function getCoachVisibleStudents(
  supabaseClient: unknown,
  user: Pick<User, 'id'>,
): Promise<CoachVisibleStudent[]> {
  const supabase = supabaseClient as SupabaseLike
  const role = await getCoachRole(supabase, user.id)
  if (!role || (!isCoachRole(role) && !isStaffAllAccess(role))) return []

  const { branchIds, branchMap } = await getCoachBranches(supabase, user.id)
  const { rows, source } = await getVisibleSessionRows(supabase, user.id, role, branchIds)
  const students = new Map<string, CoachVisibleStudent>()

  for (const session of rows) {
    const branchName = session.branch_id ? branchMap.get(session.branch_id) || null : null

    if (session.child_id && session.children) {
      const key = getStudentKey('child', session.children.id)
      const current = students.get(key)
      const name = session.children.nickname
        ? `${session.children.full_name} (${session.children.nickname})`
        : session.children.full_name

      students.set(key, {
        id: session.children.id,
        name,
        type: 'child',
        parentName: session.bookings?.profiles?.full_name || null,
        branchName: current?.branchName || branchName,
        sessionCount: (current?.sessionCount || 0) + 1,
        lastSessionDate: current?.lastSessionDate || session.date,
        source,
      })
      continue
    }

    if (session.bookings?.user_id && session.bookings.learner_type === 'self') {
      const key = getStudentKey('adult', session.bookings.user_id)
      const current = students.get(key)
      students.set(key, {
        id: session.bookings.user_id,
        name: session.bookings.profiles?.full_name || 'นักเรียนผู้ใหญ่',
        type: 'adult',
        parentName: null,
        branchName: current?.branchName || branchName,
        sessionCount: (current?.sessionCount || 0) + 1,
        lastSessionDate: current?.lastSessionDate || session.date,
        source,
      })
    }
  }

  return Array.from(students.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export async function canManageStudentForCoach(
  supabaseClient: unknown,
  userId: string,
  studentId: string,
  studentType: StudentType,
) {
  const supabase = supabaseClient as SupabaseLike
  const role = await getCoachRole(supabase, userId)
  if (!role) return false
  if (isStaffAllAccess(role)) return true

  const visibleStudents = await getCoachVisibleStudents(supabase, { id: userId })
  return visibleStudents.some((student) => student.id === studentId && student.type === studentType)
}
