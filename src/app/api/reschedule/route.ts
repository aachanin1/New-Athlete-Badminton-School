import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { LessonSourceTransitionError, transitionLessonSource } from '@/lib/lesson-source-transition'

async function set1ReleaseOriginalPOST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const { sessionId, targetDate, startTime, endTime, branchId, scheduleTemplateId } = body
    if (![sessionId, targetDate, startTime, endTime, branchId].every(value => typeof value === 'string' && value)) {
      return NextResponse.json({ error: 'ข้อมูลการเปลี่ยนวันเรียนไม่ครบ กรุณาตรวจสอบอีกครั้ง' }, { status: 400 })
    }
    const result = await transitionLessonSource<{ sessionId: string; scheduleSlotId: string; warning?: unknown }>(getServiceRoleClient(), user.id, 'reschedule', sessionId, {
      targetDate, startTime, endTime, branchId, templateId: scheduleTemplateId || null,
      ipAddress: request.headers.get('x-forwarded-for'),
    })
    return NextResponse.json({ success: true, sessionId: result.sessionId, scheduleSlotId: result.scheduleSlotId, warning: result.warning ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
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
