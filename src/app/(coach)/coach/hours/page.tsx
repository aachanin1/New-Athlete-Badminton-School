import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, TrendingUp, AlertTriangle } from 'lucide-react'

export default async function HoursPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // This week (Sun-Sat)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  // This month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // Fetch all teaching hours for current month
  const { data: hours } = await (supabase
    .from('coach_teaching_hours')
    .select('date, group_hours, private_hours, total_hours')
    .eq('coach_id', user.id)
    .gte('date', startOfMonth.toISOString().split('T')[0])
    .lte('date', endOfMonth.toISOString().split('T')[0])
    .order('date', { ascending: false }) as any)

  const allHours = hours || []

  // Calculate weekly hours
  const weekStart = startOfWeek.toISOString().split('T')[0]
  const weekEnd = endOfWeek.toISOString().split('T')[0]
  const weekHours = allHours.filter((h: any) => h.date >= weekStart && h.date <= weekEnd)
  const weekGroupTotal = weekHours.reduce((s: number, h: any) => s + (parseFloat(h.group_hours) || 0), 0)
  const weekPrivateTotal = weekHours.reduce((s: number, h: any) => s + (parseFloat(h.private_hours) || 0), 0)
  const weekTotal = weekGroupTotal + weekPrivateTotal

  // Monthly totals
  const monthGroupTotal = allHours.reduce((s: number, h: any) => s + (parseFloat(h.group_hours) || 0), 0)
  const monthPrivateTotal = allHours.reduce((s: number, h: any) => s + (parseFloat(h.private_hours) || 0), 0)
  const monthTotal = monthGroupTotal + monthPrivateTotal

  // OT check (>25 hrs/week)
  const isOT = weekTotal > 25
  const otHours = Math.max(0, weekTotal - 25)

  const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
  }

  const monthName = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">สรุปชั่วโมงสอน</h1>
        <p className="text-gray-500 text-sm mt-1">เดือน{monthName}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">สัปดาห์นี้</CardTitle>
            <Clock className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekTotal} ชม.</div>
            <div className="text-[11px] text-gray-400 mt-0.5">กลุ่ม {weekGroupTotal} / Private {weekPrivateTotal}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">เดือนนี้</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthTotal} ชม.</div>
            <div className="text-[11px] text-gray-400 mt-0.5">กลุ่ม {monthGroupTotal} / Private {monthPrivateTotal}</div>
          </CardContent>
        </Card>

        <Card className={isOT ? 'ring-2 ring-orange-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">OT สัปดาห์นี้</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{otHours} ชม.</div>
            {isOT && <Badge className="bg-orange-100 text-orange-700 text-[10px] mt-0.5">เกิน 25 ชม.</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">เฉลี่ย/วัน</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allHours.length > 0 ? (monthTotal / allHours.length).toFixed(1) : 0} ชม.</div>
          </CardContent>
        </Card>
      </div>

      {isOT && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="font-medium text-sm text-orange-700">ชั่วโมงสอนสัปดาห์นี้เกิน 25 ชม.</p>
              <p className="text-xs text-orange-600">OT Private = 400 บาท/ชม., OT กลุ่ม = 200 บาท/ชม.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily breakdown */}
      <div>
        <h2 className="text-lg font-bold text-[#153c85] mb-3">รายละเอียดรายวัน</h2>
        {allHours.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-gray-400">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">ยังไม่มีข้อมูลชั่วโมงสอนเดือนนี้</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-1">
            {allHours.map((h: any) => (
              <Card key={h.date}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-center">
                      <p className="font-bold text-sm">{formatDate(h.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 text-[10px]">กลุ่ม {parseFloat(h.group_hours) || 0} ชม.</Badge>
                      <Badge className="bg-purple-100 text-purple-700 text-[10px]">Private {parseFloat(h.private_hours) || 0} ชม.</Badge>
                    </div>
                  </div>
                  <span className="font-bold text-sm">{parseFloat(h.total_hours) || 0} ชม.</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
