import Link from 'next/link'
import {
  Baby,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers3,
  MapPin,
  User,
  UserCheck,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { getCoachTeachingHourSourceRows } from '@/lib/coach-teaching-hours'
import { createClient } from '@/lib/supabase/server'
import { fmtTime, getBangkokDateString } from '@/lib/utils'

interface CoachSchedulePageProps {
  searchParams?: {
    date?: string
  }
}

function isValidDateString(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && value === toInputDate(parsed)
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMonthTitle(value: Date) {
  return value.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  })
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

function getMonthNavDate(selectedDate: Date, offset: number) {
  return toInputDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1))
}

export default async function CoachSchedulePage({ searchParams }: CoachSchedulePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const selectedDate = isValidDateString(searchParams?.date) ? searchParams?.date as string : today
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`)
  const monthStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1)
  const nextMonthStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 1)

  const [teachingDay, monthRows] = await Promise.all([
    getCoachAssignedTeachingDay(supabase, user.id, selectedDate),
    getCoachTeachingHourSourceRows(supabase, {
      coachId: user.id,
      startDate: toInputDate(monthStart),
      endDateExclusive: toInputDate(nextMonthStart),
    }),
  ])

  const monthRowsByDate = monthRows.reduce((map, row) => {
    if (!map[row.date]) map[row.date] = []
    map[row.date].push(row)
    return map
  }, {} as Record<string, typeof monthRows>)
  const calendarDays = getMonthCalendarDays(monthStart)
  const checkedSlotCount = teachingDay.checkedSlotCount
  const weekDayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <CalendarCheck className="h-4 w-4" />
            Coach Schedule
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตารางสอนของฉัน</h1>
          <p className="mt-1 text-sm text-gray-500">
            เลือกวันจากปฏิทินเพื่อดูรอบสอนและผู้เรียนในกลุ่มที่ได้รับมอบหมายจริง
          </p>
        </div>
        <Link
          href={`/coach/today?date=${today}`}
          className="inline-flex w-fit items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-[#153c85] transition hover:bg-blue-50"
        >
          วันนี้
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#153c85]">{formatMonthTitle(monthStart)}</CardTitle>
              <p className="text-xs text-gray-500">แสดงเฉพาะรอบที่บันทึก assignment/group แล้ว</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/coach/today?date=${getMonthNavDate(selectedDateObj, -1)}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={`/coach/today?date=${getMonthNavDate(selectedDateObj, 1)}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
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
              const isCurrentMonth = day.getMonth() === monthStart.getMonth()
              const isSelected = dateKey === selectedDate
              const isToday = dateKey === today

              return (
                <Link
                  key={dateKey}
                  href={`/coach/today?date=${dateKey}`}
                  className={`min-h-[88px] rounded-lg border p-1.5 text-xs transition hover:border-[#2748bf]/50 hover:bg-blue-50 sm:min-h-[112px] sm:p-2 ${
                    isSelected
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
                    {isToday && <span className="h-1.5 w-1.5 rounded-full bg-[#2748bf]" />}
                  </div>
                  <div className="mt-1 space-y-1">
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">รอบที่ได้รับมอบหมาย</p>
            <p className="mt-2 text-2xl font-bold text-[#153c85]">{teachingDay.slots.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">ผู้เรียนในกลุ่มของคุณ</p>
            <p className="mt-2 text-2xl font-bold text-[#153c85]">{teachingDay.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">เช็คอินแล้ว</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{checkedSlotCount}/{teachingDay.slots.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#153c85]">{formatDateLabel(selectedDate)}</h2>
        <p className="mt-1 text-sm text-gray-500">รายละเอียดรอบสอนของวันที่เลือก</p>
      </div>

      {teachingDay.slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <CalendarCheck className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีรอบสอนที่ได้รับมอบหมายในวันนี้</p>
            <p className="mt-1 text-sm">ถ้ามีผู้เรียนในรอบแล้ว ให้หัวหน้าโค้ชจัดกลุ่มและบันทึก assignment ก่อน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {teachingDay.slots.map((slot) => (
            <Card key={slot.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2748bf]/10">
                      <Clock className="h-5 w-5 text-[#2748bf]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.branchName}</span>
                        <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{slot.students.length} คน</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={slot.checkin ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700'}>
                      {slot.checkin ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Camera className="mr-1 h-3.5 w-3.5" />}
                      {slot.checkin ? 'เช็คอินแล้ว' : 'รอเช็คอิน'}
                    </Badge>
                    {slot.students.length > 0 && slot.checkin ? (
                      <Link
                        href={`/coach/attendance?date=${selectedDate}&slot=${slot.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        เช็คชื่อรอบนี้
                      </Link>
                    ) : slot.students.length > 0 && selectedDate === today ? (
                      <Link
                        href="/coach/checkin"
                        className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                      >
                        <Camera className="mr-1.5 h-4 w-4" />
                        ไปเช็คอินก่อน
                      </Link>
                    ) : slot.students.length > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                        ต้องมีเช็คอินก่อนเช็คชื่อ
                      </span>
                    ) : null}
                  </div>
                </div>

                {slot.students.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">
                    รอบนี้ยังไม่มีผู้เรียนที่อยู่ในกลุ่มของคุณ
                  </div>
                ) : (
                  <div className="space-y-2 border-t pt-3">
                    {slot.students.map((student) => (
                      <div key={student.bookingSessionId} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        {student.isChild ? <Baby className="h-4 w-4 shrink-0 text-pink-500" /> : <User className="h-4 w-4 shrink-0 text-blue-500" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-gray-900">{student.studentName}</p>
                            {student.assignmentGroupName && (
                              <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                                <Layers3 className="mr-1 h-3 w-3" />
                                {student.assignmentGroupName}
                              </Badge>
                            )}
                          </div>
                          {student.parentName && <p className="truncate text-xs text-gray-400">ผู้ปกครอง: {student.parentName}</p>}
                        </div>
                        <Badge
                          className={`text-[10px] ${
                            student.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : student.status === 'absent'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {student.status === 'completed' ? 'เรียนแล้ว' : student.status === 'absent' ? 'ขาดเรียน' : 'รอสอน'}
                        </Badge>
                      </div>
                    ))}
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
