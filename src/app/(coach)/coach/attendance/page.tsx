import { AttendanceClient } from '@/components/coach/attendance-client'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

export default async function AttendancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, today)

  const slots = teachingDay.slots
    .filter((slot) => slot.students.length > 0)
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

  return <AttendanceClient slots={slots} />
}
