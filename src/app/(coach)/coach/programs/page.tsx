import { createClient } from '@/lib/supabase/server'
import { ProgramsClient } from '@/components/coach/programs-client'

export default async function ProgramsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch coach's programs
  const { data: programs } = await (supabase
    .from('teaching_programs')
    .select('id, program_content, status, reviewed_by, notes, created_at, updated_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50) as any)

  // Resolve reviewer names
  const reviewerIds = Array.from(new Set((programs || []).map((p: any) => p.reviewed_by).filter(Boolean))) as string[]
  let reviewerMap: Record<string, string> = {}
  if (reviewerIds.length > 0) {
    const { data: reviewers } = await (supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', reviewerIds) as any)
    ;(reviewers || []).forEach((r: any) => { reviewerMap[r.id] = r.full_name })
  }

  const programList = (programs || []).map((p: any) => ({
    id: p.id,
    programContent: p.program_content,
    status: p.status,
    reviewerName: p.reviewed_by ? (reviewerMap[p.reviewed_by] || null) : null,
    notes: p.notes,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  return <ProgramsClient programs={programList} />
}
