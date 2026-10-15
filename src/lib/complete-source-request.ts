'use client'

export class SourceRequestPending extends Error {}
export interface SourceRequestResult {
  success?: boolean
  confirmed?: boolean
  code?: string
  error?: string
  [key: string]: unknown
}

// One foreground intent owns the entire budget. Reconnect/reload can read its
// result, but only this live call can create retries, using the captured payload.
export async function completeSourceRequest({ url, readUrl, body, retryCode, deadline, signal, initialRead = false, prepare = false }:
  { url: string; readUrl: string; body: unknown; retryCode: string; deadline: number; signal: AbortSignal; initialRead?: boolean; prepare?: boolean }) {
  let writes = 0
  let needsRead = initialRead
  let needsPrepare = prepare
  let uncertain = false
  while (Date.now() < deadline && !signal.aborted) {
    try {
      const timeout = Math.max(1, Math.min(5000, deadline - Date.now()))
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      if (needsRead) {
        const response = await fetch(readUrl, { cache: 'no-store', signal: requestSignal })
        const result = await response.json() as SourceRequestResult
        if (!response.ok || typeof result.confirmed !== 'boolean') throw new Error('Read unavailable')
        if (result.confirmed) return { ...result, success: true }
        if (result.inFlight) throw new Error('Original request still running')
        if (prepare) needsPrepare = !result.admitted
        if (writes >= 3) throw new SourceRequestPending()
        needsRead = false
      } else if (needsPrepare) {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body as Record<string, unknown>, prepare: true }), signal: requestSignal })
        const result = await response.json() as SourceRequestResult
        if (response.ok && result.admitted) { needsPrepare = false; continue }
        if (response.status < 500 && result.code !== retryCode) return result
        needsRead = true
      } else {
        if (writes >= 3) throw new SourceRequestPending()
        writes++
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal })
        const result = await response.json() as SourceRequestResult
        if (response.ok && result.success === true) return result
        if (result.code === retryCode) {
          // The RPC explicitly aborted: safe whole-request retry, same intent.
          if (writes === 3) { if (uncertain) throw new SourceRequestPending(); return result }
        } else if (response.status < 500 && !uncertain) return result
        else { needsRead = true; uncertain = true }
      }
    } catch (error) {
      if (error instanceof SourceRequestPending || signal.aborted) throw new SourceRequestPending()
      if (writes > 0) uncertain = true
      needsRead = true
    }
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, Math.min(600, Math.max(1, deadline - Date.now())))
      signal.addEventListener('abort', finish, { once: true })
    })
  }
  throw new SourceRequestPending()
}

const pendingMemory = new Map<string, string>()
export function pendingStorageKey(actor: string, kind: string, unit?: string) { return `nasc:pending:v2:${actor}:${kind}${unit ? ':' + unit : ''}` }
export function pendingEntries<T>(actor: string, kind: string) {
  const prefix = pendingStorageKey(actor, kind) + ':'
  const keys = new Set(pendingMemory.keys())
  try { Object.keys(sessionStorage).forEach(key => keys.add(key)) } catch { /* Use this page's captured requests. */ }
  return [...keys].filter(key => key.startsWith(prefix)).map(key => ({ key, value: readPending<T>(key) })).filter((entry): entry is { key: string; value: T } => entry.value !== null)
}
export function storePending(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  pendingMemory.set(key, serialized)
  try { sessionStorage.setItem(key, serialized) } catch { /* Keep the live page functional when storage is unavailable. */ }
}
export function readPending<T>(key: string): T | null {
  try { return JSON.parse(pendingMemory.get(key) || sessionStorage.getItem(key) || 'null') as T | null } catch { return null }
}
export function clearPending(key: string) {
  pendingMemory.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* Optional browser persistence. */ }
}
