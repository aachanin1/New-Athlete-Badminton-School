import { redirect } from 'next/navigation'

import { TeachingProgramsClient, type TeachingProgramReviewItem } from '@/components/admin/teaching-programs-client'
import { requireAdminMenuAccess } from '@/lib/auth/admin'
import type { ProgramStatus } from '@/types/database'

interface ProgramRow {
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
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

interface SlotRow {
  id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | { name: string | null }[] | null
  course_types?: { name: string | null } | { name: string | null }[] | null
}

function firstRelationName(value: SlotRow['branches']) {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.name || null
  return value.name || null
}

export default async function AdminTeachingProgramsPage() {
  const access = await requireAdminMenuAccess('teaching_programs')

  if (!access.ok) {
    redirect(access.status === 401 ? '/auth/login' : '/admin')
  }

  const { supabase } = access.ctx

  const { data: programs } = await supabase
    .from('teaching_programs')
    .select('id, coach_id, schedule_slot_id, program_content, status, reviewed_by, reviewed_at, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(800) as unknown as { data: ProgramRow[] | null }

  const programRows = programs || []
  const coachIds = Array.from(new Set(programRows.map((program) => program.coach_id).filter(Boolean)))
  const reviewerIds = Array.from(new Set(programRows.map((program) => program.reviewed_by).filter(Boolean) as string[]))
  const profileIds = Array.from(new Set([...coachIds, ...reviewerIds]))
  const slotIds = Array.from(new Set(programRows.map((program) => program.schedule_slot_id).filter(Boolean)))

  const [{ data: profiles }, { data: slots }] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', profileIds) as unknown as PromiseLike<{ data: ProfileRow[] | null }>
      : Promise.resolve({ data: [] as ProfileRow[] }),
    slotIds.length > 0
      ? supabase
          .from('schedule_slots')
          .select('id, date, start_time, end_time, branches(name), course_types(name)')
          .in('id', slotIds) as unknown as PromiseLike<{ data: SlotRow[] | null }>
      : Promise.resolve({ data: [] as SlotRow[] }),
  ])

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
  const slotMap = new Map((slots || []).map((slot) => [slot.id, slot]))

  const reviewItems: TeachingProgramReviewItem[] = programRows.map((program) => {
    const coach = profileMap.get(program.coach_id)
    const reviewer = program.reviewed_by ? profileMap.get(program.reviewed_by) : null
    const slot = slotMap.get(program.schedule_slot_id)

    return {
      id: program.id,
      coach_id: program.coach_id,
      coach_name: coach?.full_name || coach?.email || 'ไม่ทราบชื่อโค้ช',
      coach_email: coach?.email || '-',
      coach_avatar_url: coach?.avatar_url || null,
      schedule_slot_id: program.schedule_slot_id,
      branch_name: firstRelationName(slot?.branches) || 'ไม่ทราบสาขา',
      course_type: firstRelationName(slot?.course_types) || '-',
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

  return <TeachingProgramsClient programs={reviewItems} />
}
