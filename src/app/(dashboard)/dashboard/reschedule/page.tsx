import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RescheduleClient } from '@/components/dashboard/reschedule-client'

export default async function ReschedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch upcoming scheduled sessions (only future, status=scheduled)
  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id, course_type_id, children(full_name)), branches(name)')
    .eq('bookings.user_id', user.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })

  // Fetch branches for rescheduling target
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เปลี่ยนวัน/สาขา</h1>
        <p className="text-gray-500 text-sm mt-1">เปลี่ยนวันเรียนหรือสาขาได้ล่วงหน้า 24 ชั่วโมง</p>
      </div>
      <RescheduleClient
        sessions={sessions || []}
        branches={(branches as any) || []}
      />
    </div>
  )
}
