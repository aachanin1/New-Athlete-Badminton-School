'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { forgetMakeupOperation, makeupPendingEvent, makeupPendingKey, sendMakeupOperation, type MakeupOperationKind, type MakeupOperationResolution } from '@/lib/admin-makeup-operation-client'

export function MakeupOperationRecovery({ onResolved, onBlockedChange }: { onResolved: (resolution?: MakeupOperationResolution) => void; onBlockedChange: (blocked: boolean) => void }) {
  const [pending, setPending] = useState<{ kind: MakeupOperationKind; requestId: string } | null>(null)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [notRecorded, setNotRecorded] = useState(false)
  const [settledError, setSettledError] = useState('')
  const context = useRef<MakeupOperationResolution['context']>(null)
  const inFlight = useRef(false)
  useEffect(() => {
    // Only recover an interrupted mount; live components own their own modal.
    try {
      const ref = JSON.parse(sessionStorage.getItem(makeupPendingKey) || 'null')
      if (ref && ['store', 'approval', 'use'].includes(ref.kind) && /^[0-9a-f-]{36}$/i.test(ref.requestId)) { setPending(ref); onBlockedChange(true) }
    } catch { /* malformed client state has no authority */ }
    const cleared = () => { if (!sessionStorage.getItem(makeupPendingKey)) { setPending(null); onBlockedChange(false) } }
    window.addEventListener(makeupPendingEvent, cleared)
    return () => window.removeEventListener(makeupPendingEvent, cleared)
  }, [onBlockedChange])
  const reconcile = useCallback(async (write = false) => {
    if (!pending || inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage('กำลังตรวจคำขอเดิม...')
    const deadline = Date.now() + 20000
    try {
      let original = payload
      if (!original) {
        const response = await fetch('/api/admin/makeup/credit-operation?' + new URLSearchParams({ request: pending.requestId }), { cache: 'no-store', signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) })
        const data = await response.json()
        if (!response.ok) throw Error(data.error || 'ยังอ่านคำขอเดิมไม่ได้')
        if (!data.found) {
          // Every v8 mutation is preceded by a committed private envelope. A
          // reference absent for this actor cannot resume a business mutation.
          forgetMakeupOperation(pending.requestId); setPending(null); onBlockedChange(false); onResolved(); return
        }
        if (data.kind !== pending.kind) throw Error('ประเภทคำขอเดิมไม่ตรงกัน กรุณาตรวจรายการล่าสุด')
        original = data.payload as Record<string, unknown>; setPayload(original); context.current = data.context || null
      }
      const { response, data } = await sendMakeupOperation(pending.kind, original, !write, deadline)
      if (!response.ok) {
        if (write && response.status >= 400 && response.status < 500 && data.code && !['TASK10_IDEMPOTENCY_CONFLICT', 'TASK10_UNAVAILABLE', 'LESSON_SOURCE_RETRY', 'LESSON_SOURCE_FAILED'].includes(data.code)) {
          setSettledError(data.error || 'คำขอเดิมไม่สำเร็จ กรุณาตรวจรายการล่าสุด'); forgetMakeupOperation(pending.requestId); setPending(null); onBlockedChange(false); onResolved(); return
        }
        throw Error(data.error || 'ยังยืนยันผลไม่ได้')
      }
      const confirmed = pending.kind === 'store' ? data.result && data.result.confirmed !== false && data.result.credit_id : pending.kind === 'use' ? data.success && data.data?.id : data.confirmed
      if (!confirmed) { setNotRecorded(true); setMessage('ตรวจแล้ว ยังไม่พบผลยืนยัน สามารถลองบันทึกคำขอเดิมได้'); return }
      forgetMakeupOperation(pending.requestId); setPending(null); onBlockedChange(false); onResolved({ kind: pending.kind, payload: original, context: context.current })
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'ยังตรวจผลเดิมไม่ได้') }
    finally { inFlight.current = false; setBusy(false) }
  }, [pending, payload, onBlockedChange, onResolved])
  const autoRead = useRef('')
  useEffect(() => { if (pending && autoRead.current !== pending.requestId) { autoRead.current = pending.requestId; void reconcile() } }, [pending, reconcile])
  if (!pending) return settledError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{settledError}<Button variant="outline" className="ml-2" onClick={() => setSettledError('')}>ปิด</Button></div> : null
  return <section role="status" aria-label="คำขอที่ต้องตรวจผลเดิม" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><h2 className="font-semibold">มีคำขอเดิมที่ยังต้องตรวจสอบผล</h2><p>{message || 'กำลังอ่านคำขอเดิม โดยไม่สร้างสิทธิ์เพิ่ม'}</p><p className="break-all">รหัสอ้างอิง {pending.requestId}</p><Button disabled={busy} onClick={() => void reconcile(notRecorded)}>{busy ? 'กำลังตรวจสอบ...' : notRecorded ? 'ลองบันทึกคำขอเดิม' : 'ตรวจสอบผลเดิม'}</Button></section>
}
