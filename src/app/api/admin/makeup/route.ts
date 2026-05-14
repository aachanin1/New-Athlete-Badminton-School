import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'

interface OriginalSessionRow {
  id: string
  booking_id: string
  date: string
  end_time: string | null
  status: string
  child_id: string | null
  bookings?: { user_id: string | null } | null
}

interface SourceSessionRow {
  id: string
  status: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
}

function getMonthBounds(date: string) {
  const [yearText, monthText] = date.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const start = new Date(year, monthIndex, 1)
  const nextStart = new Date(year, monthIndex + 1, 1)
  const followingStart = new Date(year, monthIndex + 2, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    start: toInput(start),
    nextStart: toInput(nextStart),
    followingStartInput: toInput(followingStart),
    followingStart,
  }
}

function isInNextCalendarMonth(originalDate: string, makeupDate: string) {
  const bounds = getMonthBounds(originalDate)
  return makeupDate >= bounds.nextStart && makeupDate < bounds.followingStartInput
}

function isPastSession(date: string, endTime: string | null) {
  return new Date(`${date}T${endTime || '23:59'}`).getTime() < Date.now()
}

export async function POST(req: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const {
      original_session_id: originalSessionId,
      booking_id: bookingId,
      makeup_date: makeupDate,
      start_time: startTime,
      end_time: endTime,
      branch_id: branchId,
    } = body as {
      original_session_id?: string
      booking_id?: string
      makeup_date?: string
      start_time?: string
      end_time?: string
      branch_id?: string
    }

    if (!originalSessionId || !bookingId || !makeupDate || !startTime || !endTime || !branchId) {
      return NextResponse.json({ error: 'กรุณาเลือกวัน รอบเรียน และสาขาให้ครบ' }, { status: 400 })
    }

    const { data: originalSession, error: originalError } = await supabaseAdmin
      .from('booking_sessions')
      .select('id, booking_id, date, end_time, status, child_id, bookings(user_id)')
      .eq('id', originalSessionId)
      .single<OriginalSessionRow>()

    if (originalError) {
      return NextResponse.json({ error: originalError.message }, { status: 500 })
    }

    if (!originalSession || (originalSession.status !== 'absent' && !(originalSession.status === 'scheduled' && isPastSession(originalSession.date, originalSession.end_time)))) {
      return NextResponse.json({ error: 'สร้างวันชดเชยได้เฉพาะรอบที่ขาดเรียนหรือเลยวันเรียนแล้วเท่านั้น' }, { status: 400 })
    }

    const bounds = getMonthBounds(originalSession.date)

    if (Date.now() >= bounds.followingStart.getTime()) {
      return NextResponse.json({ error: 'หมดเขตชดเชยแล้ว ต้องชดเชยภายในเดือนถัดไปเท่านั้น' }, { status: 400 })
    }

    if (!isInNextCalendarMonth(originalSession.date, makeupDate)) {
      return NextResponse.json({ error: 'วันชดเชยต้องอยู่ในเดือนถัดไปของเดือนเรียนเดิมเท่านั้น' }, { status: 400 })
    }

    let sourceQuery = supabaseAdmin
      .from('booking_sessions')
      .select('id, status, bookings!inner(user_id)')
      .gte('date', bounds.start)
      .lt('date', bounds.nextStart)

    if (originalSession.child_id) {
      sourceQuery = sourceQuery.eq('child_id', originalSession.child_id)
    } else {
      sourceQuery = sourceQuery.is('child_id', null).eq('bookings.user_id', originalSession.bookings?.user_id || '')
    }

    const { data: sourceSessions, error: sourceError } = await sourceQuery as unknown as {
      data: SourceSessionRow[] | null
      error: { message: string } | null
    }

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 })
    }

    const sourceIds = (sourceSessions || []).map((session) => session.id)
    if (sourceIds.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการเรียนในเดือนเดิมสำหรับผู้เรียนนี้' }, { status: 400 })
    }

    const { data: existingMakeup, error: existingError } = await supabaseAdmin
      .from('booking_sessions')
      .select('id')
      .in('rescheduled_from_id', sourceIds)
      .eq('is_makeup', true)
      .limit(1)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existingMakeup && existingMakeup.length > 0) {
      return NextResponse.json({ error: 'ผู้เรียนนี้ใช้สิทธิ์ชดเชยของเดือนนี้แล้ว' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('booking_sessions')
      .insert({
        booking_id: bookingId,
        date: makeupDate,
        start_time: startTime,
        end_time: endTime,
        branch_id: branchId,
        child_id: originalSession.child_id,
        status: 'scheduled',
        is_makeup: true,
        rescheduled_from_id: originalSessionId,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('booking_sessions')
      .update({ status: 'absent' })
      .in('id', sourceIds)
      .eq('status', 'scheduled')

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
