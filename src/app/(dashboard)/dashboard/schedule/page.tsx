import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScheduleCalendarClient } from '@/components/dashboard/schedule-calendar-client'

interface ScheduleSessionRow {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  rescheduled_from_id: string | null
  children: { full_name: string; nickname: string | null } | null
  bookings: { course_types: { name: string | null } | null } | null
  branches: { name: string | null } | null
}

interface OriginalSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
}

interface ChildRow {
  id: string
  full_name: string
  nickname: string | null
}

interface ProfileRow {
  full_name: string | null
}

export default async function SchedulePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: allSessions } = await supabase
    .from('booking_sessions')
    .select('id, booking_id, schedule_slot_id, date, start_time, end_time, status, is_makeup, child_id, rescheduled_from_id, bookings!inner(user_id, course_type_id, status, course_types(name)), branches(name), children(full_name, nickname)')
    .eq('bookings.user_id', user.id)
    .eq('bookings.status', 'verified')
    .neq('status', 'rescheduled')
    .order('date', { ascending: true }) as unknown as { data: ScheduleSessionRow[] | null }

  const sessionsArr = allSessions || []
  const fromIds = Array.from(new Set(sessionsArr.map((session) => session.rescheduled_from_id).filter(Boolean))) as string[]
  const fromMap: Record<string, OriginalSessionRow> = {}

  if (fromIds.length > 0) {
    const { data: fromSessions } = await supabase
      .from('booking_sessions')
      .select('id, date, start_time, end_time')
      .in('id', fromIds) as unknown as { data: OriginalSessionRow[] | null }

    ;(fromSessions || []).forEach((session) => {
      fromMap[session.id] = session
    })
  }

  const sessions = sessionsArr.map((session) => ({
    ...session,
    rescheduled_from: session.rescheduled_from_id ? fromMap[session.rescheduled_from_id] || null : null,
  }))

  const [{ data: children }, { data: profile }] = await Promise.all([
    supabase
      .from('children')
      .select('id, full_name, nickname')
      .eq('parent_id', user.id) as unknown as PromiseLike<{ data: ChildRow[] | null }>,
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single() as unknown as PromiseLike<{ data: ProfileRow | null }>,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">ดูตารางเรียนรายเดือน พร้อมรอบปกติ รอบชดเชย และประวัติการเปลี่ยนวัน</p>
      </div>

      <ScheduleCalendarClient
        sessions={sessions}
        learnerChildren={children || []}
        userName={profile?.full_name || ''}
      />
    </div>
  )
}
