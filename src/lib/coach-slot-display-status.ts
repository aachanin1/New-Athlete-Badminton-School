export type CoachSlotDisplayStatus =
  | 'no_learners'
  | 'needs_checkin'
  | 'checked_in_waiting_attendance'
  | 'partial_attendance'
  | 'attendance_complete'
  | 'resolved_without_checkin'

export type CoachSlotAttendanceValue = 'present' | 'late' | 'absent' | null | undefined

export interface CoachSlotDisplayStatusInput {
  hasCheckin: boolean
  studentCount: number
  checkedCount: number
}

export interface CoachSlotDisplaySummary {
  status: CoachSlotDisplayStatus
  checkedCount: number
  studentCount: number
  hasAttendance: boolean
  isComplete: boolean
  isCheckinGate: boolean
  label: string
  color: string
}

const STATUS_META: Record<CoachSlotDisplayStatus, { label: string; color: string }> = {
  no_learners: {
    label: 'ไม่มีผู้เรียน',
    color: 'border-gray-200 bg-gray-50 text-gray-500',
  },
  needs_checkin: {
    label: 'รอเช็คอิน',
    color: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  checked_in_waiting_attendance: {
    label: 'รอบันทึกผล',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  partial_attendance: {
    label: 'บันทึกผลบางส่วน',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  attendance_complete: {
    label: 'บันทึกผลครบแล้ว',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  resolved_without_checkin: {
    label: 'บันทึกผลแล้ว',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
}

export function getCoachSlotCheckedCount(
  students: { attendanceStatus: CoachSlotAttendanceValue }[],
) {
  return students.filter((student) => Boolean(student.attendanceStatus)).length
}

export function deriveCoachSlotDisplayStatus({
  hasCheckin,
  studentCount,
  checkedCount,
}: CoachSlotDisplayStatusInput): CoachSlotDisplayStatus {
  if (studentCount <= 0) return 'no_learners'

  const hasAttendance = checkedCount > 0
  const isComplete = checkedCount >= studentCount

  if (isComplete) return hasCheckin ? 'attendance_complete' : 'resolved_without_checkin'
  if (!hasCheckin && !hasAttendance) return 'needs_checkin'
  if (!hasAttendance) return 'checked_in_waiting_attendance'

  return 'partial_attendance'
}

export function getCoachSlotDisplaySummary(
  input: CoachSlotDisplayStatusInput,
): CoachSlotDisplaySummary {
  const studentCount = Math.max(0, input.studentCount)
  const checkedCount = Math.min(Math.max(0, input.checkedCount), studentCount)
  const status = deriveCoachSlotDisplayStatus({
    hasCheckin: input.hasCheckin,
    studentCount,
    checkedCount,
  })
  const meta = STATUS_META[status]

  return {
    status,
    checkedCount,
    studentCount,
    hasAttendance: checkedCount > 0,
    isComplete: studentCount > 0 && checkedCount >= studentCount,
    isCheckinGate: status === 'needs_checkin',
    label: meta.label,
    color: meta.color,
  }
}
