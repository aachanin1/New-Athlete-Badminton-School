import { callTask10, type Task10RpcClient } from '@/lib/task10-policy'
import type { KidsMakeupSettings } from '@/lib/kids-makeup-settings'

export interface KidsFamilyMakeupSource {
  sourceSessionId: string
  rootId: string
  bookingId: string
  sourceChildId: string
  sourceDate: string
  kind: 'absent' | 'wallet'
  creditId: string | null
}
export interface KidsFamilyMakeupState {
  active: boolean
  state: 'never_activated' | 'active' | 'paused'
  parentId: string
  sourceMonth: string
  destinationMonth: string
  expiresAt: string
  sourcePurchase: { quantity: number; pendingQuantity: number; awaitingReviewQuantity: number }
  destinationPurchase: { quantity: number; pendingQuantity: number; awaitingReviewQuantity: number }
  minimum: KidsMakeupSettings
  quota: number
  used: number
  remaining: number
  sources: KidsFamilyMakeupSource[]
  children: Array<{ id: string; name: string }>
  eligible: boolean
  reason: string | null
}

export function readKidsFamilyMakeup(client: Task10RpcClient, actorId: string, parentId: string, sourceMonth: string) {
  return callTask10<KidsFamilyMakeupState>(client, 'task10_family_makeup_state_v1', {
    p_actor_id: actorId, p_parent_id: parentId, p_source_month: `${sourceMonth}-01`,
  })
}

export function consumeKidsFamilyMakeup(client: Task10RpcClient, actorId: string, body: Record<string, unknown>) {
  return callTask10<{ success: true; data: { id: string }; remaining: number }>(client, 'task10_consume_family_makeup_v1', {
    p_actor_id: actorId, p_source_session_id: body.original_session_id,
    p_attending_child_id: body.attending_child_id, p_template_id: body.schedule_template_id || null,
    p_branch_id: body.branch_id, p_target_date: body.makeup_date,
    p_start_time: body.start_time, p_end_time: body.end_time, p_request_id: body.request_id,
  })
}

export function familyMakeupReason(state: KidsFamilyMakeupState): string | null {
  const reasons: Record<string, string> = {
    paused: 'ระบบชดเชยคอร์สเด็กหยุดรับรายการใหม่ชั่วคราว',
    expired: 'พ้นเดือนที่ใช้สิทธิ์ชดเชยแล้ว การซื้อเพิ่มไม่ต่ออายุสิทธิ์',
    quota_exhausted: 'ไม่มีโควตาชดเชยเหลือในเดือนต้นทางนี้',
    no_source: 'ไม่มีรายการต้นทางที่ยังใช้ได้ การซื้อเพิ่มไม่ได้สร้างสิทธิ์ต้นทาง',
    destination_minimum: `เดือนปลายทางยืนยันชำระแล้ว ${state.destinationPurchase?.quantity ?? 0} ครั้ง ต้องมีอย่างน้อย ${state.minimum?.minimum ?? '—'} ครั้ง บิลรอชำระหรือรอตรวจยังไม่นับ`,
  }
  return state.reason ? reasons[state.reason] || 'ยังไม่ผ่านเงื่อนไข กรุณาตรวจสอบข้อมูล' : null
}
