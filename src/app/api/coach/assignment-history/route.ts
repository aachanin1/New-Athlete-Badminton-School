import { NextRequest, NextResponse } from 'next/server'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { getCoachAssignmentHistory } from '@/lib/coach-assignment-history'
import { CoachAssignmentDataUnavailableError } from '@/lib/coach-assignment-resolution'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

type AssignmentHistoryRole = 'head_coach' | 'super_admin'

interface AssignmentHistorySlotRow {
  id: string
  branch_id: string
  date: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

function typedError(code: string, error: string, status: number) {
  return NextResponse.json({ code, error }, {
    status,
    headers: PRIVATE_NO_STORE_HEADERS,
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return typedError('HISTORY_UNAUTHORIZED', 'Unauthorized', 401)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as {
      data: { role: string } | null
      error: { message: string } | null
    }
  if (profileError || !profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    return typedError('HISTORY_FORBIDDEN', 'Forbidden', 403)
  }
  const role = profile.role as AssignmentHistoryRole

  const scheduleSlotId = request.nextUrl.searchParams.get('scheduleSlotId') || ''
  if (!UUID_PATTERN.test(scheduleSlotId)) {
    return typedError('HISTORY_INVALID_SLOT', 'ข้อมูลรอบสอนไม่ถูกต้อง', 400)
  }

  try {
    const { data: slot, error: slotError } = await supabase
      .from('schedule_slots')
      .select('id, branch_id, date')
      .eq('id', scheduleSlotId)
      .maybeSingle() as unknown as {
        data: AssignmentHistorySlotRow | null
        error: { message: string } | null
      }
    if (slotError) {
      throw new CoachAssignmentDataUnavailableError('Coach assignment history slot query failed', slotError.message)
    }
    if (!slot) return typedError('HISTORY_SLOT_NOT_FOUND', 'ไม่พบรอบสอน', 404)

    if (role === 'head_coach') {
      const { data: ownBranch, error: branchError } = await supabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', user.id)
        .eq('branch_id', slot.branch_id)
        .maybeSingle() as unknown as {
          data: { branch_id: string } | null
          error: { message: string } | null
        }
      if (branchError) {
        throw new CoachAssignmentDataUnavailableError('Coach assignment history branch access query failed', branchError.message)
      }
      if (!ownBranch) {
        return typedError('HISTORY_BRANCH_FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงรอบสอนของสาขานี้', 403)
      }
    } else {
      const { data: activeBranch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', slot.branch_id)
        .eq('is_active', true)
        .maybeSingle() as unknown as {
          data: { id: string } | null
          error: { message: string } | null
        }
      if (branchError) {
        throw new CoachAssignmentDataUnavailableError('Coach assignment history active branch query failed', branchError.message)
      }
      if (!activeBranch) {
        return typedError('HISTORY_BRANCH_FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงรอบสอนของสาขานี้', 403)
      }
    }

    const currentBangkokMonth = getBangkokDateString(new Date()).slice(0, 7)
    if (slot.date.slice(0, 7) < currentBangkokMonth) {
      return typedError('HISTORY_SLOT_HISTORICAL', 'ประวัติในหน้า Assignment เปิดได้เฉพาะเดือนปัจจุบันและอนาคต', 409)
    }

    const serviceRoleClient = getServiceRoleClient()
    const events = await getCoachAssignmentHistory(serviceRoleClient, {
      scheduleSlotId: slot.id,
      branchId: slot.branch_id,
    })

    return NextResponse.json({ events }, { headers: PRIVATE_NO_STORE_HEADERS })
  } catch (error) {
    if (error instanceof CoachAssignmentDataUnavailableError) {
      return typedError('HISTORY_DATA_UNAVAILABLE', 'โหลดประวัติการเปลี่ยนแปลงไม่ครบ กรุณาลองใหม่', 503)
    }
    return typedError('HISTORY_INTERNAL_ERROR', 'โหลดประวัติการเปลี่ยนแปลงไม่สำเร็จ', 500)
  }
}
