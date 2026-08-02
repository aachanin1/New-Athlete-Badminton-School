import { NextRequest, NextResponse } from 'next/server'

import { loadAdminPayrollCoachWeekDetail } from '@/lib/admin-payroll-read'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { isCanonicalTeachingWeekRangeBangkok } from '@/lib/coach-teaching-rules'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const INPUT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('payroll')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  const coachId = request.nextUrl.searchParams.get('coachId') || ''
  const weekStart = request.nextUrl.searchParams.get('weekStart') || ''
  const weekEnd = request.nextUrl.searchParams.get('weekEnd') || ''
  if (
    !UUID_PATTERN.test(coachId)
    || !INPUT_DATE_PATTERN.test(weekStart)
    || !INPUT_DATE_PATTERN.test(weekEnd)
    || !isCanonicalTeachingWeekRangeBangkok(weekStart, weekEnd)
  ) {
    return NextResponse.json(
      { error: 'ข้อมูลโค้ชหรือช่วงสัปดาห์ไม่ถูกต้อง' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  try {
    const detail = await loadAdminPayrollCoachWeekDetail(
      getServiceRoleClient(),
      coachId,
      weekStart,
      weekEnd,
    )
    return NextResponse.json(detail, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Server-Timing': `admin-payroll-detail;dur=${detail.metrics.durationMs}`,
      },
    })
  } catch (error) {
    console.error('Admin payroll coach/week detail failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json(
      { error: 'โหลดรายละเอียดชั่วโมงสอนไม่สำเร็จ' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
