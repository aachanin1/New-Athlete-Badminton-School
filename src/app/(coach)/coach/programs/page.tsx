import { ProgramsClient } from '@/components/coach/programs-client'
import { createClient } from '@/lib/supabase/server'
import type { ProgramStatus } from '@/types/database'

interface TeachingProgramRow {
  id: string
  schedule_slot_id: string | null
  program_content: string
  status: ProgramStatus
  reviewed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  schedule_slots?: {
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface ReviewerRow {
  id: string
  full_name: string | null
}

interface AssignedSlotRow {
  id: string
  name: string
  schedule_slot_id: string
  schedule_slots?: {
    id: string
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface ProgramTemplateRow {
  id: string
  title: string
  content: string
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function formatSlotLabel(program: TeachingProgramRow) {
  const slot = program.schedule_slots
  if (!slot) return null
  const dateLabel = new Date(`${slot.date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
  return `${dateLabel} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)} · ${slot.branches?.name || '-'} · ${slot.course_types?.name || '-'}`
}

export default async function ProgramsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: programs } = await supabase
    .from('teaching_programs')
    .select(`
      id, schedule_slot_id, program_content, status, reviewed_by, notes, created_at, updated_at,
      schedule_slots(date, start_time, end_time, branches(name), course_types(name))
    `)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50) as unknown as { data: TeachingProgramRow[] | null }

  const { data: assignedGroups } = await supabase
    .from('coach_assignment_groups')
    .select(`
      id, name, schedule_slot_id,
      schedule_slots!inner(id, date, start_time, end_time, branches(name), course_types(name))
    `)
    .eq('coach_id', user.id)
    .gte('schedule_slots.date', new Date().toISOString().slice(0, 10))
    .limit(80) as unknown as { data: AssignedSlotRow[] | null }

  const { data: templates } = await supabase
    .from('coach_program_templates')
    .select('id, title, content, category, is_active, created_at, updated_at')
    .eq('coach_id', user.id)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(80) as unknown as { data: ProgramTemplateRow[] | null }

  const reviewerIds = Array.from(new Set((programs || []).map((program) => program.reviewed_by).filter((id): id is string => Boolean(id))))
  const reviewerMap: Record<string, string> = {}

  if (reviewerIds.length > 0) {
    const { data: reviewers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', reviewerIds) as unknown as { data: ReviewerRow[] | null }

    ;(reviewers || []).forEach((reviewer) => {
      reviewerMap[reviewer.id] = reviewer.full_name || 'ไม่ทราบชื่อ'
    })
  }

  const programList = (programs || []).map((program) => ({
    id: program.id,
    scheduleSlotId: program.schedule_slot_id,
    slotLabel: formatSlotLabel(program),
    programContent: program.program_content,
    status: program.status,
    reviewerName: program.reviewed_by ? (reviewerMap[program.reviewed_by] || null) : null,
    notes: program.notes,
    createdAt: program.created_at,
    updatedAt: program.updated_at,
  }))

  const slotMap = new Map<string, {
    id: string
    date: string
    startTime: string
    endTime: string
    branchName: string
    courseType: string
    groupNames: string[]
  }>()

  ;(assignedGroups || []).forEach((group) => {
    const slot = group.schedule_slots
    if (!slot?.id) return
    const current = slotMap.get(slot.id) || {
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      branchName: slot.branches?.name || '-',
      courseType: slot.course_types?.name || '-',
      groupNames: [],
    }
    current.groupNames.push(group.name)
    slotMap.set(slot.id, current)
  })

  const assignedSlots = Array.from(slotMap.values()).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))

  const templateList = (templates || []).map((template) => ({
    id: template.id,
    title: template.title,
    content: template.content,
    category: template.category,
    isActive: template.is_active,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }))

  return <ProgramsClient programs={programList} assignedSlots={assignedSlots} templates={templateList} />
}
