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
import { CoachTodayProgramDialog, type CoachTodayProgram } from '@/components/coach/coach-today-program-dialog'
import { formatCoachAssignedGroupLevelRange, getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { getCoachSlotCheckedCount, getCoachSlotDisplaySummary } from '@/lib/coach-slot-display-status'
import { getCoachTeachingHourSourceRows } from '@/lib/coach-teaching-hours'
import { formatThaiDateWithWeekday, formatThaiMonthYear } from '@/lib/date-format'
import { deriveSessionAttendanceStatus, isInProgressSession } from '@/lib/session-attendance-status'
import {
  buildActiveScheduleLevelNameMap,
  buildLatestScheduleStudentLevelMap,
  getScheduleLevelDetails,
  getScheduleStudentKey,
  type ScheduleLevelDefinition,
  type ScheduleStudentLevelRow,
} from '@/lib/schedule-learning-details'
import { createClient } from '@/lib/supabase/server'
import { fmtTime, getBangkokDateString } from '@/lib/utils'
import type { ProgramStatus } from '@/types/database'

interface CoachSchedulePageProps {
  searchParams?: Promise<{
    date?: string
  }>
}

interface CoachProgramRow {
  id: string
  schedule_slot_id: string
  program_content: string
  status: ProgramStatus
  updated_at: string
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
  return formatThaiDateWithWeekday(date)
}

function formatMonthTitle(value: Date) {
  return formatThaiMonthYear(value)
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

function getStudentScheduleStatus(
  slot: { date: string; startTime: string; endTime: string },
  student: { status: string; attendanceStatus: 'present' | 'late' | 'absent' | null },
) {
  const isInProgress = isInProgressSession(slot.date, slot.startTime, slot.endTime)
  const derivedStatus = deriveSessionAttendanceStatus({
    status: student.status,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    attendanceStatus: student.attendanceStatus,
    scopeAttendanceCount: student.attendanceStatus ? 1 : 0,
  })

  if (derivedStatus === 'present') {
    if (isInProgress) {
      return { label: 'เช็คชื่อแล้ว', className: 'bg-green-100 text-green-700' }
    }

    return { label: 'มาเรียนแล้ว', className: 'bg-green-100 text-green-700' }
  }

  if (derivedStatus === 'late') {
    if (isInProgress) {
      return { label: 'เช็คชื่อแล้ว', className: 'bg-green-100 text-green-700' }
    }

    return { label: 'มาสาย', className: 'bg-amber-100 text-amber-700' }
  }

  if (derivedStatus === 'absent') {
    return { label: 'ขาดเรียน', className: 'bg-red-100 text-red-700' }
  }

  if (derivedStatus === 'completed') {
    return { label: 'บันทึกผลแล้ว', className: 'bg-green-100 text-green-700' }
  }

  if (derivedStatus === 'upcoming') {
    return { label: 'รอเริ่มสอน', className: 'bg-blue-100 text-blue-700' }
  }

  if (derivedStatus === 'in_progress') {
    return { label: 'รอเช็คชื่อ', className: 'bg-amber-100 text-amber-700' }
  }

  if (derivedStatus === 'attendance_gap_review') {
    return { label: 'รอตรวจเช็คชื่อ', className: 'bg-orange-100 text-orange-700' }
  }

  if (derivedStatus === 'walleted') {
    return { label: 'ไม่อยู่ในรอบสอนวันนี้', className: 'bg-gray-100 text-gray-500' }
  }

  return { label: 'ไม่อยู่ในรอบสอนวันนี้', className: 'bg-gray-100 text-gray-500' }
}

export default async function CoachSchedulePage({ searchParams }: CoachSchedulePageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const resolvedSearchParams = await searchParams
  const today = getBangkokDateString()
  const selectedDate = isValidDateString(resolvedSearchParams?.date) ? resolvedSearchParams?.date as string : today
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`)
  const monthStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1)
  const nextMonthStart = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 1)

  const teachingDayPromise = getCoachAssignedTeachingDay(supabase, user.id, selectedDate)
  const monthRowsPromise = getCoachTeachingHourSourceRows(supabase, {
      coachId: user.id,
      startDate: toInputDate(monthStart),
      endDateExclusive: toInputDate(nextMonthStart),
    })
  const activeLevelsPromise = supabase
      .from('levels')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('id') as unknown as PromiseLike<{ data: ScheduleLevelDefinition[] | null }>

  const teachingDay = await teachingDayPromise
  const studentRefs = Array.from(new Map(teachingDay.slots.flatMap((slot) => (
    slot.students.map((student) => [
      getScheduleStudentKey(student.studentType, student.studentId),
      { studentId: student.studentId, studentType: student.studentType },
    ] as const)
  ))).values())
  const studentIds = studentRefs.map((student) => student.studentId)
  const studentTypes = Array.from(new Set(studentRefs.map((student) => student.studentType)))
  const exactAssignedSlotIds = Array.from(new Set(teachingDay.slots
    .filter((slot) => slot.students.some((student) => Boolean(student.assignmentGroupId)))
    .map((slot) => slot.id)))
  const studentLevelsPromise: PromiseLike<{ data: ScheduleStudentLevelRow[] | null }> = studentIds.length > 0
    ? supabase
        .from('student_levels')
        .select('id, student_id, student_type, level, created_at')
        .in('student_id', studentIds)
        .in('student_type', studentTypes)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) as unknown as PromiseLike<{ data: ScheduleStudentLevelRow[] | null }>
    : Promise.resolve({ data: [] })
  const programsPromise: PromiseLike<{ data: CoachProgramRow[] | null; error: { message: string } | null }> = exactAssignedSlotIds.length > 0
    ? supabase
        .from('teaching_programs')
        .select('id, schedule_slot_id, program_content, status, updated_at')
        .eq('coach_id', user.id)
        .in('schedule_slot_id', exactAssignedSlotIds)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false }) as unknown as PromiseLike<{
          data: CoachProgramRow[] | null
          error: { message: string } | null
        }>
    : Promise.resolve({ data: [], error: null })
  const [monthRows, { data: activeLevelsData }, { data: studentLevelsData }, programResult] = await Promise.all([
    monthRowsPromise,
    activeLevelsPromise,
    studentLevelsPromise,
    programsPromise,
  ])
  if (programResult.error) throw new Error('Coach schedule program read failed')
  const latestStudentLevels = buildLatestScheduleStudentLevelMap(studentLevelsData || [])
  const activeLevelNames = buildActiveScheduleLevelNameMap(activeLevelsData || [])
  const programBySlotId = new Map<string, CoachTodayProgram>()
  ;(programResult.data || []).forEach((program) => {
    if (programBySlotId.has(program.schedule_slot_id)) return
    programBySlotId.set(program.schedule_slot_id, {
      id: program.id,
      programContent: program.program_content,
      status: program.status,
      updatedAt: program.updated_at,
    })
  })

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
                    <span className="flex items-center gap-1">
                      {rows.length > 0 && (
                        <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold leading-5 text-gray-600 sm:hidden">
                          {rows.length}
                        </span>
                      )}
                      {isToday && <span className="h-1.5 w-1.5 rounded-full bg-[#2748bf]" />}
                    </span>
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
          {teachingDay.slots.map((slot) => {
            const levelDetailsBySessionId = new Map(slot.students.map((student) => [
              student.bookingSessionId,
              getScheduleLevelDetails(
                student.studentType,
                student.studentId,
                latestStudentLevels,
                activeLevelNames,
              ),
            ] as const))
            const exactGroupStudents = slot.students.filter((student) => Boolean(student.assignmentGroupId))
            const exactGroupName = exactGroupStudents[0]?.assignmentGroupName || null
            const exactGroupLevelSummary = exactGroupStudents.length > 0
              ? formatCoachAssignedGroupLevelRange(exactGroupStudents.map((student) => (
                  levelDetailsBySessionId.get(student.bookingSessionId)?.level || 0
                )))
              : null
            const teachingProgram = exactGroupName ? programBySlotId.get(slot.id) || null : null
            const slotAttendance = getCoachSlotDisplaySummary({
              hasCheckin: Boolean(slot.checkin),
              studentCount: slot.students.length,
              checkedCount: getCoachSlotCheckedCount(slot.students),
            })
            const checkinBadge = slot.checkin
              ? {
                  label: 'เช็คอินแล้ว',
                  className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  Icon: CheckCircle2,
                }
              : slotAttendance.hasAttendance
                ? {
                    label: slotAttendance.label,
                    className: slotAttendance.color,
                    Icon: CheckCircle2,
                  }
                : {
                    label: 'รอเช็คอิน',
                    className: 'border-orange-200 bg-orange-50 text-orange-700',
                    Icon: Camera,
                  }
            const CheckinIcon = checkinBadge.Icon

            return (
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
                    <Badge variant="outline" className={checkinBadge.className}>
                      <CheckinIcon className="mr-1 h-3.5 w-3.5" />
                      {checkinBadge.label}
                    </Badge>
                    {slotAttendance.isComplete ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        {slotAttendance.label} {slotAttendance.checkedCount}/{slot.students.length}
                      </Badge>
                    ) : slot.students.length > 0 && slot.checkin ? (
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

                  {exactGroupLevelSummary && (
                    <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-indigo-800">{exactGroupLevelSummary}</p>
                      {exactGroupName && (
                        <Badge variant="outline" className="w-fit bg-white text-[10px] text-indigo-700">
                          <Layers3 className="mr-1 h-3 w-3" />
                          {exactGroupName}
                        </Badge>
                      )}
                    </div>
                  )}

                  {teachingProgram && exactGroupName && (
                    <CoachTodayProgramDialog program={teachingProgram} groupName={exactGroupName} />
                  )}

                  {slot.students.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">
                      รอบนี้ยังไม่มีผู้เรียนที่อยู่ในกลุ่มของคุณ
                    </div>
                  ) : (
                    <div className="space-y-2 border-t pt-3">
                      {slot.students.map((student) => {
                        const studentStatus = getStudentScheduleStatus(slot, student)
                        const levelDetails = levelDetailsBySessionId.get(student.bookingSessionId)
                          || { level: 0, levelName: null, label: 'LV 0 / ยังไม่ประเมิน' }

                        return (
                          <div key={student.bookingSessionId} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                            {student.isChild ? <Baby className="h-4 w-4 shrink-0 text-pink-500" /> : <User className="h-4 w-4 shrink-0 text-blue-500" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-gray-900">
                                  {student.isChild ? student.studentNickname || student.studentName : student.studentName}
                                </p>
                                {student.assignmentGroupName && (
                                  <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                                    <Layers3 className="mr-1 h-3 w-3" />
                                    {student.assignmentGroupName}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-white text-[10px] text-indigo-700">
                                  {levelDetails.label}
                                </Badge>
                              </div>
                              {student.parentName && <p className="truncate text-xs text-gray-400">ผู้ปกครอง: {student.parentName}</p>}
                            </div>
                            <Badge className={`text-[10px] ${studentStatus.className}`}>
                              {studentStatus.label}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
