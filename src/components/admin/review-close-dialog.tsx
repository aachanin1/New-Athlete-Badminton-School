'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatThaiDateWithWeekday } from '@/lib/date-format'
import { isReviewOrEvidenceSession, type BookingSessionData, type ReviewSessionGroup } from '@/lib/admin-makeup-read-model'

export interface ReviewCloseRequest { key: string; group: ReviewSessionGroup; reason: string; confirmed?: boolean }
type CloseStatus = 'pending' | 'done' | 'failed' | 'unknown'
interface CloseRow { session: BookingSessionData; requestId: string; status: CloseStatus; message?: string; closedAt?: string }
interface Batch { id: string; group: ReviewSessionGroup; reason: string; rows: CloseRow[]; attempted: boolean }
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function ReviewCloseImpact({ sessions }: { sessions: BookingSessionData[] }) {
  return <div className="space-y-3 text-sm">
    <p className="font-semibold">รายการที่จะปิด {sessions.length} คน</p>
    <div className="divide-y rounded-lg border">{sessions.map(s => <div key={s.id} className="flex flex-wrap justify-between gap-1 p-3"><strong>{s.learner_name}</strong><span className="text-gray-600">ผู้ปกครอง / ผู้ใช้ {s.user_name}</span></div>)}</div>
    <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-blue-900"><p className="font-semibold">หลังยืนยัน</p><p>นำเฉพาะรายการที่ปิดสำเร็จออกจากแท็บต้องตรวจสอบ และบันทึกผู้ดำเนินการกับเหตุผลไว้</p><p>การปิดเคสไม่ลบรอบเรียน ไม่เปลี่ยนผลเช็คชื่อ และไม่เก็บกระเป๋าหรือสร้างสิทธิ์ชดเชย</p><p>สิทธิ์เดิมที่มีหลักฐานอยู่ยังเป็นไปตามกฎเดิม</p></div>
    <p className="text-gray-600">หน้านี้ยังไม่มีคำสั่งเปิดเคสกลับ กรุณาตรวจรายชื่อก่อนยืนยัน</p>
  </div>
}

