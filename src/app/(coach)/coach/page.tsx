import Link from 'next/link'
import { BarChart3, CalendarCheck, Camera, Clock, MapPin, UserCheck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { getHoursBetween, getWeekInfo } from '@/lib/coach-teaching-rules'
import { getCoachTeachingHourSourceRows } from '@/lib/coach-teaching-hours'
import { createClient } from '@/lib/supabase/server'
import { fmtTime, getBangkokDateString } from '@/lib/utils'

interface CoachBranchRow {
  branch_id: string
  branches?: { name: string | null } | null
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthCalendarDays(monthStart: Date) {
  const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const calendarStart = new Date(firstDay)
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay())

  const calendarEnd = new Date(lastDay)
  calendarEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()))

  const days: Date[] = []
  const cursor = new Date(calendarStart)
  while (cursor <= calendarEnd) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function formatMonthTitle(value: Date) {
  return value.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  })
}

export default async function CoachDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const now = new Date()
  const currentWeek = getWeekInfo(today)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [teachingDay, { data: coachBranches }, monthRows] = await Promise.all([
    getCoachAssignedTeachingDay(supabase, user.id, today),
    supabase
      .from('coach_branches')
      .select('branch_id, branches(name)')
      .eq('coach_id', user.id) as unknown as PromiseLike<{ data: CoachBranchRow[] | null }>,
    getCoachTeachingHourSourceRows(supabase, {
      coachId: user.id,
      startDate: toInputDate(startOfMonth),
      endDateExclusive: toInputDate(nextMonthStart),
    }),
  ])

  const verifiedRows = monthRows.filter((row) => row.is_verified)
  const weekTotal = verifiedRows
    .filter((row) => row.date >= currentWeek.key && row.date <= currentWeek.end)
    .reduce((sum, row) => sum + getHoursBetween(row.date, row.start_time, row.end_time), 0)
  const monthTotal = verifiedRows.reduce((sum, row) => sum + getHoursBetween(row.date, row.start_time, row.end_time), 0)
  const pendingEvidence = monthRows.filter((row) => !row.is_verified)
  const hasPendingCheckin = teachingDay.slots.length > 0 && teachingDay.checkedSlotCount < teachingDay.slots.length
  const monthRowsByDate = monthRows.reduce((map, row) => {
    if (!map[row.date]) map[row.date] = []
    map[row.date].push(row)
    return map
  }, {} as Record<string, typeof monthRows>)
  const calendarDays = getMonthCalendarDays(startOfMonth)
  const weekDayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">หน้าหลักโค้ช</h1>
        <p className="mt-1 text-sm text-gray-500">
          ภาพรวมรอบสอน กลุ่มผู้เรียน และชั่วโมงสอนที่มีหลักฐานครบ
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/coach/today" className="inline-flex items-center gap-1.5 rounded-lg bg-[#2748bf] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#153c85]">
          <CalendarCheck className="h-4 w-4" />
          รอบสอนวันนี้
        </Link>
        <Link href="/coach/attendance" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700">
          <UserCheck className="h-4 w-4" />
          เช็คชื่อ
        </Link>
        {hasPendingCheckin && (
          <Link href="/coach/checkin" className="inline-flex animate-pulse items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600">
            <Camera className="h-4 w-4" />
            เช็คอินรอบสอน
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">รอบสอนวันนี้</CardTitle>
            <CalendarCheck className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachingDay.slots.length} รอบ</div>
            <p className="mt-1 text-xs text-gray-500">จาก assignment/group จริง</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ผู้เรียนในกลุ่มวันนี้</CardTitle>
            <UserCheck className="h-4 w-4 text-[#f57e3b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachingDay.totalStudents} คน</div>
            <p className="mt-1 text-xs text-gray-500">เฉพาะกลุ่มที่รับผิดชอบ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ชั่วโมงสัปดาห์นี้</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(weekTotal)} ชม.</div>
            <p className="mt-1 text-xs text-gray-500">นับเฉพาะหลักฐานครบ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ชั่วโมงเดือนนี้</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(monthTotal)} ชม.</div>
            <p className="mt-1 text-xs text-gray-500">เช็คอิน + เช็คชื่อแล้ว</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#153c85]">ตารางสอนทั้งเดือน</CardTitle>
              <p className="text-xs text-gray-500">{formatMonthTitle(startOfMonth)} จาก assignment/group ที่บันทึกแล้ว</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#2748bf]/10 px-2.5 py-1 font-medium text-[#2748bf]">{monthRows.length} รอบ</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{verifiedRows.length} หลักฐานครบ</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 sm:gap-2">
            {weekDayLabels.map((label) => (
              <div key={label} className={label === 'อา' ? 'text-red-500' : ''}>{label}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day) => {
              const dateKey = toInputDate(day)
              const rows = monthRowsByDate[dateKey] || []
              const isCurrentMonth = day.getMonth() === startOfMonth.getMonth()
              const isToday = dateKey === today

              return (
                <Link
                  key={dateKey}
                  href={`/coach/today?date=${dateKey}`}
                  className={`min-h-[88px] rounded-lg border p-1.5 text-xs sm:min-h-[112px] sm:p-2 ${
                    isToday
                      ? 'border-[#2748bf] bg-blue-50 ring-2 ring-[#2748bf]/10'
                      : isCurrentMonth
                        ? 'bg-white'
                        : 'bg-gray-50 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-bold ${day.getDay() === 0 ? 'text-red-500' : 'text-gray-700'}`}>
                      {day.getDate()}
                    </span>
                    {rows.length > 0 && (
                      <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold leading-5 text-gray-600 sm:hidden">
                        {rows.length}
                      </span>
                    )}
                  </div>
                  {rows.length > 0 && (
                    <div className="mt-2 flex min-h-4 items-center gap-1 sm:hidden">
                      {rows.slice(0, 4).map((row) => (
                        <span
                          key={`${row.assignment_id}-${row.schedule_slot_id}-dot`}
                          className={`h-1.5 w-1.5 rounded-full ${row.is_verified ? 'bg-emerald-500' : 'bg-orange-500'}`}
                        />
                      ))}
                      {rows.length > 4 && <span className="text-[10px] font-semibold text-gray-400">+</span>}
                    </div>
                  )}
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {rows.slice(0, 2).map((row) => (
                      <div
                        key={`${row.assignment_id}-${row.schedule_slot_id}`}
                        className={`rounded-md px-1.5 py-1 text-left leading-tight ${
                          row.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        <div className="font-semibold">{fmtTime(row.start_time)}</div>
                        <div className="hidden truncate sm:block">{row.branch_name}</div>
                      </div>
                    ))}
                    {rows.length > 2 && (
                      <div className="rounded-md bg-gray-100 px-1.5 py-1 text-center text-[10px] text-gray-500">
                        +{rows.length - 2} รอบ
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className={!hasPendingCheckin ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}>
        <CardContent className="flex items-center gap-3 p-4">
          <Camera className={`h-5 w-5 ${!hasPendingCheckin ? 'text-green-600' : 'text-orange-500'}`} />
          <div>
            <p className="text-sm font-medium">
              {teachingDay.slots.length === 0
                ? 'วันนี้ยังไม่มีรอบสอนที่ได้รับมอบหมาย'
                : hasPendingCheckin
                  ? `เช็คอินแล้ว ${teachingDay.checkedSlotCount}/${teachingDay.slots.length} รอบ`
                  : `เช็คอินครบแล้ว ${teachingDay.checkedSlotCount}/${teachingDay.slots.length} รอบ`}
            </p>
            {hasPendingCheckin && (
              <p className="text-xs text-gray-500">
                กรุณาเช็คอินพร้อมรูปเซลฟี่และพิกัดในแต่ละรอบของตัวเอง ก่อนเช็คชื่อนักเรียน
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {pendingEvidence.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">มี {pendingEvidence.length} รอบในเดือนนี้ที่หลักฐานยังไม่ครบ</p>
              <p className="text-xs text-amber-700">รอบเหล่านี้จะยังไม่ถูกนับในชั่วโมงสอนจนกว่าจะมีเช็คอิน รูป พิกัด และการเช็คชื่อครบ</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">สาขาที่เกี่ยวข้อง</CardTitle>
        </CardHeader>
        <CardContent>
          {(coachBranches || []).length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่ได้ผูกสาขาให้โค้ชคนนี้</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(coachBranches || []).map((branch) => (
                <span key={branch.branch_id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  <MapPin className="h-3 w-3" />
                  {branch.branches?.name || 'ไม่ระบุสาขา'}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
