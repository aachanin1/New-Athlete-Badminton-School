'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatThaiDateWithWeekday, formatThaiDateTimeWithWeekday } from '@/lib/date-format'
import type { KidsFamilyMakeupSource, KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
import { forgetMakeupOperation, sendMakeupOperation } from '@/lib/admin-makeup-operation-client'
import { toast } from 'sonner'

export function MakeupCreditApproval({ source, family, disabled, initialReason = '', onBusyChange, onDecided }: {
  source: KidsFamilyMakeupSource; family: KidsFamilyMakeupState; disabled?: boolean; initialReason?: string
  onBusyChange: (busy: boolean) => void; onDecided: (reason: string, operation: 'approve' | 'revoke', confirmed?: boolean) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false), [operation, setOperation] = useState<'approve' | 'revoke'>('approve')
  const [reason, setReason] = useState(initialReason), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false), [notRecorded, setNotRecorded] = useState(false)
  const request = useRef<Record<string, unknown> | null>(null), inFlight = useRef(false)
  const approved = source.approval?.status === 'approved'
  // Approval is part of Store (or the existing destination confirmation for a
  // proven legacy credit). This component only exposes an explicit correction.
  if (!source.creditId || !approved) return null
  async function submit() {
    if (inFlight.current || !reason.trim()) return
    request.current ||= { credit_id: source.creditId, request_id: crypto.randomUUID(), operation, reason: reason.trim() }
    const payload = request.current
    inFlight.current = true; setSaving(true); setError(''); onBusyChange(true)
    let settled = false
    try {
      const { response, data } = await sendMakeupOperation('approval', payload, uncertain && !notRecorded)
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && data.code && !['TASK10_UNAVAILABLE', 'TASK10_IDEMPOTENCY_CONFLICT'].includes(data.code)) {
          settled = true; setOpen(false); toast.error(data.error || 'รายการเปลี่ยนแล้ว กรุณาตรวจสิทธิ์ล่าสุด')
          await onDecided(String(payload.reason), operation, false)
        }
        throw Error(data.error || 'ยังยืนยันผลไม่ได้')
      }
      if (!data.confirmed) { setNotRecorded(true); throw Error('ยังไม่พบผลยืนยัน สามารถลองบันทึกคำขอเดิมได้') }
      await onDecided(String(payload.reason), operation, true)
      settled = true; setOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ยังตรวจสอบผลไม่ได้') }
    finally {
      inFlight.current = false; setSaving(false); setUncertain(!settled)
      if (settled) { forgetMakeupOperation(String(payload.request_id)); request.current = null; setNotRecorded(false); onBusyChange(false) }
    }
  }
  return <>
    <Button variant="outline" disabled={disabled} onClick={() => { setOperation(approved ? 'revoke' : 'approve'); setReason(initialReason); setError(''); setOpen(true) }}>
      {approved ? 'เพิกถอนการยืนยันก่อนใช้' : 'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'}
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!saving && !uncertain) setOpen(value) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" onEscapeKeyDown={event => { if (saving || uncertain) event.preventDefault() }} onInteractOutside={event => { if (saving || uncertain) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{operation === 'approve' ? 'ยืนยันกรณีพิเศษ · 1 เครดิต' : 'เพิกถอนการยืนยันก่อนใช้'}</DialogTitle><DialogDescription>ข้อมูลการตัดสินใจนี้เป็นบันทึกภายใน Admin</DialogDescription></DialogHeader>
        <div className="space-y-2 rounded-lg border bg-gray-50 p-3 text-sm"><p>ต้นทาง {formatThaiDateWithWeekday(source.sourceDate)} · {family.children.find(c => c.id === source.sourceChildId)?.name || 'ตรวจชื่อผู้เรียนต้นทาง'}</p><p className="break-all">เครดิต {source.creditId}</p><p>โควตาปกติ {family.quota} · ใช้จริง {family.used} · เหลือ {family.remaining}</p><p>ใช้ชดเชยภายใน {formatThaiDateTimeWithWeekday(new Date(Date.parse(family.expiresAt) - 1))}</p></div>
        <p className="text-sm">{operation === 'approve' ? 'ใช้โควตาปกติก่อน หากเต็มจึงใช้การยืนยันนี้ได้ 1 ครั้ง โดยไม่ต้องซื้อเดือนถัดไป ไม่ต่ออายุและไม่เลือกวันให้อัตโนมัติ' : 'เพิกถอนเฉพาะการยืนยันของเครดิตนี้ เครดิตและโควตาปกติยังเป็นไปตามเงื่อนไขเดิม'}</p>
        <label className="space-y-2 text-sm">เหตุผลภายใน Admin *<Textarea aria-label="เหตุผลยืนยันรายเครดิต" value={reason} maxLength={1000} disabled={saving || uncertain} onChange={event => setReason(event.target.value)} /></label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={saving || uncertain} onClick={() => setOpen(false)}>ยกเลิก</Button><Button disabled={saving || !reason.trim()} onClick={() => void submit()}>{saving ? 'กำลังตรวจสอบ...' : uncertain ? notRecorded ? 'ลองบันทึกคำขอเดิม' : 'ตรวจสอบผลเดิม' : operation === 'approve' ? 'ยืนยัน 1 เครดิตและเลือกวัน' : 'ยืนยันเพิกถอน'}</Button></div>
      </DialogContent>
    </Dialog>
  </>
}
