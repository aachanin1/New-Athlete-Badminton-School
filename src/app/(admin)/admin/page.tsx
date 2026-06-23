import { Card, CardContent } from '@/components/ui/card'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CreditCard,
  Ticket,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react'

type CountResult = { count: number | null }
type DataResult<T> = { data: T[] | null }

export default async function AdminDashboardPage() {
  const { supabase, role } = await requireAdminPageAccess()
  const canViewFinancialAmounts = role === 'super_admin'
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [
    { count: userCount },
    { count: childCount },
    { count: coachCount },
    { count: branchCount },
    { count: pendingPayments },
    { count: openComplaints },
    { count: activeCoupons },
    { data: todaySessions },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user') as unknown as PromiseLike<CountResult>,
    supabase.from('children').select('*', { count: 'exact', head: true }) as unknown as PromiseLike<CountResult>,
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['coach', 'head_coach']) as unknown as PromiseLike<CountResult>,
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true) as unknown as PromiseLike<CountResult>,
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending') as unknown as PromiseLike<CountResult>,
    supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']) as unknown as PromiseLike<CountResult>,
    supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true) as unknown as PromiseLike<CountResult>,
    supabase
      .from('booking_sessions')
      .select('id, bookings!inner(status)')
      .eq('date', today)
      .eq('status', 'scheduled')
      .eq('bookings.status', 'verified') as unknown as PromiseLike<DataResult<{ id: string }>>,
  ])

  const todayCount = todaySessions?.length || 0

  const stats = [
    {
      title: 'ผู้ใช้',
      value: `${userCount || 0} คน`,
      note: `เด็ก ${childCount || 0} คน`,
      icon: Users,
      iconClass: 'text-[#2748bf]',
    },
    {
      title: 'สาขา',
      value: `${branchCount || 0}`,
      note: 'เปิดสอน',
      icon: Building2,
      iconClass: 'text-[#f57e3b]',
    },
    {
      title: 'โค้ช',
      value: `${coachCount || 0}`,
      note: 'คน',
      icon: UserCog,
      iconClass: 'text-green-500',
    },
    {
      title: 'รอบวันนี้',
      value: `${todayCount}`,
      note: 'scheduled',
      icon: CalendarDays,
      iconClass: 'text-purple-500',
    },
    {
      title: 'รอชำระ',
      value: `${pendingPayments || 0}`,
      note: 'รายการ',
      icon: CreditCard,
      iconClass: 'text-yellow-500',
      alert: Boolean(pendingPayments && pendingPayments > 0),
    },
    {
      title: 'ร้องเรียน',
      value: `${openComplaints || 0}`,
      note: 'ยังไม่ปิด',
      icon: AlertTriangle,
      iconClass: 'text-red-500',
      alert: Boolean(openComplaints && openComplaints > 0),
    },
    {
      title: 'คูปอง',
      value: `${activeCoupons || 0}`,
      note: 'ใช้งานอยู่',
      icon: Ticket,
      iconClass: 'text-indigo-500',
    },
  ]

  if (canViewFinancialAmounts) {
    const { data: monthBookings } = await supabase
      .from('bookings')
      .select('total_price')
      .eq('status', 'verified')
      .eq('month', currentMonth)
      .eq('year', currentYear) as unknown as DataResult<{ total_price: number | null }>

    const monthRevenue = (monthBookings || []).reduce((sum, booking) => sum + (booking.total_price || 0), 0)

    stats.push({
      title: 'รายได้เดือนนี้',
      value: `฿${monthRevenue.toLocaleString()}`,
      note: 'verified',
      icon: TrendingUp,
      iconClass: 'text-emerald-500',
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ภาพรวมระบบ</h1>
        <p className="mt-1 text-sm text-gray-500">
          สรุปข้อมูลหลักของ New Athlete School
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {stats.map((stat) => (
          <Card key={stat.title} className={stat.alert ? 'ring-1 ring-yellow-300' : ''}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-500">{stat.title}</p>
                  <p className="mt-1 truncate text-xl font-bold text-gray-950">{stat.value}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-400">{stat.note}</p>
                </div>
                <stat.icon className={`h-4 w-4 shrink-0 ${stat.iconClass}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
