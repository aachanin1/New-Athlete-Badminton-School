import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Building2, CreditCard, AlertTriangle, CalendarDays, UserCog, Ticket, Baby, TrendingUp } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

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
    { data: todayScheduleRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user') as any,
    supabase.from('children').select('*', { count: 'exact', head: true }) as any,
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['coach', 'head_coach']) as any,
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true) as any,
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending') as any,
    supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']) as any,
    supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true) as any,
    supabase.from('booking_sessions').select('id').eq('date', today).eq('status', 'scheduled') as any,
    supabase.from('bookings').select('total_price').eq('status', 'verified') as any,
    supabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, branch_id, child_id, status, schedule_slot_id,
        bookings(
          user_id, learner_type,
          profiles!bookings_user_id_fkey(full_name),
          children(full_name, nickname),
          branches(name),
          course_types(name)
        )
      `)
      .eq('date', today)
      .in('status', ['scheduled', 'completed'])
      .order('start_time') as any,
  ])

  const todayCount = todaySessions?.length || 0
  const monthRevenue = (monthBookings || []).reduce((s: number, b: any) => s + (b.total_price || 0), 0)
  const slotIds = Array.from(new Set((todayScheduleRows || []).map((session: any) => session.schedule_slot_id).filter(Boolean))) as string[]

  let coachAssignments: any[] = []
  if (slotIds.length > 0) {
    const { data } = await (supabase
      .from('coach_assignments')
      .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name)')
      .in('schedule_slot_id', slotIds) as any)
    coachAssignments = data || []
  }

  const coachMap = coachAssignments.reduce((map: Record<string, string[]>, item: any) => {
    if (!map[item.schedule_slot_id]) map[item.schedule_slot_id] = []
    const coachName = item.profiles?.full_name
    if (coachName && !map[item.schedule_slot_id].includes(coachName)) {
      map[item.schedule_slot_id].push(coachName)
    }
    return map
  }, {})

  const groupedTodaySchedule = Object.values((todayScheduleRows || []).reduce((map: Record<string, any>, session: any) => {
    const key = `${session.branch_id}-${session.start_time}-${session.end_time}-${session.schedule_slot_id}`
    if (!map[key]) {
      map[key] = {
        key,
        branchName: session.bookings?.branches?.name || 'ไม่ทราบ',
        courseType: session.bookings?.course_types?.name || '',
        startTime: session.start_time,
        endTime: session.end_time,
        coachNames: coachMap[session.schedule_slot_id] || [],
        learners: [],
      }
    }

    const learnerName = session.bookings?.learner_type === 'child'
      ? (session.bookings?.children?.nickname || session.bookings?.children?.full_name || 'เด็ก')
      : (session.bookings?.profiles?.full_name || 'ผู้เรียน')

    map[key].learners.push({
      id: session.id,
      learnerName,
      parentName: session.bookings?.profiles?.full_name || '',
      isChild: session.bookings?.learner_type === 'child',
      status: session.status,
    })

    return map
  }, {} as Record<string, any>)).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))

  const COURSE_LABELS: Record<string, string> = {
    kids_group: 'เด็กกลุ่ม',
    adult_group: 'ผู้ใหญ่กลุ่ม',
    private: 'ส่วนตัว',
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="text-[#153c85]">ตารางเรียนวันนี้ทั้งหมด</CardTitle>
          <p className="text-sm text-gray-500">
            แสดงผู้เรียนทุกคนของวันนี้ พร้อมสาขา คอร์ส และโค้ชที่รับสอน
          </p>
        </CardHeader>
        <CardContent>
          {groupedTodaySchedule.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-gray-400">
              ไม่มีตารางเรียนวันนี้
            </div>
          ) : (
            <div className="space-y-4">
              {groupedTodaySchedule.map((slot: any) => (
                <div key={slot.key} className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-[#153c85]">{slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}</p>
                        <Badge className="bg-blue-100 text-blue-700">{COURSE_LABELS[slot.courseType] || slot.courseType}</Badge>
                        <Badge variant="outline">{slot.branchName}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        โค้ช: {slot.coachNames.length > 0 ? slot.coachNames.join(', ') : 'ยังไม่ได้ระบุโค้ช'}
                      </p>
                    </div>
                    <Badge variant="outline">{slot.learners.length} คน</Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    {slot.learners.map((learner: any) => (
                      <div key={learner.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        {learner.isChild ? <Baby className="h-4 w-4 text-pink-500 shrink-0" /> : <Users className="h-4 w-4 text-blue-500 shrink-0" />}
                        <span className="font-medium">{learner.learnerName}</span>
                        {learner.isChild && learner.parentName && (
                          <span className="text-xs text-gray-400">(ผู้ปกครอง: {learner.parentName})</span>
                        )}
                        <Badge className={`ml-auto text-[10px] ${learner.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {learner.status === 'completed' ? 'เสร็จแล้ว' : 'รอเรียน'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
