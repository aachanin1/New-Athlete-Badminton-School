import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarCheck, Users, Clock, BarChart3, MapPin, UserCheck, Camera } from 'lucide-react'
import Link from 'next/link'

export default async function CoachDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, is_head_coach, branches(name)')
    .eq('coach_id', user.id) as any)

  // Today's sessions: booking_sessions for today at coach's branches
  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  let todaySessions: any[] = []
  if (branchIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select('id')
      .eq('date', today)
      .eq('status', 'scheduled')
      .in('branch_id', branchIds) as any)
    todaySessions = data || []
  }

  // Teaching hours this week
  const { data: weekHours } = await (supabase
    .from('coach_teaching_hours')
    .select('total_hours')
    .eq('coach_id', user.id)
    .gte('date', startOfWeek.toISOString().split('T')[0])
    .lte('date', today) as any)

  const weekTotal = (weekHours || []).reduce((s: number, h: any) => s + (parseFloat(h.total_hours) || 0), 0)

  // Teaching hours this month
  const { data: monthHours } = await (supabase
    .from('coach_teaching_hours')
    .select('total_hours')
    .eq('coach_id', user.id)
    .gte('date', startOfMonth.toISOString().split('T')[0])
    .lte('date', today) as any)

  const monthTotal = (monthHours || []).reduce((s: number, h: any) => s + (parseFloat(h.total_hours) || 0), 0)

  // Today's checkin
  const { data: todayCheckin } = await (supabase
    .from('coach_checkins')
    .select('id')
    .eq('coach_id', user.id)
    .gte('created_at', today + 'T00:00:00')
    .limit(1) as any)

  const hasCheckedIn = (todayCheckin || []).length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">หน้าหลักโค้ช</h1>
        <p className="text-gray-500 text-sm mt-1">ภาพรวมการสอนของคุณ</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/coach/today" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2748bf] text-white text-sm font-medium rounded-lg hover:bg-[#153c85] transition-colors">
          <CalendarCheck className="h-4 w-4" />รอบสอนวันนี้
        </Link>
        <Link href="/coach/attendance" className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <UserCheck className="h-4 w-4" />เช็คชื่อ
        </Link>
        {!hasCheckedIn && (
          <Link href="/coach/checkin" className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors animate-pulse">
            <Camera className="h-4 w-4" />เช็คอินวันนี้
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">รอบสอนวันนี้</CardTitle>
            <CalendarCheck className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaySessions.length} รอบ</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">สาขาที่สอน</CardTitle>
            <MapPin className="h-4 w-4 text-[#f57e3b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(coachBranches || []).length} สาขา</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(coachBranches || []).map((cb: any) => (
                <span key={cb.branch_id} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{cb.branches?.name}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ชั่วโมงสอนสัปดาห์นี้</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekTotal} ชม.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ชั่วโมงสอนเดือนนี้</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthTotal} ชม.</div>
          </CardContent>
        </Card>
      </div>

      {/* Checkin status */}
      <Card className={hasCheckedIn ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}>
        <CardContent className="p-4 flex items-center gap-3">
          <Camera className={`h-5 w-5 ${hasCheckedIn ? 'text-green-600' : 'text-orange-500'}`} />
          <div>
            <p className="font-medium text-sm">{hasCheckedIn ? 'เช็คอินวันนี้แล้ว ✓' : 'ยังไม่ได้เช็คอินวันนี้'}</p>
            {!hasCheckedIn && <p className="text-xs text-gray-500">กรุณาเช็คอินก่อนเริ่มสอน</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
