'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMakeupOptions } from '@/components/admin/use-makeup-options'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListPagination } from '@/components/admin/list-pagination'
import { AdminActionReason, adminActionReason } from '@/components/admin/admin-action-reason'
import type { MakeupContinuation } from '@/components/admin/admin-lesson-manager'
import { MakeupCalendarPicker, useMakeupCalendarNow } from '@/components/admin/makeup-calendar-picker'
import { findKidsMakeupSlot, kidsMakeupCalendarDays } from '@/lib/makeup-calendar'
import { formatThaiDateTimeWithWeekday,formatThaiDateWithWeekday,formatThaiMonthYear } from '@/lib/date-format'
import { availableFamilyMakeupCount, familyMakeupReason, type KidsFamilyMakeupCard, type KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
import type { BranchOption } from '@/lib/admin-makeup-read-model'
import type { ScheduleTemplateOption } from '@/lib/schedule-template-utils'
type MakeupStatusFilter = 'all'|'actionable'|'makeup'|'expired'
const formatDate = formatThaiDateWithWeekday
const formatTime=(start:string,end:string)=>start.slice(0,5)+'-'+end.slice(0,5)
export function KidsFamilyMakeupPanel({ cards, branches, search, branch, course, status, onSavingChange, continuation, onContinuationHandled }: {
  cards: KidsFamilyMakeupCard[]; scheduleTemplates: ScheduleTemplateOption[]; branches: BranchOption[]
  search: string; branch: string; course: string; status: MakeupStatusFilter; onSavingChange: (saving: boolean) => void
  continuation: MakeupContinuation | null; onContinuationHandled: () => void
}) {
  const [overrides, setOverrides] = useState<Record<string, KidsFamilyMakeupState>>({})
  const [selected, setSelected] = useState<KidsFamilyMakeupCard | null>(null)
  const [childId, setChildId] = useState('')
  const [date, setDate] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [reason, setReason] = useState(''), [reasonNote, setReasonNote] = useState(''), [preferredSource, setPreferredSource] = useState('')
  const fullReason = adminActionReason(reason, reasonNote)
  const continuationHandled = useRef('')
  const now = useMakeupCalendarNow(Boolean(selected))
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const inFlight = useRef(false)
  const request = useRef<Record<string, unknown> | null>(null)
  const readRevision = useRef(0)
  const keyOf = (state: KidsFamilyMakeupState) => `${state.parentId}:${state.sourceMonth}`
  useEffect(() => { readRevision.current++; setOverrides({}); setLoading(null); setPage(1) }, [cards])
  useEffect(() => { setPage(1) }, [search, branch, course, status])
  const state = selected ? overrides[keyOf(selected.state)] || selected.state : null
  const options=useMakeupOptions(Boolean(selected)),scheduleTemplates=options.templates
  const locked = saving || uncertain
  const calendarDays = useMemo(() => kidsMakeupCalendarDays(state?.destinationMonth || '', branches, scheduleTemplates, now), [state?.destinationMonth, branches, scheduleTemplates, now])
  const pickedSlot = state ? findKidsMakeupSlot(state.destinationMonth, date, templateId, branches, scheduleTemplates, now) : null
  useEffect(() => {
    // An uncertain transaction must retain its exact payload even after a slot starts.
    if (locked || inFlight.current || request.current || !date || !state) return
    if (!calendarDays.some(day => day.dateInput === date)) {
      setDate(''); setTemplateId(''); setError('วันที่เลือกไม่มีรอบที่ยังไม่เริ่ม กรุณาเลือกวันใหม่'); return
    }
    if (!templateId) return
    if (!findKidsMakeupSlot(state.destinationMonth, date, templateId, branches, scheduleTemplates, now)) {
      setTemplateId(''); setError('รอบที่เลือกเริ่มแล้วหรือเลือกไม่ได้ กรุณาเลือกวันและรอบใหม่')
    }
  }, [locked, templateId, state, date, branches, scheduleTemplates, now, calendarDays])
  const filtered = cards.map(card => ({ ...card, state: overrides[keyOf(card.state)] || card.state })).filter(card => {
    const s = card.state
    // Quota alone is not a source. Keep spent history and source-bearing
    // families (including Paused / D<M) without offering empty entitlement.
    // A selected family without sources still explains its real ineligibility.
    if (course !== 'all' && course !== 'kids_group') return false
    if (branch !== 'all' && !card.branchIds.includes(branch)) return false
    if (status === 'actionable' && !s.eligible || status === 'makeup' && !s.used && !s.destinations?.length || status === 'expired' && s.reason !== 'expired') return false
    return [card.parentName, ...card.branchNames, ...s.children.map(child => child.name), formatThaiMonthYear(`${s.sourceMonth}-01`)]
      .some(value => value.toLowerCase().includes(search.trim().toLowerCase()))
  })
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 15)))
  async function reload(card: KidsFamilyMakeupCard) {
    const key = keyOf(card.state)
    const revision = ++readRevision.current
    setLoading(key); setError(null)
    try {
      const response = await fetch(`/api/admin/makeup/kids-family?parentId=${card.state.parentId}&sourceMonth=${card.state.sourceMonth}`)
      const data = await response.json()
      if (revision !== readRevision.current) return false
      if (!response.ok || !data.sourceMonth) throw new Error(data.error || 'อ่านสิทธิ์ล่าสุดไม่สำเร็จ')
      setOverrides(current => ({ ...current, [key]: data }))
      return true
    } catch (cause) { if (revision === readRevision.current) setError(cause instanceof Error ? cause.message : 'อ่านสิทธิ์ไม่สำเร็จ'); return false }
    finally { if (revision === readRevision.current) setLoading(null) }
  }
  function open(card: KidsFamilyMakeupCard) {
    if (inFlight.current || request.current) return
    const current = overrides[keyOf(card.state)] || card.state
    setSelected(card); setChildId(current.children.length === 1 ? current.children[0].id : ''); setDate(''); setTemplateId(''); setError(null); setSuccess(null)
    setReason(''); setReasonNote(''); setPreferredSource('')
  }
  useEffect(() => {
    if (!continuation || continuationHandled.current === continuation.key || inFlight.current || request.current) return
    const card = cards.find(item => item.state.parentId === continuation.parentId && item.state.sourceMonth === continuation.sourceMonth
      && item.state.sources.some(source => source.sourceSessionId === continuation.sourceSessionId))
    if (!card) return // Wait for authoritative refresh to include the newly stored source.
    continuationHandled.current = continuation.key
    setSelected(card); setChildId(continuation.childId); setDate(''); setTemplateId(''); setError(null); setSuccess(null)
    setReason(continuation.reason); setReasonNote(continuation.note); setPreferredSource(continuation.sourceSessionId)
    onContinuationHandled()
  }, [cards, continuation, onContinuationHandled])
  async function consume() {
    if (inFlight.current || !state || !selected) return
    if (!request.current) {
      const slot = findKidsMakeupSlot(state.destinationMonth, date, templateId, branches, scheduleTemplates, new Date())
      const template = slot && scheduleTemplates.find(t => t.id === slot.templateId)
      if (!state.eligible || !fullReason || !state.children.some(child => child.id === childId)) return
      if (!template) { setTemplateId(''); setError('รอบที่เลือกเริ่มแล้วหรือเลือกไม่ได้ กรุณาเลือกวันและรอบใหม่'); return }
      request.current = { parent_id: state.parentId, source_month: state.sourceMonth, attending_child_id: childId,
        schedule_template_id: template.id, branch_id: template.branch_id, makeup_date: date,
        start_time: template.start_time, end_time: template.end_time, request_id: crypto.randomUUID(), reason: fullReason,
        ...(preferredSource ? { original_session_id: preferredSource } : {}) }
    }
    inFlight.current = true; setSaving(true); onSavingChange(true); setError(null)
    let resolved = false
    try {
      const response = await fetch('/api/admin/makeup/kids-family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.current) })
      const data = await response.json()
      if (!response.ok || !data.success || !data.data?.id) {
        // An explicit business rejection is terminal; transport/unknown outcomes
        // retain the complete request and UUID for an exact replay only.
        if (response.status >= 400 && response.status < 500 && data.code
          && !['TASK10_IDEMPOTENCY_CONFLICT', 'TASK10_UNAVAILABLE'].includes(data.code)) resolved = true
        throw new Error(data.error || 'ยังยืนยันผลการจัดชดเชยไม่ได้')
      }
      // A committed result with a failed authoritative read retains this request.
      // Replay can reconcile it, but stale card data must not enable a new write.
      if (!await reload(selected)) throw new Error('บันทึกแล้วแต่ยังอ่านสิทธิ์ล่าสุดไม่ได้ กรุณาตรวจสอบคำขอเดิม')
      resolved = true
      setSuccess(`จัดชดเชยสำเร็จ โควตาเหลือ ${data.remaining} ครั้ง`)
      setSelected(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิม') }
    finally {
      inFlight.current = false; setSaving(false); setUncertain(!resolved)
      if (resolved) { request.current = null; onSavingChange(false) }
    }
  }
  return <section aria-label="สิทธิ์ชดเชยคอร์สเด็กร่วมครอบครัว" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-[#153c85]">เด็ก — สิทธิ์ร่วมครอบครัว</h2><p className="text-sm text-gray-500">แสดงสิทธิ์ครอบครัวที่เลือก</p></div>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {success ? <p role="status" className="text-emerald-700">{success}</p> : null}
    {!filtered.length ? <p className="py-4 text-sm text-gray-500">ไม่มีครอบครัวที่ตรงกับเดือนและตัวกรองนี้</p> : null}
    {filtered.slice((safePage - 1) * 15, safePage * 15).map(card => {
      const s = card.state, key = keyOf(s)
      return <Card key={key} data-testid={`kids-family-${key}`}><CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
          <h3 className="break-words font-semibold text-[#153c85]">{s.children.map(child => child.name).join(' · ') || 'ไม่พบข้อมูลเด็ก'}</h3>
          <p className="text-sm text-gray-600">ผู้ปกครอง {card.parentName}</p>
        </div><Badge variant="outline">{formatThaiMonthYear(`${s.sourceMonth}-01`)}</Badge></div>
        <p>โควตา {s.quota} · ใช้แล้ว {s.used} · เหลือ {s.remaining} · ต้นทางที่ใช้ได้ {s.sources.length}</p>
        <div className="flex flex-wrap gap-2 text-sm" aria-label="ประเภทต้นทางที่ใช้ได้">
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">กระเป๋า {s.sources.filter(source => source.kind === 'wallet').length}</Badge>
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">ขาดเรียน {s.sources.filter(source => source.kind === 'absent').length}</Badge>
        </div>
        <p className="font-medium">ใช้ได้ตอนนี้ {availableFamilyMakeupCount(s)} ครั้ง <span className="text-sm font-normal text-gray-500">สิทธิ์ร่วมทั้งครอบครัว ไม่แยกเพิ่มต่อเด็ก</span></p>
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Admin จัดชดเชยได้โดยไม่ต้องรอซื้อเดือนถัดไป · คงโควตา ต้นทาง และอายุสิทธิ์เดิม</p>
        <details className="text-sm"><summary className="cursor-pointer text-[#2748bf]">ดูต้นทางและการคำนวณสิทธิ์</summary>
          <p className="mt-2">ซื้อเดือนต้นทางยืนยันแล้ว {s.sourcePurchase.quantity} รอบ → โควตา {s.quota} รอบ</p>
          <p>ซื้อเดือนปลายทางยืนยันแล้ว {s.destinationPurchase.quantity} รอบ · ยกเว้นเงื่อนไขซื้อเดือนถัดไปสำหรับ Admin</p>
          {s.sources.map(source => <p key={source.sourceSessionId} className="mt-2 border-t pt-2">{source.kind === 'wallet' ? 'กระเป๋า' : 'ขาดเรียนจริง'} · {formatDate(source.sourceDate)} · {s.children.find(child => child.id === source.sourceChildId)?.name}</p>)}
        </details>
        <p className="text-sm">ใช้ใน {formatThaiMonthYear(`${s.destinationMonth}-01`)} · ถึง {formatThaiDateTimeWithWeekday(new Date(Date.parse(s.expiresAt) - 1))}</p>
        {s.reason ? <p className="text-sm text-amber-800">{familyMakeupReason(s)}</p> : null}
        {(s.destinations || []).map(destination => <div key={destination.id} className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900" data-makeup-destination={destination.id}>
          <p className="font-medium">จองชดเชยแล้ว · {destination.childName}</p>
          <p>{formatThaiDateWithWeekday(destination.date)} · {formatTime(destination.startTime, destination.endTime)} · {destination.branchName}</p>
        </div>)}
        <div className="flex flex-wrap gap-2">{s.sources.length > 0 ? <Button disabled={locked || !s.eligible || loading !== null} onClick={() => open(card)}>เลือกเด็กและรอบชดเชย</Button> : <p className="text-sm text-gray-600">แสดงประวัติชดเชย · ไม่มีต้นทางสำหรับใช้สิทธิ์ใหม่</p>}
          <Button variant="outline" disabled={locked || loading !== null} onClick={() => void reload(card)}>{loading === key ? 'กำลังอ่านสิทธิ์...' : 'โหลดสิทธิ์ใหม่'}</Button></div>
      </CardContent></Card>
    })}
    {filtered.length > 15 ? <ListPagination page={safePage} pageSize={15} pageSizeOptions={[15]} total={filtered.length} onPageChange={setPage} onPageSizeChange={() => {}} /> : null}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !inFlight.current && !request.current) setSelected(null) }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>เลือกเด็กและรอบชดเชย</DialogTitle><DialogDescription>สิทธิ์ร่วมครอบครัว {selected?.parentName} — ระบบผูกต้นทางที่ใช้ได้และเก็บหลักฐานให้อัตโนมัติ</DialogDescription></DialogHeader>
        {state ? <div className="space-y-4">
          {options.loading?<p role="status">กำลังอ่านรอบเรียน...</p>:null}{options.error?<p role="alert">{options.error} <Button onClick={options.retry}>ลองใหม่</Button></p>:null}
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><p>โควตาคงเหลือ {state.remaining} รอบ · Admin ยกเว้นซื้อเดือนถัดไป</p><p>ต้นทาง: {(() => { const source = state.sources.find(item => item.sourceSessionId === preferredSource) || state.sources[0]; return source ? `${source.kind === 'wallet' ? 'กระเป๋า' : 'ขาดเรียนจริง'} · ${formatDate(source.sourceDate)}` : 'ไม่มีต้นทางที่ใช้ได้' })()}</p>{state.reason ? <p>{familyMakeupReason(state)}</p> : null}</div>
          {state.children.length === 1 ? <p className="font-medium">เด็กที่มาเรียนจริง: {state.children[0].name}</p> : <Select value={childId} onValueChange={setChildId} disabled={locked}><SelectTrigger aria-label="เด็กที่มาเรียนจริง"><SelectValue placeholder="เลือกเด็กที่จะมาเรียน" /></SelectTrigger><SelectContent>{state.children.map(child => <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>)}</SelectContent></Select>}
          {childId ? <>
            <p className="text-sm text-gray-600">เลือกได้ตั้งแต่วันนี้ เฉพาะเดือนสิทธิ์ {formatThaiMonthYear(`${state.destinationMonth}-01`)} และรอบที่ยังไม่เริ่ม (เวลาไทย)</p>
            <MakeupCalendarPicker month={state.destinationMonth} days={calendarDays} selectedDate={date} selectedSlot={pickedSlot} disabled={locked}
              onDateChange={value => { if (!inFlight.current && !request.current) { setDate(value); setTemplateId('') } }}
              onSlotChange={slot => { if (!inFlight.current && !request.current) setTemplateId(slot.templateId || '') }} />
          </> : <p className="text-sm text-gray-500">เลือกเด็กที่จะมาเรียนเพื่อเปิดปฏิทิน</p>}
          <AdminActionReason value={reason} note={reasonNote} onValueChange={setReason} onNoteChange={setReasonNote} disabled={locked} />
          {pickedSlot ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{formatDate(pickedSlot.date)} · {formatTime(pickedSlot.start, pickedSlot.end)} · {pickedSlot.branchName}<br />ใช้ต้นทาง 1 รอบ · โควตา {state.remaining} → {Math.max(0, state.remaining - 1)}</p> : null}
          {error ? <p role="alert" className="text-red-700">{error}</p> : null}
          {uncertain ? <p className="text-amber-800">ยังยืนยันผลไม่ได้ ข้อมูลเดิมถูกเก็บไว้ การตรวจซ้ำใช้รหัสคำขอเดิมและไม่เลือกสิทธิ์เพิ่ม</p> : null}
          <Button className="bg-[#f57e3b] hover:bg-[#e06d2e]" disabled={saving || (!uncertain && (!state.eligible || !childId || !pickedSlot || !fullReason))} onClick={() => void consume()}>{saving ? 'กำลังจัดชดเชย...' : uncertain ? 'ตรวจสอบคำขอเดิม' : 'สร้างวันชดเชย'}</Button>
        </div> : null}
      </DialogContent>
    </Dialog>
  </section>
}
