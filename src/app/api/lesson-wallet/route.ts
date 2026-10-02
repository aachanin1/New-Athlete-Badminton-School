import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { LessonSourceTransitionError, transitionLessonSource } from '@/lib/lesson-source-transition'

interface WalletResult {
  credit_id: string
  participant_count: number
  representative_session_id: string
  session_ids: string[]
  schedule_slot_id: string
}

async function set1ReleaseOriginalPOST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    if (body.action !== 'store' && body.action !== 'redeem') {
      return NextResponse.json({ error: 'ไม่พบ action ที่รองรับ' }, { status: 400 })
    }
    const id = body.action === 'store' ? body.sessionId : body.creditId
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'ข้อมูลสิทธิ์วันเรียนไม่ครบ' }, { status: 400 })
    if (body.action === 'redeem' && ![body.targetDate, body.startTime, body.endTime, body.branchId].every(value => typeof value === 'string' && value)) {
      return NextResponse.json({ error: 'ข้อมูลการใช้วันเรียนจากกระเป๋าไม่ครบ' }, { status: 400 })
    }
    const payload = body.action === 'store' ? { ipAddress: request.headers.get('x-forwarded-for') } : {
      targetDate: body.targetDate, startTime: body.startTime, endTime: body.endTime,
      branchId: body.branchId, templateId: body.scheduleTemplateId || null,
      ipAddress: request.headers.get('x-forwarded-for'),
    }
    const result = await transitionLessonSource<WalletResult>(getServiceRoleClient(), user.id, body.action, id, payload)
    return NextResponse.json(body.action === 'store'
      ? { success: true, creditId: result.credit_id, participantCount: result.participant_count }
      : { success: true, sessionId: result.representative_session_id, sessionIds: result.session_ids,
          scheduleSlotId: result.schedule_slot_id, participantCount: result.participant_count })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      code: error instanceof LessonSourceTransitionError ? error.code : undefined },
    { status: error instanceof LessonSourceTransitionError ? error.status : 500 })
  }
}


// Immutable release fallback: fail closed without executing the business handler.
export async function POST(request: NextRequest) {
  void request
  void set1ReleaseOriginalPOST
  return NextResponse.json({ code: 'SET1_RELEASE_HOLD', error: 'ระบบกำลังปรับปรุงการจัดการสิทธิ์ กรุณาลองใหม่ภายหลัง' }, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
}
