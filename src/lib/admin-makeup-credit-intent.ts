import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { callTask10, Task10Error, task10RpcError } from '@/lib/task10-policy'
import { adminMakeupStorePolicy } from '@/lib/admin-makeup-store-policy'

export type MakeupIntentKind = 'store' | 'approval' | 'use'
export async function assertMakeupWriterReady(client: SupabaseClient, actorId: string, storeOnce = false) {
  if (!await callTask10<boolean>(client, storeOnce ? 'admin_makeup_store_once_ready_v1' : 'admin_makeup_credit_ready_v1', { p_actor: actorId })) {
    throw new Task10Error('TASK10_UNAVAILABLE', 'ระบบกำลังตรวจความพร้อม กรุณาตรวจผลคำขอเดิมหรือลองใหม่ภายหลัง', 503)
  }
}
export async function assertStoreRequestPolicy(client: SupabaseClient, actorId: string, payload: Record<string, unknown>) {
  if (payload.store_policy === adminMakeupStorePolicy && payload.approve_credit === undefined) return
  // A committed v8 request retains its original payload/fingerprint on replay.
  // An old tab may not start a new Store under changed consent semantics.
  const { data, error } = await client.from('admin_makeup_store_requests').select('request_id').eq('actor_id', actorId).eq('request_id', String(payload.request_id || '')).maybeSingle()
  if (error) throw task10RpcError()
  if (!data) throw task10RpcError('TASK10_STORE_REFRESH_REQUIRED')
}
export async function readMakeupIntent(client: SupabaseClient, actorId: string, requestId: string) {
  const { data, error } = await client.from('admin_makeup_credit_intents').select('kind,payload,fingerprint,settled_at')
    .eq('actor_id', actorId).eq('request_id', requestId).maybeSingle()
  if (error) throw task10RpcError()
  return data as { kind: MakeupIntentKind; payload: Record<string, unknown>; fingerprint: string; settled_at: string | null } | null
}
export async function prepareMakeupIntent(client: SupabaseClient, actorId: string, kind: MakeupIntentKind, payload: Record<string, unknown>, readOnly = false) {
  const allowed = kind === 'approval' ? ['credit_id', 'request_id', 'operation', 'reason'] : kind === 'store'
    ? ['session_id', 'operation', 'request_id', 'reason', 'approve_credit', 'store_policy', 'target_date', 'start_time', 'end_time', 'branch_id', 'template_id']
    : ['parent_id', 'source_month', 'original_session_id', 'attending_child_id', 'schedule_template_id', 'branch_id', 'makeup_date', 'start_time', 'end_time', 'request_id', 'reason']
  const body = Object.fromEntries(allowed.filter(key => payload[key] !== undefined).map(key => [key, payload[key]]))
  if (JSON.stringify(body).length > 8000) throw task10RpcError('TASK10_INVALID_REQUEST')
  const requestId = String(body.request_id || '')
  const fingerprint = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b))))).digest('hex')
  if (!readOnly) {
    const { error } = await client.from('admin_makeup_credit_intents').insert({ actor_id: actorId, request_id: requestId, kind, payload: body, fingerprint })
    if (error && error.code !== '23505') throw task10RpcError()
  }
  const prior = await readMakeupIntent(client, actorId, requestId)
  if (prior && (prior.kind !== kind || prior.fingerprint !== fingerprint)) throw task10RpcError('TASK10_IDEMPOTENCY_CONFLICT')
  return prior
}
export async function settleMakeupIntent(client: SupabaseClient, actorId: string, requestId: string) {
  // Reconciliation bookkeeping cannot invalidate an already committed right.
  await client.from('admin_makeup_credit_intents').update({ settled_at: new Date().toISOString() }).eq('actor_id', actorId).eq('request_id', requestId)
}
