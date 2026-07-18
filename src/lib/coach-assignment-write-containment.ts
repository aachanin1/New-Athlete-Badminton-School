export const COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED = 'COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED'

export const COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED_MESSAGE =
  'ปิดการบันทึกกลุ่มชั่วคราวเพื่อปรับปรุงความปลอดภัย ข้อมูลเดิมยังคงอยู่ กรุณาอย่าสร้างหรือมอบหมายกลุ่มซ้ำ'

export const CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS = [
  'move_learner_to_existing_coach_group',
  'replace_coach_for_past_round',
  'assign_coach_to_round',
  'resolve_unassigned_round',
] as const

export function isCoachAssignmentWriteContainmentEnabled() {
  return true
}

export function isContainedAdminMakeupAssignmentAction(action: unknown) {
  return typeof action === 'string' && CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS.includes(
    action as (typeof CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS)[number]
  )
}

export function getCoachAssignmentWriteContainmentPayload() {
  return {
    code: COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED,
    error: COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED_MESSAGE,
  }
}
