'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatThaiDateTimeWithWeekday, formatThaiDateWithWeekday } from '@/lib/date-format'
import type { ReviewSessionGroup } from '@/lib/admin-makeup-read-model'
import { isNoClassReturnPreview, isNoClassReturnReceipt, noClassReturnUnitLabel, noClassReturnUuid,
  type NoClassReturnPreview, type NoClassReturnReceipt } from '@/lib/no-class-return'

export interface NoClassReturnRequest { key: string; group: ReviewSessionGroup; reason?: string }
interface AttemptReference { requestId: string; anchor: string; month: string; sessionIds: string[]; slotIds: string[]; coachId: string | null }
interface Attempt extends AttemptReference {
  phase: 'preview' | 'ready' | 'blocked' | 'unknown' | 'confirmed' | 'done' | 'failed'
  reason: string
  preview?: NoClassReturnPreview
  receipt?: NoClassReturnReceipt
  message?: string
}
const unresolved = (attempt: Attempt) => attempt.phase === 'unknown' || attempt.phase === 'confirmed'
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const uuidList = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string' && noClassReturnUuid.test(id))
const isReference = (value: unknown): value is AttemptReference => isRecord(value)
  && typeof value.requestId === 'string' && noClassReturnUuid.test(value.requestId)
  && typeof value.anchor === 'string' && noClassReturnUuid.test(value.anchor)
  && typeof value.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)
  && (value.coachId === null || typeof value.coachId === 'string' && noClassReturnUuid.test(value.coachId))
  && uuidList(value.sessionIds) && uuidList(value.slotIds)
const asReference = ({ requestId, anchor, month, sessionIds, slotIds, coachId }: Attempt): AttemptReference => ({ requestId, anchor, month, sessionIds, slotIds, coachId })
const scopeKeys = (rows: AttemptReference[]) => [...new Set(rows.flatMap(row => row.slotIds.map(slot => `${slot}:${row.coachId || 'unassigned'}`)))]

async function send(body: Record<string, unknown>) {
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch('/api/admin/makeup/return-round', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      cache: 'no-store', signal: controller.signal, body: JSON.stringify(body) })
    const data: unknown = await response.json()
    return { response, data }
  } finally { window.clearTimeout(timeout) }
}

