import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, CreditCard, AlertTriangle, CalendarDays, UserCog, Ticket, Baby, TrendingUp } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = createClient()

  // Parallel fetch all stats
  const [
    { count: userCount },
    { count: childCount },
    { count: coachCount },
    { count: branchCount },
    { count: pendingPayments },
    { count: openComplaints },
    { count: activeCoupons },
    { data: todaySessions },
    { data: monthBookings },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user') as any,
    supabase.from('children').select('*', { count: 'exact', head: true }) as any,
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['coach', 'head_coach']) as any,
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true) as any,
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending') as any,
    supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']) as any,
    supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true) as any,
    supabase.from('booking_sessions').select('id').eq('date', new Date().toISOString().split('T')[0]).eq('status', 'scheduled') as any,
    supabase.from('bookings').select('total_price').eq('status', 'verified') as any,
  ])

  const todayCount = todaySessions?.length || 0
  const monthRevenue = (monthBookings || []).reduce((s: number, b: any) => s + (b.total_price || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ภาพรวมระบบ</h1>
        <p className="text-gray-500 text-sm mt-1">สรุปข้อมูลทั้งหมดของ New Athlete School</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ผู้ใช้ทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount || 0} คน</div>
            <p className="text-xs text-gray-400 mt-1">เด็ก {childCount || 0} คน</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">สาขาที่เปิดสอน</CardTitle>
            <Building2 className="h-4 w-4 text-[#f57e3b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchCount || 0} สาขา</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">โค้ชทั้งหมด</CardTitle>
            <UserCog className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coachCount || 0} คน</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">คอร์สเรียนวันนี้</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCount} รอบ</div>
          </CardContent>
        </Card>

        <Card className={pendingPayments && pendingPayments > 0 ? 'ring-2 ring-yellow-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">รอตรวจสอบการชำระเงิน</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments || 0} รายการ</div>
          </CardContent>
        </Card>

        <Card className={openComplaints && openComplaints > 0 ? 'ring-2 ring-red-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ร้องเรียนที่ยังไม่ปิด</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openComplaints || 0} เรื่อง</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">คูปองที่ใช้งานอยู่</CardTitle>
            <Ticket className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons || 0} รายการ</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">รายได้ (จองที่ verified)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{monthRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
