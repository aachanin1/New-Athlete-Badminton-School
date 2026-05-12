import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Building2, CreditCard, AlertTriangle, CalendarDays, UserCog, Ticket, TrendingUp } from 'lucide-react'
import { AdminOverviewSchedule } from '@/components/admin/admin-overview-schedule'

type CountResult = { count: number | null }
type DataResult<T> = { data: T[] | null }

interface PriceRow {
  total_price: number | null
}

interface BranchRow {
  id: string
  name: string
}

interface RawScheduleRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean | null
  child_id: string | null
  branch_id: string
  schedule_slot_id: string | null
  branches?: { name: string } | null
  children?: { full_name: string; nickname: string | null } | null
  bookings?: {
    id: string
    user_id: string
    learner_type: string
    status: string
    profiles?: { full_name: string } | null
    course_types?: { name: string } | null
  } | null
}

interface CoachAssignmentRow {
  schedule_slot_id: string
  coach_id: string
  profiles?: { full_name: string } | null
}

export default async function AdminDashboardPage() {
  const supabase = createClient()
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
    { data: monthBookings },
    { data: scheduleRows },
    { data: branches },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user') as unknown as PromiseLike<CountResult>,
    supabase.from('children').select('*', { count: 'exact', head: true }) as unknown as PromiseLike<CountResult>,
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['coach', 'head_coach']) as unknown as PromiseLike<CountResult>,
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true) as unknown as PromiseLike<CountResult>,
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending') as unknown as PromiseLike<CountResult>,
    supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']) as unknown as PromiseLike<CountResult>,
    supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true) as unknown as PromiseLike<CountResult>,
    supabase.from('booking_sessions').select('id').eq('date', today).eq('status', 'scheduled') as unknown as PromiseLike<DataResult<{ id: string }>>,
    supabase
      .from('bookings')
      .select('total_price')
      .eq('status', 'verified')
      .eq('month', currentMonth)
      .eq('year', currentYear) as unknown as PromiseLike<DataResult<PriceRow>>,
    supabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, branch_id, child_id, status, is_makeup, schedule_slot_id,
        branches(name),
        children(full_name, nickname),
        bookings!inner(
          id, user_id, learner_type, status,
          profiles!bookings_user_id_fkey(full_name),
          course_types(name)
        )
      `)
      .in('bookings.status', ['pending_payment', 'paid', 'verified'])
      .neq('status', 'rescheduled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }) as unknown as PromiseLike<DataResult<RawScheduleRow>>,
    supabase.from('branches').select('id, name').eq('is_active', true).order('name') as unknown as PromiseLike<DataResult<BranchRow>>,
  ])

  const todayCount = todaySessions?.length || 0
  const monthRevenue = (monthBookings || []).reduce((sum, booking) => sum + (booking.total_price || 0), 0)
  const slotIds = Array.from(new Set((scheduleRows || []).map((session) => session.schedule_slot_id).filter(Boolean))) as string[]

  let coachAssignments: CoachAssignmentRow[] = []
  if (slotIds.length > 0) {
    const { data } = await (supabase
      .from('coach_assignments')
      .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name)')
      .in('schedule_slot_id', slotIds) as unknown as PromiseLike<DataResult<CoachAssignmentRow>>)
    coachAssignments = data || []
  }

  const coachMap = coachAssignments.reduce((map: Record<string, string[]>, item) => {
    if (!map[item.schedule_slot_id]) map[item.schedule_slot_id] = []
    const coachName = item.profiles?.full_name
    if (coachName && !map[item.schedule_slot_id].includes(coachName)) {
      map[item.schedule_slot_id].push(coachName)
    }
    return map
  }, {})

  const scheduleSessions = (scheduleRows || []).map((session) => ({
    id: session.id,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    status: session.status,
    is_makeup: session.is_makeup || false,
    child_id: session.child_id,
    branch_id: session.branch_id,
    branch_name: session.branches?.name || 'ไม่ทราบสาขา',
    learner_name: session.child_id
      ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบชื่อ')
      : (session.bookings?.profiles?.full_name || 'ไม่ทราบชื่อ'),
    parent_name: session.child_id ? (session.bookings?.profiles?.full_name || '') : '',
    course_type: session.bookings?.course_types?.name || '',
    booking_status: session.bookings?.status || '',
    coach_names: session.schedule_slot_id ? coachMap[session.schedule_slot_id] || [] : [],
  }))

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
    {
      title: 'รายได้เดือนนี้',
      value: `฿${monthRevenue.toLocaleString()}`,
      note: 'verified',
      icon: TrendingUp,
      iconClass: 'text-emerald-500',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ภาพรวมระบบ</h1>
        <p className="text-gray-500 text-sm mt-1">สรุปข้อมูลและตารางเรียนของ New Athlete School</p>
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

      <AdminOverviewSchedule sessions={scheduleSessions} branches={branches || []} />
    </div>
  )
}
