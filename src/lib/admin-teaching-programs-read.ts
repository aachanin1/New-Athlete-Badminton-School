import type { SupabaseClient } from '@supabase/supabase-js'

import type { ProgramStatus } from '@/types/database'

export const ADMIN_TEACHING_PROGRAM_RESULT_CAP = 800

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type Relation<T> = T | T[] | null

interface ProfileRelation {
  id: string
  full_name: string | null
  email: string | null
  avatar_url?: string | null
}

interface BranchRelation {
  id: string
  name: string | null
  slug: string | null
}

interface CourseRelation {
  name: string | null
}

interface SlotRelation {
  id: string
  date: string
  start_time: string
  end_time: string
  branches: Relation<BranchRelation>
  course_types: Relation<CourseRelation>
}

interface ProgramReadRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  program_content: string
  status: ProgramStatus
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  coach: Relation<ProfileRelation>
  reviewer: Relation<ProfileRelation>
  slot: Relation<SlotRelation>
}

export interface AdminTeachingProgramReviewItem {
  id: string
  coach_id: string
  coach_name: string
  coach_email: string
  coach_avatar_url: string | null
  schedule_slot_id: string
  branch_name: string
  branch_slug: string | null
  course_type: string
  date: string
  start_time: string
  end_time: string
  program_content: string
  status: ProgramStatus
  reviewed_by_name: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AdminTeachingProgramDateRange {
  from: string
  to: string
}

export type AdminTeachingProgramDateRangeResult =
  | { ok: true; range: AdminTeachingProgramDateRange }
  | { ok: false; error: string }

export interface AdminTeachingProgramsReadResult {
  ok: boolean
  programs: AdminTeachingProgramReviewItem[]
  totalCount: number
  isTruncated: boolean
  error: string | null
}

function firstRelation<T>(value: Relation<T>) {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

export function isValidAdminTeachingProgramDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export function getAdminTeachingProgramMonthRange(bangkokDate: string): AdminTeachingProgramDateRange {
  if (!isValidAdminTeachingProgramDate(bangkokDate)) {
    throw new Error('Invalid Bangkok date for teaching-program month range')
  }
  const [year, month] = bangkokDate.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function resolveAdminTeachingProgramDateRange({
  from,
  to,
  bangkokToday,
}: {
  from?: string
  to?: string
  bangkokToday: string
}): AdminTeachingProgramDateRangeResult {
  const normalizedFrom = from?.trim() || ''
  const normalizedTo = to?.trim() || ''

  if (!normalizedFrom && !normalizedTo) {
    return { ok: true, range: getAdminTeachingProgramMonthRange(bangkokToday) }
  }
  if (!isValidAdminTeachingProgramDate(normalizedFrom) || !isValidAdminTeachingProgramDate(normalizedTo)) {
    return { ok: false, error: 'กรุณาระบุวันที่เริ่มและวันที่สิ้นสุดให้ถูกต้อง' }
  }
  if (normalizedFrom > normalizedTo) {
    return { ok: false, error: 'วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด' }
  }

  return { ok: true, range: { from: normalizedFrom, to: normalizedTo } }
}

export async function readAdminTeachingProgramsForRange(
  supabase: SupabaseClient,
  range: AdminTeachingProgramDateRange,
): Promise<AdminTeachingProgramsReadResult> {
  const result = await supabase
    .from('teaching_programs')
    .select(`
      id, coach_id, schedule_slot_id, program_content, status,
      reviewed_by, reviewed_at, notes, created_at, updated_at,
      coach:profiles!teaching_programs_coach_id_fkey(id, full_name, email, avatar_url),
      reviewer:profiles!teaching_programs_reviewed_by_fkey(id, full_name, email),
      slot:schedule_slots!inner(
        id, date, start_time, end_time,
        branches(id, name, slug),
        course_types(name)
      )
    `, { count: 'exact' })
    .gte('slot.date', range.from)
    .lte('slot.date', range.to)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, ADMIN_TEACHING_PROGRAM_RESULT_CAP)

  if (result.error) {
    console.error('Admin teaching-program review read failed', { code: result.error.code || 'unknown' })
    return {
      ok: false,
      programs: [],
      totalCount: 0,
      isTruncated: false,
      error: 'ไม่สามารถโหลดรายการโปรแกรมสอนได้ กรุณาลองใหม่อีกครั้ง',
    }
  }

  const rows = (result.data || []) as unknown as ProgramReadRow[]
  const totalCount = result.count || rows.length
  const isTruncated = totalCount > ADMIN_TEACHING_PROGRAM_RESULT_CAP
  const programs = rows.slice(0, ADMIN_TEACHING_PROGRAM_RESULT_CAP).map((program) => {
    const coach = firstRelation(program.coach)
    const reviewer = firstRelation(program.reviewer)
    const slot = firstRelation(program.slot)
    const branch = firstRelation(slot?.branches || null)
    const course = firstRelation(slot?.course_types || null)

    return {
      id: program.id,
      coach_id: program.coach_id,
      coach_name: coach?.full_name || coach?.email || 'ไม่ทราบชื่อโค้ช',
      coach_email: coach?.email || '-',
      coach_avatar_url: coach?.avatar_url || null,
      schedule_slot_id: program.schedule_slot_id,
      branch_name: branch?.name || 'ไม่ทราบสาขา',
      branch_slug: branch?.slug || null,
      course_type: course?.name || '-',
      date: slot?.date || '',
      start_time: slot?.start_time || '',
      end_time: slot?.end_time || '',
      program_content: program.program_content,
      status: program.status,
      reviewed_by_name: reviewer?.full_name || reviewer?.email || null,
      reviewed_at: program.reviewed_at,
      notes: program.notes,
      created_at: program.created_at,
      updated_at: program.updated_at,
    }
  })

  return { ok: true, programs, totalCount, isTruncated, error: null }
}
