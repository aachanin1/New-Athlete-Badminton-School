import { NextRequest, NextResponse } from 'next/server'

import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { parseAdminScheduleMonth, searchAdminSchedulesMonth } from '@/lib/admin-schedules-read'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('schedules')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  const query = (request.nextUrl.searchParams.get('q') || '').normalize('NFC').trim()
  if (!query) return NextResponse.json({ error: 'กรุณาระบุคำค้นหา' }, { status: 400 })
  if (query.length > 100) return NextResponse.json({ error: 'คำค้นหายาวเกินไป' }, { status: 400 })

  const { year, month } = parseAdminScheduleMonth(
    request.nextUrl.searchParams.get('year'),
    request.nextUrl.searchParams.get('month'),
  )

  try {
    const { result, metrics } = await searchAdminSchedulesMonth({
      supabase: access.ctx.supabase,
      year,
      month,
      query,
      branchId: request.nextUrl.searchParams.get('branch') || 'all',
      courseType: request.nextUrl.searchParams.get('course') || 'all',
    })
    return NextResponse.json({ ...result, performance: metrics }, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Server-Timing': `admin-schedule-search;dur=${metrics.durationMs}`,
      },
    })
  } catch (error) {
    console.error('Admin schedule search failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'ค้นหาตารางเรียนไม่สำเร็จ' }, { status: 500 })
  }
}
