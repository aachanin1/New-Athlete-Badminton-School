import { createClient } from '@/lib/supabase/server'
import { MakeupClient } from '@/components/admin/makeup-client'

export default async function MakeupPage() {
  const supabase = createClient()

  const [{ data: sessions }, { data: branches }] = await Promise.all([
    supabase
      .from('booking_sessions')
      .select(`
        id, booking_id, date, start_time, end_time, status, is_makeup,
        bookings(user_id, learner_type, child_id,
          profiles!bookings_user_id_fkey(full_name),
          children(full_name, nickname),
          branches(name),
          course_types(name)
        )
      `)
      .in('status', ['absent', 'scheduled', 'completed'])
      .order('date', { ascending: false })
      .limit(300) as any,
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as any,
  ])

  const sessionList = (sessions || []).map((s: any) => {
    const learnerName = s.bookings?.learner_type === 'child'
      ? (s.bookings?.children?.nickname || s.bookings?.children?.full_name || 'ไม่ทราบ')
      : (s.bookings?.profiles?.full_name || 'ไม่ทราบ')
    return {
      id: s.id,
      booking_id: s.booking_id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      user_name: s.bookings?.profiles?.full_name || 'ไม่ทราบ',
      learner_name: learnerName,
      branch_name: s.bookings?.branches?.name || 'ไม่ทราบ',
      course_type: s.bookings?.course_types?.name || '',
      is_makeup: s.is_makeup || false,
    }
  })

  return <MakeupClient sessions={sessionList} branches={branches || []} />
}
