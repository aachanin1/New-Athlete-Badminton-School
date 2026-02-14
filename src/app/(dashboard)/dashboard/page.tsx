import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, TrendingUp, CreditCard, Bell, Clock, MapPin, ArrowRight, Upload, BookOpen } from 'lucide-react'
import { fmtTime } from '@/lib/utils'
import { DashboardCalendar } from '@/components/dashboard/dashboard-calendar'

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

  // Pending payment bookings (full data for guidance)
  const { data: pendingBookings } = await (supabase
    .from('bookings') as any)
    .select('id, total_price, total_sessions, status')
    .eq('user_id', user.id)
    .eq('status', 'pending_payment')

  const pendingAmount = (pendingBookings || []).reduce((sum: number, b: any) => sum + (b.total_price || 0), 0)
  const hasPending = (pendingBookings || []).length > 0

  // Paid but not yet verified
  const { data: paidBookings } = await (supabase
    .from('bookings') as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'paid')
  const hasPaidWaiting = (paidBookings || []).length > 0

  // Unread notifications
  const { count: unreadCount } = await (supabase
    .from('notifications') as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  // Upcoming sessions (from verified bookings) — all this month and next
  const { data: upcomingSessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id, status), branches(name), children(full_name, nickname)')
    .eq('bookings.user_id', user.id)
    .eq('bookings.status', 'verified')
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })

  // Fetch children for color mapping
  const { data: childrenData } = await supabase
    .from('children')
    .select('id, full_name, nickname')
    .eq('parent_id', user.id)

  // Fetch user profile
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name')
    .eq('id', user.id)
    .single()

  const hasVerifiedSessions = (upcomingSessions || []).length > 0
  const hasAnyBooking = (bookingCount || 0) > 0

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

      {/* Guidance section — show when user has pending actions */}
      {(hasPending || hasPaidWaiting || (!hasAnyBooking && !hasVerifiedSessions)) && (
        <Card className="border-[#f57e3b]/30 bg-gradient-to-r from-[#f57e3b]/5 to-transparent">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-bold text-[#153c85] flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              สิ่งที่ต้องทำต่อ
            </h3>

            {!hasAnyBooking && !hasPending && !hasPaidWaiting && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div>
                  <p className="font-medium text-sm">1. จองคอร์สเรียน</p>
                  <p className="text-xs text-gray-500">เลือกประเภทคอร์ส ผู้เรียน สาขา และวันเรียน</p>
                </div>
                <Link href="/dashboard/booking">
                  <Button size="sm" className="bg-[#2748bf] hover:bg-[#153c85]">
                    จองเลย <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}

            {hasPending && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                <div>
                  <p className="font-medium text-sm text-yellow-700">
                    {hasAnyBooking ? '' : '2. '}ชำระเงิน — รอชำระ {(pendingBookings || []).length} รายการ (฿{pendingAmount.toLocaleString()})
                  </p>
                  <p className="text-xs text-gray-500">แนบสลิปโอนเงินเพื่อให้ระบบตรวจสอบอัตโนมัติ</p>
                </div>
                <Link href="/dashboard/history">
                  <Button size="sm" className="bg-[#f57e3b] hover:bg-[#e06a2a]">
                    <Upload className="h-3.5 w-3.5 mr-1" /> แนบสลิป
                  </Button>
                </Link>
              </div>
            )}

            {hasPaidWaiting && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-sm text-blue-700">กำลังตรวจสอบสลิป...</p>
                <p className="text-xs text-blue-600">ระบบกำลังตรวจสอบสลิปของคุณ ตารางเรียนจะแสดงหลังยืนยันการชำระเงินแล้ว</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar section — only show when there are verified sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตารางเรียนที่กำลังจะถึง</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasVerifiedSessions ? (
            <div className="text-center py-8 text-gray-400">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>ยังไม่มีตารางเรียน</p>
              <p className="text-sm mt-1">ตารางจะแสดงหลังจากชำระเงินและยืนยันแล้ว</p>
            </div>
          ) : (
            <DashboardCalendar
              sessions={(upcomingSessions || []) as any}
              children={(childrenData || []) as any}
              userName={(profile as any)?.full_name || ''}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
