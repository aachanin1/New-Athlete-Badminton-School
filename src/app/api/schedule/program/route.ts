import { NextRequest, NextResponse } from 'next/server'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { toSafeScheduleProgramResponse } from '@/lib/schedule-learning-details'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

interface OwnedSessionRow {
  id: string
  schedule_slot_id: string | null
  bookings?: { user_id: string; status: string } | null
}

interface ExactMembershipRow {
  coach_assignment_groups?: {
    id: string
    coach_id: string | null
    schedule_slot_id: string
  } | {
    id: string
    coach_id: string | null
    schedule_slot_id: string
  }[] | null
}

interface VisibleProgramRow {
  id: string
  program_content: string
  updated_at: string
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE_HEADERS })
}

function getExactGroup(row: ExactMembershipRow | null) {
  const relation = row?.coach_assignment_groups
  return Array.isArray(relation) ? relation[0] || null : relation || null
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() || ''
  if (!UUID_PATTERN.test(sessionId)) return json({ error: 'Invalid sessionId' }, 400)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: ownedSession, error: ownedSessionError } = await supabase
    .from('booking_sessions')
    .select('id, schedule_slot_id, bookings!inner(user_id, status)')
    .eq('id', sessionId)
    .eq('bookings.user_id', user.id)
    .eq('bookings.status', 'verified')
    .maybeSingle() as unknown as { data: OwnedSessionRow | null; error: { message: string } | null }

  if (ownedSessionError) {
    console.error('Schedule program ownership lookup failed:', ownedSessionError.message)
    return json({ error: 'Unable to load program' }, 500)
  }
  if (!ownedSession) return json({ error: 'Not found' }, 404)
  if (!ownedSession.schedule_slot_id) return json(toSafeScheduleProgramResponse(null))

  const adminSupabase = getServiceRoleClient()
  const { data: membership, error: membershipError } = await adminSupabase
    .from('coach_assignment_group_students')
    .select(`
      booking_session_id,
      coach_assignment_groups!inner(id, coach_id, schedule_slot_id)
    `)
    .eq('booking_session_id', sessionId)
    .limit(1)
    .maybeSingle() as unknown as { data: ExactMembershipRow | null; error: { message: string } | null }

  if (membershipError) {
    console.error('Schedule program exact-group lookup failed:', membershipError.message)
    return json({ error: 'Unable to load program' }, 500)
  }

  const group = getExactGroup(membership)
  if (!group?.coach_id || group.schedule_slot_id !== ownedSession.schedule_slot_id) {
    return json(toSafeScheduleProgramResponse(null))
  }

  const { data: program, error: programError } = await adminSupabase
    .from('teaching_programs')
    .select('id, program_content, updated_at')
    .eq('coach_id', group.coach_id)
    .eq('schedule_slot_id', group.schedule_slot_id)
    .in('status', ['submitted', 'approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as { data: VisibleProgramRow | null; error: { message: string } | null }

  if (programError) {
    console.error('Schedule program visible-program lookup failed:', programError.message)
    return json({ error: 'Unable to load program' }, 500)
  }

  return json(toSafeScheduleProgramResponse(program))
}
