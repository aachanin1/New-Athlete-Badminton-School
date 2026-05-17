import { AttendanceClient } from '@/components/coach/attendance-client'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

interface AttendancePageProps {
  searchParams?: {
    date?: string
    slot?: string
  }
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
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const selectedDate = isValidDateString(searchParams?.date) ? searchParams?.date as string : today
  const selectedSlotId = searchParams?.slot || null
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, selectedDate)

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
