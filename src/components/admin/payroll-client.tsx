'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Search, Clock, DollarSign, AlertTriangle, User, TrendingUp,
} from 'lucide-react'

interface CoachHoursData {
  coach_id: string
  coach_name: string
  date: string
  group_hours: number
  private_hours: number
  total_hours: number
}

interface PayrollClientProps {
  hours: CoachHoursData[]
  currentMonth: number
  currentYear: number
}

const OT_THRESHOLD_WEEKLY = 25
const OT_RATE_PRIVATE = 400
const OT_RATE_GROUP = 200

const MONTH_LABELS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const dayOfMonth = d.getDate()
  return Math.ceil((dayOfMonth + start.getDay()) / 7)
}

interface CoachSummary {
  coach_id: string
  coach_name: string
  totalGroupHours: number
  totalPrivateHours: number
  totalHours: number
  weeksWithOT: number
  otHours: number
  otPayPrivate: number
  otPayGroup: number
  totalOTPay: number
  weeklyBreakdown: { week: number; group: number; private: number; total: number; isOT: boolean }[]
}

export function PayrollClient({ hours, currentMonth, currentYear }: PayrollClientProps) {
  const [search, setSearch] = useState('')
  const [viewMonth, setViewMonth] = useState<number>(currentMonth)
  const [viewYear, setViewYear] = useState<number>(currentYear)

  const years = useMemo(() => {
    const ySet = new Set(hours.map((h) => new Date(h.date).getFullYear()))
    ySet.add(currentYear)
    return Array.from(ySet).sort((a, b) => b - a)
  }, [hours, currentYear])

  // Filter and compute per-coach summary
  const coachSummaries = useMemo(() => {
    const filtered = hours.filter((h) => {
      const d = new Date(h.date)
      return d.getMonth() + 1 === viewMonth && d.getFullYear() === viewYear
    })

    // Group by coach
    const coachMap: Record<string, CoachHoursData[]> = {}
    filtered.forEach((h) => {
      if (!coachMap[h.coach_id]) coachMap[h.coach_id] = []
      coachMap[h.coach_id].push(h)
    })

    const summaries: CoachSummary[] = Object.entries(coachMap).map(([coachId, entries]) => {
      const coachName = entries[0].coach_name

      // Weekly breakdown
      const weekMap: Record<number, { group: number; private: number }> = {}
      entries.forEach((e) => {
        const week = getWeekNumber(e.date)
        if (!weekMap[week]) weekMap[week] = { group: 0, private: 0 }
        weekMap[week].group += Number(e.group_hours)
        weekMap[week].private += Number(e.private_hours)
      })

      let totalGroupHours = 0
      let totalPrivateHours = 0
      let weeksWithOT = 0
      let otHoursPrivate = 0
      let otHoursGroup = 0

      const weeklyBreakdown = Object.entries(weekMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([week, data]) => {
          const total = data.group + data.private
          const isOT = total > OT_THRESHOLD_WEEKLY
          totalGroupHours += data.group
          totalPrivateHours += data.private

          if (isOT) {
            weeksWithOT++
            const otTotal = total - OT_THRESHOLD_WEEKLY
            // Distribute OT proportionally between group and private
            const privateRatio = total > 0 ? data.private / total : 0
            otHoursPrivate += otTotal * privateRatio
            otHoursGroup += otTotal * (1 - privateRatio)
          }

          return { week: Number(week), group: data.group, private: data.private, total, isOT }
        })

      return {
        coach_id: coachId,
        coach_name: coachName,
        totalGroupHours,
        totalPrivateHours,
        totalHours: totalGroupHours + totalPrivateHours,
        weeksWithOT,
        otHours: otHoursPrivate + otHoursGroup,
        otPayPrivate: Math.round(otHoursPrivate * OT_RATE_PRIVATE),
        otPayGroup: Math.round(otHoursGroup * OT_RATE_GROUP),
        totalOTPay: Math.round(otHoursPrivate * OT_RATE_PRIVATE + otHoursGroup * OT_RATE_GROUP),
        weeklyBreakdown,
      }
    })

    return summaries.sort((a, b) => b.totalHours - a.totalHours)
  }, [hours, viewMonth, viewYear])

  const filteredCoaches = useMemo(() => {
    if (!search) return coachSummaries
    const q = search.toLowerCase()
    return coachSummaries.filter((c) => c.coach_name.toLowerCase().includes(q))
  }, [coachSummaries, search])

  const totalStats = useMemo(() => ({
    coaches: coachSummaries.length,
    totalHours: coachSummaries.reduce((s, c) => s + c.totalHours, 0),
    totalOT: coachSummaries.reduce((s, c) => s + c.otHours, 0),
    totalOTPay: coachSummaries.reduce((s, c) => s + c.totalOTPay, 0),
    coachesWithOT: coachSummaries.filter((c) => c.weeksWithOT > 0).length,
  }), [coachSummaries])

  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เงินเดือนโค้ช</h1>
        <p className="text-gray-500 text-sm mt-1">คำนวณชั่วโมงสอนและค่าตอบแทน OT (เกิน {OT_THRESHOLD_WEEKLY} ชม./สัปดาห์)</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อโค้ช..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_LABELS.slice(1).map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{totalStats.coaches}</p><p className="text-xs text-gray-500">โค้ช</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{fmt(totalStats.totalHours)} ชม.</p><p className="text-xs text-gray-500">ชั่วโมงรวม</p>
        </CardContent></Card>
        <Card className={totalStats.coachesWithOT > 0 ? 'ring-2 ring-orange-300' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{totalStats.coachesWithOT}</p><p className="text-xs text-gray-500">โค้ชมี OT</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{fmt(totalStats.totalOT)} ชม.</p><p className="text-xs text-gray-500">OT รวม</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">฿{fmt(totalStats.totalOTPay)}</p><p className="text-xs text-gray-500">ค่า OT รวม</p>
        </CardContent></Card>
      </div>

      {/* OT Rates */}
      <div className="flex gap-3 text-xs text-gray-400">
        <span>OT Private: ฿{OT_RATE_PRIVATE}/ชม.</span>
        <span>OT Group: ฿{OT_RATE_GROUP}/ชม.</span>
        <span>เกณฑ์: {OT_THRESHOLD_WEEKLY} ชม./สัปดาห์</span>
      </div>

      {/* Coach list */}
      {filteredCoaches.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบข้อมูลชั่วโมงสอน</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredCoaches.map((coach) => (
            <Card key={coach.coach_id} className={coach.weeksWithOT > 0 ? 'border-orange-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-[#2748bf]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{coach.coach_name}</p>
                      <p className="text-xs text-gray-400">{MONTH_LABELS[viewMonth]} {viewYear + 543}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {coach.weeksWithOT > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />OT {coach.weeksWithOT} สัปดาห์
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Hours summary */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">กลุ่ม</p>
                    <p className="font-bold text-blue-600">{coach.totalGroupHours} ชม.</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Private</p>
                    <p className="font-bold text-orange-600">{coach.totalPrivateHours} ชม.</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">รวม</p>
                    <p className="font-bold">{coach.totalHours} ชม.</p>
                  </div>
                </div>

                {/* Weekly breakdown */}
                <div className="space-y-1">
                  {coach.weeklyBreakdown.map((w) => (
                    <div key={w.week} className={`flex items-center gap-2 text-xs p-1.5 rounded ${w.isOT ? 'bg-orange-50' : 'bg-gray-50'}`}>
                      <span className="w-14 font-medium text-gray-500">สัปดาห์ {w.week}</span>
                      <span className="text-blue-600">กลุ่ม {w.group}ชม.</span>
                      <span className="text-orange-600">Pvt {w.private}ชม.</span>
                      <span className="font-bold">{w.total}ชม.</span>
                      {w.isOT && (
                        <Badge className="bg-orange-100 text-orange-700 text-[9px] ml-auto">เกิน {(w.total - OT_THRESHOLD_WEEKLY).toFixed(1)} ชม.</Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* OT Pay */}
                {coach.totalOTPay > 0 && (
                  <div className="mt-3 p-2 bg-green-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-green-700 flex items-center gap-1"><DollarSign className="h-4 w-4" />ค่า OT</span>
                    <div className="text-right">
                      {coach.otPayGroup > 0 && <p className="text-xs text-gray-500">Group: ฿{fmt(coach.otPayGroup)}</p>}
                      {coach.otPayPrivate > 0 && <p className="text-xs text-gray-500">Private: ฿{fmt(coach.otPayPrivate)}</p>}
                      <p className="font-bold text-green-700">฿{fmt(coach.totalOTPay)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
