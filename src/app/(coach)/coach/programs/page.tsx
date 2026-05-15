import { ProgramsClient } from '@/components/coach/programs-client'
import { createClient } from '@/lib/supabase/server'
import type { ProgramStatus } from '@/types/database'

interface TeachingProgramRow {
  id: string
  program_content: string
  status: ProgramStatus
  reviewed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface ReviewerRow {
  id: string
  full_name: string | null
}

export default async function ProgramsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: programs } = await supabase
    .from('teaching_programs')
    .select('id, program_content, status, reviewed_by, notes, created_at, updated_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50) as unknown as { data: TeachingProgramRow[] | null }

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
    programContent: program.program_content,
    status: program.status,
    reviewerName: program.reviewed_by ? (reviewerMap[program.reviewed_by] || null) : null,
    notes: program.notes,
    createdAt: program.created_at,
    updatedAt: program.updated_at,
  }))

  return <ProgramsClient programs={programList} />
}
