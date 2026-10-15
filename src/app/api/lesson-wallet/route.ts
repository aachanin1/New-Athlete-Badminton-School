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

// Read-only confirmation for an uncertain Store. Ownership is checked before
// looking up the atomic operation ledger; session lifecycle status is not proof.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('sessionId') || ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'ข้อมูลรอบเรียนไม่ถูกต้อง' }, { status: 400 })
  }
  const admin = getServiceRoleClient()
  const source = await admin.from('booking_sessions').select('id,bookings!inner(user_id)')
    .eq('id', id).eq('bookings.user_id', user.id).maybeSingle()
  if (source.error) return NextResponse.json({ error: 'ยังตรวจผลการเก็บไม่ได้' }, { status: 503 })
  if (!source.data) return NextResponse.json({ error: 'ไม่พบรอบเรียน' }, { status: 404 })
  const operation = await admin.rpc('lesson_wallet_store_confirmation_v1', { p_actor_id: user.id, p_session_id: id })
  if (operation.error) return NextResponse.json({ error: 'ยังตรวจผลการเก็บไม่ได้' }, { status: 503 })
  return NextResponse.json({ confirmed: operation.data === true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
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
