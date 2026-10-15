import { createHmac, timingSafeEqual } from 'node:crypto'
import { getServiceRoleClient } from '@/lib/auth/admin'

export interface SignedAssignmentContext { data: string; signature: string }
export interface AssignmentSaveContext {
  epoch: string
  version: string
  groups: unknown[]
  rosterSessionIds: string[]
}
function signature(data: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing server signing key')
  return createHmac('sha256', key).update('assignment5:' + data).digest('hex')
}
export function signAssignmentContext(actor: string, slot: string, context: AssignmentSaveContext): SignedAssignmentContext {
  const data = Buffer.from(JSON.stringify({ actor, slot, context })).toString('base64url')
  return { data, signature: signature(data) }
}
export function verifyAssignmentContext(value: SignedAssignmentContext, actor: string, slot: string): AssignmentSaveContext {
  if (!value || typeof value.data !== 'string' || value.data.length > 1_000_000 || !/^[a-f0-9]{64}$/.test(value.signature || '')) throw new Error('Invalid assignment context')
  if (!timingSafeEqual(Buffer.from(signature(value.data), 'hex'), Buffer.from(value.signature, 'hex'))) throw new Error('Invalid assignment context')
  const parsed = JSON.parse(Buffer.from(value.data, 'base64url').toString())
  if (parsed.actor !== actor || parsed.slot !== slot || !Array.isArray(parsed.context?.groups) || !Array.isArray(parsed.context?.rosterSessionIds)) throw new Error('Invalid assignment context')
  return parsed.context
}
export async function readAssignmentContext(actor: string, slot: string) {
  const { data, error } = await getServiceRoleClient().rpc('assignment5_context_v1', { p_slot: slot })
  if (error || !data || !Array.isArray(data.groups) || !Array.isArray(data.rosterSessionIds)) throw new Error('อ่านข้อมูลรอบเรียนไม่สำเร็จ')
  return { context: data as AssignmentSaveContext, signed: signAssignmentContext(actor, slot, data) }
}