export function ReviewCloseDialog({ request, onSavingChange, onClosed, onBlockedChange }: {
  request: ReviewCloseRequest | null; onSavingChange: (saving: boolean) => void
  onClosed: (rows: Array<{ id: string; closedAt: string }>) => void; onBlockedChange: (ids: string[]) => void
}) {
  const registry = useRef<Batch[]>([]), inFlight = useRef(false), handled = useRef(''), focusReturn = useRef<HTMLElement | null>(null)
  const [batches, setBatches] = useState<Batch[]>([]), [activeId, setActiveId] = useState(''), [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'result'>('confirm'), [busy, setBusy] = useState(false)
  const publish = useCallback((batch: Batch) => {
    registry.current = [...registry.current.filter(b => b.id !== batch.id), batch]
    setBatches(registry.current)
    onBlockedChange(registry.current.flatMap(b => b.rows.filter(r => r.status === 'unknown').map(r => r.session.id)))
  }, [onBlockedChange])
  const execute = useCallback(async (batch: Batch, readOnly = false) => {
    if (inFlight.current) return
    if (!readOnly && batch.rows.some(r => r.status === 'unknown')) { setPhase('result'); return }
    inFlight.current = true; setBusy(true); onSavingChange(true); setPhase('result')
    let current: Batch = { ...batch, attempted: true, rows: batch.rows.map(r => ({ ...r })) }
    const confirmed: Array<{ id: string; closedAt: string }> = []
    try {
      for (let index = 0; index < current.rows.length; index++) {
        const row = current.rows[index]
        if (row.status === 'done' || readOnly && row.status !== 'unknown') continue
        const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000)
        try {
          const response = await fetch('/api/admin/makeup/review-close', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            signal: controller.signal, body: JSON.stringify({ session: row.session.id, requestId: row.requestId, reason: batch.reason, readOnly }) })
          const result = await response.json()
          if (response.ok && result.confirmed === true && result.sessionId === row.session.id && result.requestId === row.requestId
            && uuid.test(result.auditId || '') && typeof result.closedAt === 'string' && Number.isFinite(Date.parse(result.closedAt))) {
            row.status = 'done'; row.closedAt = result.closedAt; row.message = 'ปิดเคสสำเร็จ · บันทึกผลแล้ว'
            confirmed.push({ id: row.session.id, closedAt: result.closedAt })
          } else if (readOnly && response.ok && result.confirmed === false && result.sessionId === row.session.id && result.requestId === row.requestId) {
            row.status = 'failed'; row.message = 'ยังไม่พบการปิดเคสจากคำขอเดิม'
          } else {
            row.status = !readOnly && !response.ok && response.status >= 400 && response.status < 500 && result.definitive === true ? 'failed' : 'unknown'
            row.message = result.error || (row.status === 'failed' ? 'ปิดเคสไม่สำเร็จ' : 'ยังยืนยันผลไม่ได้ · รอตรวจสอบคำขอเดิม')
          }
        } catch { row.status = 'unknown'; row.message = 'ยังยืนยันผลไม่ได้ · รอตรวจสอบคำขอเดิม' }
        finally { window.clearTimeout(timeout) }
        current = { ...current, rows: current.rows.map(r => ({ ...r })) }; publish(current)
        if (!readOnly && row.status !== 'done') break
      }
    } finally {
      publish(current)
      if (confirmed.length) onClosed(confirmed)
      inFlight.current = false; setBusy(false); onSavingChange(false)
    }
  }, [onSavingChange, onClosed, publish])
  useEffect(() => {
    if (!request || handled.current === request.key) return
    handled.current = request.key
    const sessions = request.group.sessions.filter(isReviewOrEvidenceSession)
    if (!sessions.length) return
    focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const existing = registry.current.find(b => b.attempted && b.rows.some(row => row.status !== 'done' && sessions.some(s => s.id === row.session.id)))
    const batch = existing || { id: request.key, group: request.group, reason: request.reason, attempted: false,
      rows: sessions.map(session => ({ session, requestId: crypto.randomUUID(), status: 'pending' as const })) }
    publish(batch); setActiveId(batch.id); setOpen(true); setPhase(existing?.rows.some(r => r.status === 'unknown') ? 'result' : 'confirm')
    if (request.confirmed && !existing) void execute(batch)
  }, [request, execute, publish])
  const batch = batches.find(b => b.id === activeId), remaining = batch?.rows.filter(r => r.status !== 'done') || []
  const done = (batch?.rows.length || 0) - remaining.length, unknown = remaining.some(r => r.status === 'unknown')
  const title = phase === 'confirm' ? 'ยืนยันปิดเคสทั้งรอบ' : busy ? 'กำลังตรวจผลปิดเคส' : !remaining.length ? 'ปิดเคสสำเร็จครบทั้งรอบ' : unknown ? 'ยังยืนยันผลปิดเคสไม่ครบ' : done ? 'ปิดเคสสำเร็จบางส่วน' : 'ยังปิดเคสไม่สำเร็จ'
  const close = () => {
    if (inFlight.current) return
    setOpen(false)
    if (batch && !batch.attempted) { registry.current = registry.current.filter(b => b.id !== batch.id); setBatches(registry.current) }
  }
  const pending = batches.filter(b => b.attempted && b.rows.some(r => r.status !== 'done'))
  return <>
    {pending.length > 0 && !open ? <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>ยังมีรายการปิดเคสที่ต้องตรวจผลหรือดำเนินการต่อ</p>{pending.map(b => <Button key={b.id} variant="outline" className="h-auto max-w-full whitespace-normal text-left" disabled={busy} onClick={() => { focusReturn.current = document.activeElement as HTMLElement; setActiveId(b.id); setPhase('result'); setOpen(true) }}>ตรวจผลเดิม · {formatThaiDateWithWeekday(b.group.date)} {b.group.startTime.slice(0, 5)} · {b.group.branchName}</Button>)}</div> : null}
    <Dialog open={open && Boolean(batch)} onOpenChange={value => { if (!value) close() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault() }} onInteractOutside={e => { if (busy) e.preventDefault() }} onCloseAutoFocus={e => { e.preventDefault(); (focusReturn.current?.isConnected ? focusReturn.current : document.querySelector<HTMLElement>('[role="tab"][data-state="active"]'))?.focus({ preventScroll: true }) }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{batch ? `${formatThaiDateWithWeekday(batch.group.date)} · ${batch.group.startTime.slice(0, 5)}–${batch.group.endTime.slice(0, 5)} · ${batch.group.branchName} · ${batch.group.coachName || 'ยังไม่มีโค้ช'}` : ''}</DialogDescription></DialogHeader>
        {batch ? <div aria-live="polite" className="space-y-4">
          {phase === 'confirm' ? <><ReviewCloseImpact sessions={remaining.map(r => r.session)} /><p className="text-sm text-gray-600">เหตุผลที่จะบันทึก: {batch.reason}</p></> : <>
            <div className={`rounded-lg p-3 text-sm ${remaining.length ? 'bg-blue-50 text-blue-900' : 'bg-emerald-50 text-emerald-900'}`}><p className="font-semibold">ยืนยันปิดแล้ว {done} จาก {batch.rows.length} คน</p><p>{remaining.length ? 'คงรายการที่ยังไม่ปิดหรือยังยืนยันไม่ได้ไว้ในคิว' : 'นำรายการที่ปิดสำเร็จออกจากคิวแล้ว ข้อมูลรอบเรียนเดิมยังอยู่'}</p></div>
            {batch.rows.map(row => <div key={row.session.id} data-close-status={row.status} className="space-y-1 rounded-lg border p-3 text-sm"><p className="font-semibold">{row.session.learner_name}</p><p className={row.status === 'done' ? 'text-emerald-700' : row.status === 'failed' ? 'text-red-700' : 'text-gray-700'}>{row.message || 'ยังไม่ได้ดำเนินการ'}</p></div>)}
            {remaining.length ? <p className="text-sm text-gray-600">{unknown ? 'ตรวจสอบผลเดิมก่อนดำเนินการต่อ เพื่อไม่ส่งปิดซ้ำในรายการที่อาจสำเร็จแล้ว' : 'ดำเนินการต่อเฉพาะรายการที่ยังไม่ปิด โดยใช้คำขอเดิม'}</p> : null}
          </>}
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>{phase === 'confirm' ? 'ยกเลิก' : 'ปิด'}</Button>
            {phase === 'confirm' ? <Button disabled={busy || !remaining.length} onClick={() => void execute(batch)}>ยืนยันปิดเคส {remaining.length} คน</Button> : remaining.length ? <Button className="h-auto max-w-full whitespace-normal" disabled={busy} onClick={() => { if (unknown) void execute(batch, true); else setPhase('confirm') }}>{busy ? 'กำลังตรวจผล...' : unknown ? 'ตรวจสอบผลเดิม' : `ดำเนินการต่อเฉพาะที่ยังไม่ปิด (${remaining.length})`}</Button> : null}</div>
        </div> : null}
      </DialogContent>
    </Dialog>
  </>
}
