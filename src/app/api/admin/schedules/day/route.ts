import { NextRequest, NextResponse } from 'next/server'

import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { isAdminScheduleDateInMonth, loadAdminScheduleDayDetail, parseAdminScheduleMonth } from '@/lib/admin-schedules-read'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('schedules')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  const date = request.nextUrl.searchParams.get('date') || ''
  const { year, month } = parseAdminScheduleMonth(
    request.nextUrl.searchParams.get('year'),
    request.nextUrl.searchParams.get('month'),
  )
  if (!isAdminScheduleDateInMonth(date, year, month)) {
    return NextResponse.json({ error: 'วันที่อยู่นอกเดือนที่กำลังดู' }, { status: 400 })
  }

  try {
    const { detail, metrics } = await loadAdminScheduleDayDetail(access.ctx.supabase, date)
    return NextResponse.json({ ...detail, performance: metrics }, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Server-Timing': `admin-schedule-day;dur=${metrics.durationMs}`,
      },
    })
  } catch (error) {
    console.error('Admin schedule day detail failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'โหลดรายละเอียดตารางเรียนไม่สำเร็จ' }, { status: 500 })
  }
}
