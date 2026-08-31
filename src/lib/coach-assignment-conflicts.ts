import type { SupabaseClient } from '@supabase/supabase-js'

export interface CoachAssignmentConflictRow {
  group_id: string
  schedule_slot_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  branch_name: string
  course_name: string | null
  group_name: string
  active_learner_count: number
}

export interface LegacyCoachAssignmentWarningRow {
  assignment_id: string
  schedule_slot_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  branch_name: string
  course_name: string | null
}

export interface CoachAssignmentConflictResult {
  exactConflicts: CoachAssignmentConflictRow[]
  legacyWarnings: LegacyCoachAssignmentWarningRow[]
}

function shortTime(value: string) {
  return value.slice(0, 5)
}

function formatThaiDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export async function checkCoachAssignmentConflicts({
  supabase,
  coachId,
  scheduleSlotId,
  excludeGroupIds = [],
  replaceCurrentSlot = false,
}: {
  supabase: SupabaseClient
  coachId: string
  scheduleSlotId: string
  excludeGroupIds?: string[]
  replaceCurrentSlot?: boolean
}): Promise<CoachAssignmentConflictResult> {
  const { data, error } = await supabase.rpc('get_coach_assignment_conflicts_v1', {
    p_coach_id: coachId,
    p_schedule_slot_id: scheduleSlotId,
    p_exclude_group_ids: excludeGroupIds,
    p_replace_current_slot: replaceCurrentSlot,
  })

  if (error) throw new Error(error.message)

  const result = (data || {}) as {
    exact_conflicts?: CoachAssignmentConflictRow[]
    legacy_warnings?: LegacyCoachAssignmentWarningRow[]
  }

  return {
    exactConflicts: Array.isArray(result.exact_conflicts) ? result.exact_conflicts : [],
    legacyWarnings: Array.isArray(result.legacy_warnings) ? result.legacy_warnings : [],
  }
}

export function formatExactCoachConflict(conflict: CoachAssignmentConflictRow) {
  return `บันทึกไม่ได้: โค้ชคนนี้รับผิดชอบกลุ่มอื่นที่เวลาทับกัน วันที่ ${formatThaiDate(conflict.date)} เวลา ${shortTime(conflict.start_time)}–${shortTime(conflict.end_time)} สาขา ${conflict.branch_name} กลุ่ม ${conflict.group_name} (${conflict.group_id})`
}

export function formatLegacyCoachWarnings(warnings: LegacyCoachAssignmentWarningRow[]) {
  if (warnings.length === 0) return null
  const first = warnings[0]
  const suffix = warnings.length > 1 ? ` และอีก ${warnings.length - 1} รายการ` : ''
  return `คำเตือน: พบข้อมูลโค้ชเดิมของรอบที่เวลาทับกัน วันที่ ${formatThaiDate(first.date)} เวลา ${shortTime(first.start_time)}–${shortTime(first.end_time)} สาขา ${first.branch_name}${suffix} ข้อมูลนี้ยังไม่ใช่ผู้รับผิดชอบกลุ่มและไม่ได้ห้ามการบันทึก`
}

export function formatCoachAssignmentDatabaseError(message: string) {
  const conflictPrefix = message.includes('ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|')
    ? 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|'
    : message.includes('COACH_ASSIGNMENT_CONFLICT|')
      ? 'COACH_ASSIGNMENT_CONFLICT|'
      : null

  if (!conflictPrefix) return null

  const conflictMessage = message.slice(message.indexOf(conflictPrefix))
  const [, date, startTime, endTime, branchName, groupName, groupId] = conflictMessage.split('|')
  if (!groupId) {
    return 'บันทึกไม่ได้: มีคำสั่งอื่นมอบหมายโค้ชคนนี้ในช่วงเวลาทับกัน กรุณารีเฟรชแล้วตรวจสอบอีกครั้ง'
  }

  return `บันทึกไม่ได้: โค้ชคนนี้รับผิดชอบกลุ่มอื่นที่เวลาทับกัน วันที่ ${formatThaiDate(date)} เวลา ${shortTime(startTime)}–${shortTime(endTime)} สาขา ${branchName} กลุ่ม ${groupName} (${groupId})`
}

export interface AdminRetrospectiveAssignmentConflict {
  code:
    | 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT'
    | 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT'
    | 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE'
    | 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE'
    | 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT'
  error: string
}

export function getAdminRetrospectiveAssignmentConflict(
  message: string,
): AdminRetrospectiveAssignmentConflict | null {
  if (message.includes('ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|')) {
    return {
      code: 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT',
      error: formatCoachAssignmentDatabaseError(message)
        || 'บันทึกไม่ได้: โค้ชคนนี้มีรอบสอนที่เวลาทับกัน กรุณารีเฟรชแล้วตรวจสอบอีกครั้ง',
    }
  }

  const conflicts: Array<AdminRetrospectiveAssignmentConflict> = [
    {
      code: 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT',
      error: 'รายชื่อผู้เรียนหรือกลุ่มไม่ตรงกับข้อมูลล่าสุด กรุณารีเฟรชและเลือกรายการทั้งกลุ่มอีกครั้ง',
    },
    {
      code: 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT',
      error: 'สถานะรอบเรียน การจอง หรือเส้นทางดำเนินการเปลี่ยนแล้ว กรุณารีเฟรชและตรวจสอบอีกครั้ง',
    },
    {
      code: 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE',
      error: 'พบข้อมูลผู้เรียนหรือหลักฐานซ้ำ ระบบยังไม่ได้บันทึก กรุณารีเฟรชและตรวจสอบข้อมูล',
    },
    {
      code: 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE',
      error: 'ข้อมูลกลุ่มเปลี่ยนระหว่างดำเนินการ ระบบยังไม่ได้บันทึก กรุณารีเฟรชแล้วลองใหม่',
    },
  ]

  return conflicts.find((conflict) => message.includes(`${conflict.code}|`)) || null
}
