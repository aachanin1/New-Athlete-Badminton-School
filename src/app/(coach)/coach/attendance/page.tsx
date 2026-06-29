import { AttendanceClient } from '@/components/coach/attendance-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { getAdminReturnedAttendanceSlotIds } from '@/lib/coach-attendance-review'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { formatThaiDateWithWeekday } from '@/lib/date-format'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

interface AttendancePageProps {
  searchParams?: Promise<{
    date?: string
    slot?: string
  }>
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateString(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && value === toInputDate(parsed)
}

function formatDateLabel(date: string) {
  return formatThaiDateWithWeekday(date)
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const resolvedSearchParams = await searchParams
  const today = getBangkokDateString()
  const selectedDate = isValidDateString(resolvedSearchParams?.date) ? resolvedSearchParams?.date as string : today
  const selectedSlotId = resolvedSearchParams?.slot || null
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, selectedDate)
  const adminReturnedSlotIds = await getAdminReturnedAttendanceSlotIds(
    getServiceRoleClient(),
    user.id,
    teachingDay.slots.map((slot) => slot.id),
  )

  const slots = teachingDay.slots
    .filter((slot) => slot.students.length > 0)
    .filter((slot) => !selectedSlotId || slot.id === selectedSlotId)
    .map((slot) => ({
      key: slot.id,
      scheduleSlotId: slot.id,
      branchName: slot.branchName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseType: slot.courseType,
      checkin: slot.checkin,
      canRetroactiveCheckin: adminReturnedSlotIds.has(slot.id),
      students: slot.students.map((student) => ({
        bookingSessionId: student.bookingSessionId,
        studentId: student.studentId,
        studentType: student.studentType,
        studentName: student.studentName,
        parentName: student.parentName,
        isChild: student.isChild,
        branchName: slot.branchName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        courseType: slot.courseType,
        assignmentGroupName: student.assignmentGroupName,
        attendanceStatus: student.attendanceStatus,
      })),
    }))

  return (
    <AttendanceClient
      slots={slots}
      selectedDate={selectedDate}
      selectedDateLabel={formatDateLabel(selectedDate)}
      selectedSlotId={selectedSlotId}
      today={today}
      totalDaySlots={teachingDay.slots.filter((slot) => slot.students.length > 0).length}
    />
  )
}
