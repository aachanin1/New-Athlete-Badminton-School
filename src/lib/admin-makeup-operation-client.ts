// Client-safe recovery references contain no learner data or internal reason.
export type MakeupOperationKind = 'store' | 'approval' | 'use'
export interface MakeupOperationResolution {
  kind: MakeupOperationKind; payload: Record<string, unknown>
  context?: { parentId: string; childId: string; sourceMonth: string; sourceSessionId: string } | null
}
export const makeupPendingKey = 'nasc-admin-makeup-pending-v8'
export const makeupPendingEvent = 'nasc-admin-makeup-pending-change'
export const makeupOperationRoute = { store: '/api/admin/makeup/lessons', approval: '/api/admin/makeup/credit-approval', use: '/api/admin/makeup/kids-family' }
export function rememberMakeupOperation(kind: MakeupOperationKind, requestId: string) {
  sessionStorage.setItem(makeupPendingKey, JSON.stringify({ kind, requestId }))
}
export function forgetMakeupOperation(requestId: string) {
  try { const prior = JSON.parse(sessionStorage.getItem(makeupPendingKey) || 'null'); if (prior?.requestId === requestId) sessionStorage.removeItem(makeupPendingKey) } catch { /* no persisted reference */ }
  window.dispatchEvent(new Event(makeupPendingEvent))
}
export async function sendMakeupOperation(kind: MakeupOperationKind, payload: Record<string, unknown>, readOnly = false, deadline = Date.now() + 20000) {
  const signal = () => AbortSignal.timeout(Math.max(1, deadline - Date.now()))
  if (!readOnly) {
    // Save the private replay envelope before attempting any business mutation.
    // If this preparation response is lost, no mutation has been dispatched.
    const prepared = await fetch('/api/admin/makeup/credit-operation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: signal(), body: JSON.stringify({ kind, payload }) })
    const data = await prepared.json()
    if (!prepared.ok || data.prepared !== true) return { response: prepared, data }
    rememberMakeupOperation(kind, String(payload.request_id))
  }
  const response = await fetch(makeupOperationRoute[kind], { method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: signal(), body: JSON.stringify({ ...payload, ...(readOnly ? { read_only: true } : {}) }) })
  const data = await response.json()
  return { response, data }
}