export function NoClassReturnDialog({ actor, request, onSavingChange, onBlockedChange, onReturned }: {
  actor: string
  request: NoClassReturnRequest | null
  onSavingChange: (saving: boolean) => void
  onBlockedChange: (sessionIds: string[], scopeKeys: string[]) => void
  onReturned: (anchor: string, month: string) => Promise<boolean>
}) {
  const registry = useRef<Attempt[]>([]), inFlight = useRef(false), handled = useRef('')
  const focusReturn = useRef<HTMLElement | null>(null)
  const latest = useRef({ onSavingChange, onBlockedChange, onReturned })
  useLayoutEffect(() => { latest.current = { onSavingChange, onBlockedChange, onReturned } }, [onSavingChange, onBlockedChange, onReturned])
  const [attempts, setAttempts] = useState<Attempt[]>([]), [activeId, setActiveId] = useState('')
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const storageKey = `nasc-no-class-return-v1:${actor}`
  const persist = useCallback((rows: Attempt[]) => {
    try {
      const references = rows.filter(unresolved).map(asReference)
      if (references.length) sessionStorage.setItem(storageKey, JSON.stringify(references))
      else sessionStorage.removeItem(storageKey)
      return true
    } catch { return false }
  }, [storageKey])
  const publish = useCallback((attempt: Attempt) => {
    const rows = [...registry.current.filter(row => row.requestId !== attempt.requestId), attempt]
    registry.current = rows; setAttempts(rows)
    const blocked = rows.filter(unresolved)
    latest.current.onBlockedChange([...new Set(blocked.flatMap(row => row.sessionIds))], scopeKeys(blocked))
    persist(rows)
  }, [persist])
  useEffect(() => {
    let rows: Attempt[] = []
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
      if (!Array.isArray(raw) || !raw.every(isReference)) throw new Error('Invalid saved requests')
      rows = raw.map(ref => ({ ...ref, phase: 'unknown', reason: '', message: 'มีคำขอเดิมที่ยังต้องตรวจผลจากระบบ' }))
      setStorageError('')
    } catch { setStorageError('อ่านข้อมูลคำขอเดิมในเครื่องไม่ได้ กรุณาตรวจผลจากแท็บเดิมก่อนคืนสิทธิ์เพิ่ม') }
    registry.current = rows; setAttempts(rows); setActiveId(''); setOpen(false); handled.current = ''
    latest.current.onBlockedChange([...new Set(rows.flatMap(row => row.sessionIds))], scopeKeys(rows))
    setLoaded(true)
  }, [storageKey])

  const preview = useCallback(async (attempt: Attempt) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); latest.current.onSavingChange(true)
    publish({ ...attempt, phase: 'preview', message: undefined })
    try {
      const { response, data } = await send({ mode: 'preview', anchor: attempt.anchor })
      if (!response.ok || !isNoClassReturnPreview(data, attempt.anchor)) {
        publish({ ...attempt, phase: 'failed', message: isRecord(data) && typeof data.error === 'string' ? data.error : 'อ่านผลกระทบล่าสุดไม่ได้ กรุณาลองอ่านใหม่' })
        return
      }
      publish({ ...attempt, month: data.date.slice(0, 7), sessionIds: data.targetSessionIds, slotIds: [data.scheduleSlotId], coachId: data.coachId,
        preview: data, phase: data.eligible ? 'ready' : 'blocked' })
    } catch { publish({ ...attempt, phase: 'failed', message: 'อ่านผลกระทบล่าสุดไม่ได้ กรุณาลองอ่านใหม่' }) }
    finally { inFlight.current = false; setBusy(false); latest.current.onSavingChange(false) }
  }, [publish])

  const acceptReceipt = useCallback(async (attempt: Attempt, receipt: NoClassReturnReceipt) => {
    const confirmed: Attempt = { ...attempt, receipt, phase: 'confirmed', message: 'คืนสิทธิ์สำเร็จแล้ว กำลังอ่านคิวล่าสุด' }
    publish(confirmed)
    let refreshed = false
    try { refreshed = await latest.current.onReturned(attempt.anchor, attempt.month) } catch { /* The durable receipt remains confirmed. */ }
    publish({ ...confirmed, phase: refreshed ? 'done' : 'confirmed',
      message: refreshed ? 'คืนสิทธิ์เดิมเข้ากระเป๋าครบแล้ว และอ่านคิวล่าสุดแล้ว' : 'คืนสิทธิ์สำเร็จแล้ว แต่ยังอ่านคิวล่าสุดไม่ได้ กรุณากดอ่านคิวล่าสุด ไม่ต้องส่งคืนซ้ำ' })
  }, [publish])

  const check = useCallback(async (attempt: Attempt) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); latest.current.onSavingChange(true)
    try {
      if (attempt.phase === 'confirmed' && attempt.receipt) { await acceptReceipt(attempt, attempt.receipt); return }
      const { response, data } = await send({ mode: 'status', anchor: attempt.anchor, requestId: attempt.requestId })
      if (response.ok && isNoClassReturnReceipt(data, attempt.requestId, attempt.anchor, attempt.preview)) {
        await acceptReceipt(attempt, data)
      } else if (response.ok && isRecord(data) && data.confirmed === false && data.requestId === attempt.requestId
        && data.definitive === true && data.pending !== true) {
        publish({ ...attempt, phase: 'failed', message: 'ระบบยืนยันว่าไม่มีการคืนสิทธิ์จากคำขอเดิม สามารถอ่านผลกระทบใหม่ก่อนดำเนินการได้' })
      } else {
        publish({ ...attempt, phase: 'unknown', message: isRecord(data) && data.pending === true
          ? 'คำขอเดิมยังทำงานอยู่ กรุณารอสักครู่แล้วตรวจผลเดิมอีกครั้ง'
          : 'ยังตรวจผลคำขอเดิมไม่ได้ กรุณาตรวจซ้ำก่อนคืนสิทธิ์หรือจัดการรอบนี้ต่อ' })
      }
    } catch { publish({ ...attempt, phase: 'unknown', message: 'ยังติดต่อระบบเพื่อตรวจผลเดิมไม่ได้ กรุณาตรวจซ้ำก่อนดำเนินการต่อ' }) }
    finally { inFlight.current = false; setBusy(false); latest.current.onSavingChange(false) }
  }, [acceptReceipt, publish])

  const commit = useCallback(async (attempt: Attempt) => {
    if (inFlight.current || attempt.phase !== 'ready' || !attempt.preview?.eligible || !attempt.reason.trim() || storageError) return
    const sending: Attempt = { ...attempt, phase: 'unknown', message: 'กำลังส่งคำขอคืนสิทธิ์ทั้งรอบ' }
    // Persist only identifiers before dispatch, so a reload can reconcile the original request.
    if (!persist([...registry.current.filter(row => row.requestId !== sending.requestId), sending])) {
      setStorageError('บันทึกเลขคำขอในเครื่องไม่ได้ ยังไม่ได้ส่งคืนสิทธิ์ กรุณาอนุญาตพื้นที่จัดเก็บของเว็บแล้วเปิดหน้านี้ใหม่')
      return
    }
    inFlight.current = true; setBusy(true); latest.current.onSavingChange(true); publish(sending)
    try {
      const { response, data } = await send({ mode: 'commit', anchor: attempt.anchor, requestId: attempt.requestId,
        expected: attempt.preview.scopeFingerprint, reason: attempt.reason.trim() })
      if (response.ok && isNoClassReturnReceipt(data, attempt.requestId, attempt.anchor, attempt.preview)) {
        await acceptReceipt(sending, data)
      } else if (!response.ok && response.status >= 400 && response.status < 500 && isRecord(data) && data.definitive === true) {
        publish({ ...attempt, phase: 'failed', message: typeof data.error === 'string' ? data.error : 'ระบบไม่รับคำขอนี้ กรุณาอ่านผลกระทบล่าสุดก่อนดำเนินการใหม่' })
      } else {
        publish({ ...sending, message: 'ยังยืนยันผลไม่ได้ ระบบอาจคืนสิทธิ์แล้ว กรุณาตรวจผลคำขอเดิมก่อนดำเนินการต่อ' })
      }
    } catch { publish({ ...sending, message: 'การเชื่อมต่อขาดระหว่างรอผล กรุณาตรวจผลคำขอเดิมก่อนดำเนินการต่อ' }) }
    finally { inFlight.current = false; setBusy(false); latest.current.onSavingChange(false) }
  }, [acceptReceipt, persist, publish, storageError])

  useEffect(() => {
    if (!loaded || !request || handled.current === request.key || inFlight.current) return
    handled.current = request.key
    const anchor = request.group.sessions[0]?.id
    if (!anchor) return
    focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const ids = request.group.sessions.map(session => session.id)
    const slots = [...new Set(request.group.sessions.flatMap(session => session.schedule_slot_id ? [session.schedule_slot_id] : []))]
    const coachId = request.group.sessions[0]?.coach_id || null
    const existing = registry.current.find(row => unresolved(row) && (row.sessionIds.some(id => ids.includes(id)) || row.coachId === coachId && row.slotIds.some(id => slots.includes(id))))
    const attempt: Attempt = existing || { requestId: crypto.randomUUID(), anchor, month: request.group.date.slice(0, 7),
      sessionIds: ids, slotIds: slots, coachId, phase: 'preview', reason: request.reason || '' }
    setActiveId(attempt.requestId); setOpen(true)
    if (!existing) void preview(attempt)
  }, [loaded, request, preview])

  const attempt = attempts.find(row => row.requestId === activeId), impact = attempt?.preview
  const pending = attempts.filter(unresolved)
  const close = () => { if (!inFlight.current) setOpen(false) }
  const repreview = () => {
    if (!attempt || unresolved(attempt) || inFlight.current) return
    const next = { ...attempt, requestId: crypto.randomUUID(), preview: undefined, receipt: undefined }
    setActiveId(next.requestId); void preview(next)
  }
  const title = busy ? attempt?.phase === 'preview' ? 'กำลังอ่านผลกระทบล่าสุด' : 'กำลังตรวจผลคืนสิทธิ์'
    : attempt?.phase === 'done' || attempt?.phase === 'confirmed' ? 'คืนสิทธิ์สำเร็จแล้ว'
      : attempt?.phase === 'unknown' ? 'รอตรวจผลคำขอเดิม' : 'ไม่ได้เปิดสอน / คืนสิทธิ์'

  return <>
    {storageError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{storageError}</p> : null}
    {pending.length > 0 && !open ? <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p>มีคำขอคืนสิทธิ์ที่ต้องตรวจผลหรืออ่านคิวล่าสุดก่อนจัดการรอบนั้นต่อ</p>
      {pending.map(row => <Button key={row.requestId} variant="outline" disabled={busy} className="h-auto max-w-full whitespace-normal" onClick={() => {
        focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setActiveId(row.requestId); setOpen(true)
      }}>ตรวจคำขอเดิม · เดือน {row.month} · {row.requestId.slice(0, 8)}</Button>)}
    </div> : null}
    <Dialog open={open && Boolean(attempt)} onOpenChange={value => { if (!value) close() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" onEscapeKeyDown={event => { if (busy) event.preventDefault() }}
        onInteractOutside={event => { if (busy) event.preventDefault() }} onCloseAutoFocus={event => {
          event.preventDefault()
          ;(focusReturn.current?.isConnected ? focusReturn.current : document.querySelector<HTMLElement>('[role="tab"][data-state="active"]'))?.focus({ preventScroll: true })
        }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{impact
          ? `${formatThaiDateWithWeekday(impact.date)} · ${impact.startTime.slice(0, 5)}–${impact.endTime.slice(0, 5)} · ${impact.branchName} · ${impact.coachName || 'ยังไม่มีโค้ช'}`
          : 'ตรวจผลจากระบบก่อนยืนยันคืนสิทธิ์ทั้งรอบ'}</DialogDescription></DialogHeader>
        {attempt ? <div aria-live="polite" className="space-y-4">
          {attempt.message ? <p role={attempt.phase === 'failed' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${attempt.receipt ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{attempt.message}</p> : null}
          {impact && !attempt.receipt ? <>
            <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">คืนสิทธิ์เดิมเข้ากระเป๋า · คงวันหมดอายุเดิม</p>
              <p>ไม่เช็คผู้เรียนขาด และไม่นับชั่วโมงโค้ชในรอบนี้ (0 ชั่วโมง)</p>
              <p>รายชื่อล่าสุดในขอบเขตรอบนี้ {impact.targetCount} คน · {impact.units.length} หน่วยสิทธิ์</p>
            </div>
            {impact.units.map(unit => <div key={unit.unitId} className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-semibold">{noClassReturnUnitLabel(unit)} · หมดอายุ {formatThaiDateTimeWithWeekday(unit.expiresAt)}</p>
              {unit.expirySource ? <p className="text-xs text-gray-600">{unit.expirySource === 'stored_credit'
                ? 'ใช้วันหมดอายุที่บันทึกในเครดิตต้นทางเดิม'
                : 'รอบนี้ยังไม่เคยเก็บเข้ากระเป๋า ใช้สิ้นเดือนของรอบเดิมตามกติกาคืนสิทธิ์'}</p> : null}
              {impact.sessions.filter(session => session.unitId === unit.unitId).map(session => <p key={session.sessionId} className="break-words">
                <strong>{session.learnerName}</strong><span className="text-gray-600"> · ผู้ปกครอง / ผู้ใช้ {session.parentName}</span>
              </p>)}
              {unit.sessionIds.length > 1 ? <p className="text-xs text-gray-600">ใช้สิทธิ์ร่วมกัน คืนจำนวนข้างต้นเพียงครั้งเดียวสำหรับรายชื่อชุดนี้</p> : null}
            </div>)}
            {impact.sessions.filter(session => !impact.units.some(unit => unit.unitId === session.unitId)).map(session => <p key={session.sessionId} className="rounded-lg border p-3 text-sm"><strong>{session.learnerName}</strong> · ผู้ปกครอง / ผู้ใช้ {session.parentName}</p>)}
            {impact.blockers.length ? <div role="alert" className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-800"><p className="font-semibold">ยังคืนสิทธิ์รอบนี้ไม่ได้</p>{impact.blockers.map((blocker, index) => <p key={`${blocker.code}-${index}`}>{blocker.message}</p>)}</div> : null}
            {attempt.phase === 'ready' ? <div className="space-y-2"><label htmlFor="no-class-return-reason" className="text-sm font-semibold">เหตุผลที่ไม่ได้เปิดสอน</label>
              <Textarea id="no-class-return-reason" value={attempt.reason} maxLength={2000} disabled={busy} onChange={event => publish({ ...attempt, reason: event.target.value })} placeholder="ระบุเหตุผลเพื่อเก็บไว้ในประวัติ" /></div> : null}
          </> : null}
          {attempt.receipt ? <div className="space-y-3 text-sm">
            <p className="font-semibold">คืนครบ {attempt.receipt.targetCount} คน · ชั่วโมงโค้ช 0 ชั่วโมง</p>
            {attempt.receipt.credits.map(credit => <div key={credit.creditId} className="space-y-1 rounded-lg border p-3">
              <p className="font-semibold">{noClassReturnUnitLabel(credit)}</p><p>หมดอายุเดิม {formatThaiDateTimeWithWeekday(credit.expiresAt)}</p>
              <p className="break-all text-xs text-gray-600">เลขเครดิต {credit.creditId}</p>
            </div>)}
            <p>บันทึกแล้ว {formatThaiDateTimeWithWeekday(attempt.receipt.recordedAt)}</p>
          </div> : null}
          {unresolved(attempt) ? <p className="break-all text-xs text-gray-600">เลขคำขอเดิม {attempt.requestId} · รายการอื่นของรอบนี้จะรอตรวจผลก่อน</p> : null}
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>ปิด</Button>
            {attempt.phase === 'ready' ? <Button className="h-auto whitespace-normal" disabled={busy || !attempt.reason.trim() || Boolean(storageError)} onClick={() => void commit(attempt)}>ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์</Button>
              : unresolved(attempt) ? <Button disabled={busy} onClick={() => void check(attempt)}>{busy ? 'กำลังตรวจผล...' : attempt.phase === 'confirmed' ? 'อ่านคิวล่าสุด' : 'ตรวจสอบผลคำขอเดิม'}</Button>
                : attempt.phase === 'failed' || attempt.phase === 'blocked' ? <Button disabled={busy} onClick={repreview}>อ่านผลกระทบล่าสุด</Button> : null}
          </div>
        </div> : null}
      </DialogContent>
    </Dialog>
  </>
}
