import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, MapPin, Clock } from 'lucide-react'

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'นัดหมาย', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'เรียนแล้ว', color: 'bg-green-100 text-green-700' },
  rescheduled: { label: 'เลื่อน', color: 'bg-yellow-100 text-yellow-700' },
  absent: { label: 'ขาดเรียน', color: 'bg-red-100 text-red-700' },
}

export default async function SchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch upcoming booking sessions
  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id, course_type_id, children(full_name)), branches(name)')
    .eq('bookings.user_id', user.id)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(20)

  const upcomingSessions = sessions || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">ดูตารางเรียนที่กำลังจะถึง</p>
      </div>

      {upcomingSessions.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-gray-400">
              <CalendarDays className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ยังไม่มีตารางเรียน</p>
              <p className="text-sm mt-1">ตารางจะแสดงหลังจากจองคอร์สและ Admin ยืนยันการชำระเงิน</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingSessions.map((session: any) => {
            const status = SESSION_STATUS[session.status] || SESSION_STATUS.scheduled
            return (
              <Card key={session.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs text-[#2748bf] font-medium">
                        {new Date(session.date).toLocaleDateString('th-TH', { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-[#2748bf]">
                        {new Date(session.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-medium">{session.start_time} - {session.end_time}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm text-gray-500">{session.branches?.name || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.is_makeup && <Badge variant="outline" className="text-orange-600 border-orange-200">ชดเชย</Badge>}
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
