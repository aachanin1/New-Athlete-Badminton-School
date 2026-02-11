import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, TrendingUp, CreditCard, Bell, Clock, MapPin } from 'lucide-react'
import { fmtTime } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]

  // Booking count this month (verified)
  const { count: bookingCount } = await (supabase
    .from('bookings') as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'verified')
    .eq('month', currentMonth)
    .eq('year', currentYear)

  // Total sessions this month
  const { data: verifiedBookings } = await (supabase
    .from('bookings') as any)
    .select('total_sessions')
    .eq('user_id', user.id)
    .eq('status', 'verified')
    .eq('month', currentMonth)
    .eq('year', currentYear)

  const totalSessions = (verifiedBookings || []).reduce((sum: number, b: any) => sum + (b.total_sessions || 0), 0)

  // Pending payment amount
  const { data: pendingBookings } = await (supabase
    .from('bookings') as any)
    .select('total_price')
    .eq('user_id', user.id)
    .eq('status', 'pending_payment')

  const pendingAmount = (pendingBookings || []).reduce((sum: number, b: any) => sum + (b.total_price || 0), 0)

  // Unread notifications
  const { count: unreadCount } = await (supabase
    .from('notifications') as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  // Upcoming sessions (next 5)
  const { data: upcomingSessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id), branches(name)')
    .eq('bookings.user_id', user.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">หน้าหลัก</h1>
        <p className="text-gray-500 text-sm mt-1">ยินดีต้อนรับสู่ระบบ New Athlete School</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">คอร์สเรียนเดือนนี้</CardTitle>
            <CalendarDays className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions} ครั้ง</div>
            <p className="text-xs text-gray-400 mt-1">
              {bookingCount ? `${bookingCount} การจอง` : 'ยังไม่มีการจอง'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Level ปัจจุบัน</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#f57e3b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-gray-400 mt-1">ยังไม่มีข้อมูล</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ยอดค้างชำระ</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">
              {pendingAmount > 0 ? 'รอชำระเงิน' : 'ไม่มียอดค้างชำระ'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">แจ้งเตือน</CardTitle>
            <Bell className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount || 0}</div>
            <p className="text-xs text-gray-400 mt-1">
              {unreadCount ? 'แจ้งเตือนใหม่' : 'ไม่มีแจ้งเตือนใหม่'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตารางเรียนที่กำลังจะถึง</CardTitle>
        </CardHeader>
        <CardContent>
          {!upcomingSessions || upcomingSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>ยังไม่มีตารางเรียน</p>
              <p className="text-sm mt-1">จองคอร์สเรียนเพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#2748bf]/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#2748bf] font-medium">
                        {new Date(session.date).toLocaleDateString('th-TH', { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-[#2748bf] leading-none">
                        {new Date(session.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {fmtTime(session.start_time)} - {fmtTime(session.end_time)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {session.branches?.name || '-'}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">นัดหมาย</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
