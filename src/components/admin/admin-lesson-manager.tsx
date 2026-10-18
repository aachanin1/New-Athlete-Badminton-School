'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Loader2, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListPagination } from '@/components/admin/list-pagination'
import { AdminActionReason, adminActionReason } from '@/components/admin/admin-action-reason'
import { MakeupCalendarPicker, useMakeupCalendarNow } from '@/components/admin/makeup-calendar-picker'
import { makeupMonthDates, type MakeupCalendarDay, type MakeupCalendarSlot } from '@/lib/makeup-calendar'
import { formatThaiDateWithWeekday, formatThaiDateTimeWithWeekday } from '@/lib/date-format'
import { getBangkokDayOfWeek, getTemplateSlots, type ScheduleTemplateOption } from '@/lib/schedule-template-utils'
import type { CourseTypeName } from '@/types/database'
import { ADMIN_COURSES } from '@/components/admin/course-colors'
import { useMakeupOptions } from '@/components/admin/use-makeup-options'
import type { KidsFamilyMakeupState } from '@/lib/kids-family-makeup'

interface Lesson {
  id: string; booking_id: string; child_id: string | null; user_id: string; branch_id: string; schedule_slot_id: string | null
  date: string; start_time: string; end_time: string; status: string; is_makeup: boolean; course_type: CourseTypeName
  learner_name: string; parent_name: string; branch_name: string; has_attendance: boolean; branch_closed: boolean
  identity_valid: boolean
}
interface Person {learner_key:string;user_id:string;child_id:string|null;booking_id:string|null;learner_name:string;parent_name:string;branch_ids:string[];branch_names:string[];course_type:CourseTypeName}
interface LessonList { scope?:string; items: Lesson[]; total: number; page: number; pageSize: number }
interface Branch { id: string; name: string; slug: string }
export interface MakeupContinuation { parentId: string; sourceMonth: string; sourceSessionId: string; childId: string; reason: string; note: string; key: string }
interface RequestPayload { session_id: string; operation: 'store' | 'reschedule'; request_id: string; reason: string; target_date?: string; start_time?: string; end_time?: string; branch_id?: string; template_id?: string }

export function AdminLessonManager({ month, branches, active, initialSessionId, onSavingChange, onMakeup, onChanged }: {
  month: string; branches: Branch[]; scheduleTemplates: ScheduleTemplateOption[]; active:boolean; initialSessionId?: string | null; onChanged?:()=>void
  onSavingChange: (saving: boolean) => void; onMakeup: (value: MakeupContinuation) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState(''), [committedSearch,setCommittedSearch]=useState('')
  const [people,setPeople]=useState<{scope?:string;items:Person[];total:number}>({items:[],total:0}),[person,setPerson]=useState<Person|null>(null)
  const [branch, setBranch] = useState('all'), [course, setCourse] = useState(''), [page, setPage] = useState(1)
  const [list, setList] = useState<LessonList>({ items: [], total: 0, page: 1, pageSize: 20 })
  const [loading, setLoading] = useState(false), [listError, setListError] = useState('')
  const [selected, setSelected] = useState<Lesson | null>(null), [action, setAction] = useState<'store' | 'reschedule'>('reschedule')
  const [date, setDate] = useState(''), [slot, setSlot] = useState<MakeupCalendarSlot | null>(null)
  const [reason, setReason] = useState(''), [note, setNote] = useState(''), [error, setError] = useState('')
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null), [family, setFamily] = useState<KidsFamilyMakeupState | null>(null)
  const pending = useRef<RequestPayload | null>(null), inFlight = useRef(false), revision = useRef(0), handledDeepLink = useRef('')
  const now = useMakeupCalendarNow(Boolean(selected)), locked = saving || uncertain
  const options=useMakeupOptions(Boolean(selected)),scheduleTemplates=options.templates
  const controller=useRef<AbortController|null>(null)
  const fullReason = adminActionReason(reason, note)

  const resetScope=useCallback(()=>{revision.current++;controller.current?.abort();setPerson(null);setPeople({items:[],total:0});setList({items:[],total:0,page:1,pageSize:20});setCommittedSearch('');setPage(1);setListError('');setLoading(false)},[])
  useEffect(resetScope,[month,resetScope])
  const readScope=JSON.stringify([month,branch,course,page,person?.learner_key||committedSearch])
  const listReady=list.scope===readScope,peopleReady=people.scope===readScope
  const load=useCallback(async()=>{
    if(!active||!course||!person&&committedSearch.length<2)return true
    controller.current?.abort();const control=new AbortController();controller.current=control;const rev=++revision.current
    setLoading(true);setListError('')
    const q=new URLSearchParams({month,course,page:String(page),mode:person?'sessions':'learners',search:person?'':committedSearch})
    if(branch!=='all')q.set('branch',branch)
    if(person){q.set('user',person.user_id);if(person.child_id)q.set('child',person.child_id);if(person.booking_id)q.set('booking',person.booking_id)}
    try{const r=await fetch('/api/admin/makeup/lookup?'+q,{cache:'no-store',signal:control.signal}),data=await r.json();if(!r.ok||!Array.isArray(data.items))throw Error(data.error||'อ่านรายการไม่สำเร็จ');if(rev===revision.current)(person?setList:setPeople)({...data,scope:readScope});return true}
    catch(e){if(!control.signal.aborted&&rev===revision.current){setList({items:[],total:0,page,pageSize:20});setPeople({items:[],total:0});setListError(e instanceof Error?e.message:'อ่านรายการไม่สำเร็จ')}return false}
    finally{if(!control.signal.aborted&&rev===revision.current)setLoading(false)}
  },[active,month,branch,course,page,committedSearch,person,readScope])
  const cancelLoad=useCallback(()=>{revision.current++;controller.current?.abort()},[])
  useEffect(()=>{void load();return cancelLoad},[load,cancelLoad])

  const open = useCallback((lesson: Lesson, operation: 'store' | 'reschedule') => {
    if (pending.current || inFlight.current) return
    setSelected(lesson); setAction(operation); setDate(''); setSlot(null); setReason(lesson.branch_closed ? 'closure' : '')
    setNote(''); setError(''); setResult(null); setFamily(null); setUncertain(false)
  }, [])
  useEffect(() => {
    if (!active || !initialSessionId || handledDeepLink.current === initialSessionId) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/admin/makeup/lessons?${new URLSearchParams({ month, session: initialSessionId })}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'อ่านรายการที่เลือกไม่สำเร็จ')
        if (cancelled) return
        if(data.items?.[0]?.date?.slice(0,7)!==month&&data.items?.[0]?.date){router.replace(`/admin/makeup?month=${data.items[0].date.slice(0,7)}&tab=manage&session=${initialSessionId}`,{scroll:false});return}
        handledDeepLink.current = initialSessionId
        const lesson = data.items?.[0] as Lesson | undefined
        if (lesson?.status === 'scheduled' && !lesson.has_attendance && lesson.identity_valid !== false) {setCourse(lesson.course_type);setPerson({learner_key:lesson.id,user_id:lesson.user_id,child_id:lesson.child_id,booking_id:lesson.course_type==='private'?lesson.booking_id:null,learner_name:lesson.learner_name,parent_name:lesson.parent_name,branch_ids:[lesson.branch_id],branch_names:[lesson.branch_name],course_type:lesson.course_type});open(lesson, 'reschedule')}
        else setListError('รายการนี้ไม่พร้อมย้ายวัน/เก็บกระเป๋า กรุณาตรวจสถานะและประวัติการเช็คชื่อ')
      } catch (cause) { if (!cancelled) setListError(cause instanceof Error ? cause.message : 'อ่านรายการที่เลือกไม่สำเร็จ') }
    })()
    return () => { cancelled = true }
  }, [active, initialSessionId, month, open, router])
  useEffect(() => {
    if (!selected || selected.course_type !== 'kids_group') return
    let cancelled = false
    void fetch(`/api/admin/makeup/kids-family?${new URLSearchParams({ parentId: selected.user_id, sourceMonth: selected.date.slice(0, 7) })}`, { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (response.ok && !cancelled) setFamily(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [selected])

  const days = useMemo<MakeupCalendarDay[]>(() => selected ? makeupMonthDates(selected.date.slice(0, 7)).flatMap(dateInput => {
    const dayOfWeek = getBangkokDayOfWeek(dateInput)!
    const slotsByBranch = branches.map(b => ({ branch: b, slots: getTemplateSlots(scheduleTemplates, b.slug, selected.course_type, dayOfWeek, dateInput)
      .filter(s => selected.course_type !== 'private' || scheduleTemplates.some(t => t.id === s.templateId && t.start_time.slice(0, 5) === s.start && t.end_time.slice(0, 5) === s.end)
        && Date.parse(`2000-01-01T${s.end}:00Z`) - Date.parse(`2000-01-01T${s.start}:00Z`) === Date.parse(`2000-01-01T${selected.end_time}Z`) - Date.parse(`2000-01-01T${selected.start_time}Z`))
      .filter(s => Date.parse(`${dateInput}T${s.start}+07:00`) > now.getTime())
      .filter(s => !(dateInput === selected.date && b.id === selected.branch_id && s.start === selected.start_time.slice(0, 5) && s.end === selected.end_time.slice(0, 5))) }))
      .filter(item => item.slots.length)
    return slotsByBranch.length ? [{ dateInput, dayOfWeek, slotsByBranch }] : []
  }) : [], [selected, branches, scheduleTemplates, now])
  const selectedSlotValid = !slot || days.some(day => day.dateInput === slot.date && day.slotsByBranch.some(b => b.branch.id === slot.branchId
    && b.slots.some(s => s.templateId === slot.templateId && s.start === slot.start && s.end === slot.end)))

  async function submit() {
    if (inFlight.current || !selected) return
    if (!pending.current) {
      if (!fullReason || selected.identity_valid === false || selected.has_attendance || selected.status !== 'scheduled' || (action === 'reschedule' && (!slot || !selectedSlotValid))) return
      pending.current = { session_id: selected.id, operation: action, request_id: crypto.randomUUID(), reason: fullReason,
        ...(slot && action === 'reschedule' ? { target_date: slot.date, start_time: slot.start, end_time: slot.end, branch_id: slot.branchId, template_id: slot.templateId } : {}) }
    }
    inFlight.current = true; setSaving(true); setError(''); onSavingChange(true)
    let resolved = false
    try {
      const response = await fetch('/api/admin/makeup/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current) })
      const data = await response.json()
      if (!response.ok || !data.success || !data.result) {
        if (response.status >= 400 && response.status < 500 && data.code && !['LESSON_SOURCE_RETRY', 'LESSON_SOURCE_FAILED'].includes(data.code)) resolved = true
        throw new Error(data.error || 'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิม')
      }
      if (!await load()) throw new Error('บันทึกแล้วแต่ยังอ่านรายการล่าสุดไม่ได้ กรุณาตรวจสอบคำขอเดิม')
      resolved = true; setResult(data.result); if(onChanged)onChanged();else router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ยังยืนยันผลไม่ได้') }
    finally {
      inFlight.current = false; setSaving(false); setUncertain(!resolved)
      if (resolved) { pending.current = null; onSavingChange(false) }
    }
  }

  return <section className="space-y-4" aria-label="จัดการวันเรียน">
    <Card><CardContent className="space-y-4 p-4">
      <h2 className="font-semibold text-[#153c85]">1. เลือกประเภทคอร์ส</h2>
      <div className="grid grid-cols-3 gap-2">{Object.entries(ADMIN_COURSES).map(([value,item])=><Button key={value} variant="outline" disabled={locked} aria-pressed={course===value} className={item.className+(course===value?' ring-2 ring-current ring-offset-1':'')} onClick={()=>{resetScope();setCourse(value)}}>{item.label}</Button>)}</div>
      {course?<form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end" onSubmit={e=>{e.preventDefault();if(search.trim().length>=2&&!locked){setPerson(null);setPeople({items:[],total:0});setCommittedSearch(search.trim());setPage(1);if(committedSearch===search.trim())void load()}}}>
        <label className="space-y-2 text-sm"><span>2. ค้นหาผู้เรียน / ผู้ปกครอง</span><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ชื่อเล่น ชื่อจริง หรือชื่อผู้ปกครอง" aria-label="ค้นหารอบเรียน" disabled={locked} minLength={2} maxLength={200}/></label>
        <label className="space-y-2 text-sm"><span>สาขา</span><Select value={branch} onValueChange={value=>{resetScope();setBranch(value)}} disabled={locked}><SelectTrigger aria-label="สาขาของรอบเรียน"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">ทุกสาขา</SelectItem>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></label>
        <Button type="submit" disabled={locked||search.trim().length<2}>ค้นหา</Button>
      </form>:<p className="py-5 text-center text-sm text-gray-500">เลือกคอร์ส แล้วค้นหาคนที่ต้องการช่วยจัดการ</p>}
    </CardContent></Card>
    {person?<div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-[#153c85]">3. เลือกรอบเรียน · {person.learner_name}</h2><p className="text-sm text-gray-500">ผู้ปกครอง / ผู้เรียน {person.parent_name}</p></div><Button variant="ghost" disabled={locked} onClick={()=>{setPerson(null);setPage(1)}}>เปลี่ยนผู้เรียน</Button></div>:null}
    {!person&&committedSearch&&peopleReady&&!loading&&!listError?<Card><CardContent className="p-4"><h2 className="font-semibold text-[#153c85]">พบ {people.total} รายชื่อ</h2>{people.items.map(item=><Button variant="ghost" key={item.learner_key} disabled={locked} className="mt-2 h-auto w-full justify-between whitespace-normal py-3 text-left" onClick={()=>{setPerson(item);setPage(1)}}><span className="min-w-0 flex-1 break-words"><span className="block font-semibold text-[#153c85]">{item.learner_name}</span><span className="text-xs text-gray-500">{item.parent_name} · {item.branch_names.join(' · ')}</span></span><Badge className={ADMIN_COURSES[item.course_type].className} variant="outline">{ADMIN_COURSES[item.course_type].label}</Badge></Button>)}{people.total>10?<ListPagination page={page} pageSize={10} pageSizeOptions={[10]} total={people.total} onPageChange={setPage} onPageSizeChange={()=>{}}/>:null}</CardContent></Card>:null}
    {course&&!person&&!committedSearch?<p className="py-6 text-center text-sm text-gray-500">พิมพ์อย่างน้อย 2 ตัวอักษร แล้วกดค้นหาหรือ Enter</p>:null}
    {listError ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{listError}<Button variant="outline" className="ml-3" onClick={() => void load()}>ลองอ่านใหม่</Button></div> : null}
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />กำลังอ่านรายการเรียน...</p> : null}
    {person && listReady && !loading && !listError && !list.items.length ? <Card><CardContent className="py-10 text-center text-gray-500">ไม่มีรอบปกติวันนี้หรือล่วงหน้าในเดือนและตัวกรองนี้</CardContent></Card> : null}
    {person && listReady ? list.items.map(lesson => <Card key={lesson.id} data-testid={`admin-lesson-${lesson.id}`}><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-[#153c85]">{lesson.learner_name}</h3><p className="mt-1 text-sm">{formatThaiDateWithWeekday(lesson.date)} · {lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}</p><p className="mt-1 text-sm text-gray-500">{lesson.branch_name} · ผู้ปกครอง {lesson.parent_name}</p></div><Badge variant="outline" className={ADMIN_COURSES[lesson.course_type].className}>{ADMIN_COURSES[lesson.course_type].label}</Badge></div>
      <div className="flex flex-wrap gap-2"><Badge variant="outline" className="bg-emerald-50 text-emerald-700">ชำระแล้ว</Badge>{lesson.identity_valid === false ? <Badge variant="outline">ตรวจข้อมูลผู้เรียน</Badge> : null}{lesson.branch_closed ? <Badge variant="outline" className="bg-orange-50 text-orange-800">สาขาปิดเฉพาะวันนี้</Badge> : null}{lesson.has_attendance ? <Badge variant="outline">มีการเช็คชื่อแล้ว</Badge> : null}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading || locked || lesson.identity_valid === false || lesson.has_attendance || !lesson.schedule_slot_id} onClick={() => open(lesson, 'reschedule')}><ArrowLeftRight className="mr-2 h-4 w-4" />ย้ายวัน/รอบ</Button><Button variant="outline" disabled={loading || locked || lesson.identity_valid === false || lesson.has_attendance || !lesson.schedule_slot_id} onClick={() => open(lesson, 'store')}><Wallet className="mr-2 h-4 w-4" />เก็บเข้ากระเป๋า</Button></div>
    </CardContent></Card>) : null}
    {person && listReady && list.total > 20 ? <ListPagination page={page} pageSize={20} pageSizeOptions={[20]} total={list.total} onPageChange={setPage} onPageSizeChange={() => {}} /> : null}
    <Dialog open={Boolean(selected)} onOpenChange={value => { if (!value && !pending.current && !inFlight.current) { setSelected(null); setResult(null) } }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" onEscapeKeyDown={event => { if (locked) event.preventDefault() }} onInteractOutside={event => { if (locked) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{result ? action === 'store' ? 'เก็บเข้ากระเป๋าสำเร็จ' : 'ย้ายวัน/รอบสำเร็จ' : action === 'store' ? 'เก็บรอบเรียนเข้ากระเป๋า' : 'ย้ายวัน / เปลี่ยนรอบเรียน'}</DialogTitle><DialogDescription>{selected?.learner_name} · ใช้สิทธิ์ Admin จัดการรายการเดิม</DialogDescription></DialogHeader>
        {selected ? <div className="space-y-4">
          {options.loading?<p role="status">กำลังอ่านรอบเรียน...</p>:null}{options.error?<p role="alert">{options.error} <Button onClick={options.retry}>ลองใหม่</Button></p>:null}
          <div className="rounded-lg border bg-gray-50 p-3 text-sm"><p className="font-semibold">รอบเดิม · {formatThaiDateWithWeekday(selected.date)}</p><p>{selected.start_time.slice(0, 5)}–{selected.end_time.slice(0, 5)} · {selected.branch_name}</p></div>
          {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {result ? <>
            <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{action === 'store' ? <><p>นำชื่อออกจากรอบเดิมและเพิ่มในกระเป๋า 1 หน่วยเรียนแล้ว{Number(result.participant_count || 1) > 1 ? ` · ผู้เรียน ${Number(result.participant_count)} คนร่วมกัน` : ''}</p><p>เก็บครั้งนี้ไม่หักโควตาชดเชย</p>{typeof result.expires_at === 'string' ? <p>หมดอายุกระเป๋าปกติ {formatThaiDateTimeWithWeekday(result.expires_at)}</p> : null}</> : <p>ย้ายไป {slot ? formatThaiDateWithWeekday(slot.date) : ''} · {slot?.start}–{slot?.end} · {slot?.branchName} โดยใช้สิทธิ์เดิม</p>}</div>
            <p className="text-sm text-gray-500">เหตุผล: {fullReason}</p>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => { setSelected(null); setResult(null) }}>กลับไปหน้ารายการ</Button>{action === 'store' && selected.course_type === 'kids_group' ? <Button className="bg-[#f57e3b] hover:bg-[#e06d2e]" onClick={() => { const next = { parentId: selected.user_id, sourceMonth: selected.date.slice(0, 7), sourceSessionId: selected.id, childId: selected.child_id!, reason, note, key: crypto.randomUUID() }; setSelected(null); setResult(null); onMakeup(next) }}>เลือกวันชดเชยต่อ</Button> : null}</div>
          </> : <>
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{action === 'store' ? 'ใช้สิทธิ์ Admin เก็บเข้ากระเป๋าได้ แม้เหลือน้อยกว่า 48 ชั่วโมง' : 'ใช้สิทธิ์ Admin ย้ายวัน/รอบได้ แม้เหลือน้อยกว่า 12 ชั่วโมง'}</p>
            {selected.has_attendance ? <p role="alert" className="text-red-700">มีการเช็คชื่อแล้ว กรุณาตรวจประวัติในแท็บต้องตรวจสอบ</p> : null}
            {selected.identity_valid === false ? <p role="alert" className="text-red-700">ข้อมูลผู้เรียนไม่ครบ กรุณาตรวจสอบรายการเดิม</p> : null}
            {action === 'store' ? <div className="rounded-lg border p-3 text-sm"><h3 className="font-semibold">หลังบันทึก</h3><p>นำชื่อออกจากรอบเดิม · เก็บสิทธิ์ตามอายุเดิมในกระเป๋า</p>{selected.course_type === 'private' ? <p>Family Private เก็บทั้งหน่วยและคงผู้เรียนทุกคนร่วมกัน</p> : null}<p className="mt-2 font-semibold">เก็บครั้งนี้ไม่หักโควตาชดเชย</p>{family?.sourceMonth ? <p>โควตาข้ามเดือนเหลือ {family.remaining} รอบ · ใช้ได้ตามต้นทางที่เข้าเกณฑ์ในเดือนถัดไป</p> : null}</div>
              : <MakeupCalendarPicker month={selected.date.slice(0, 7)} days={days} selectedDate={date} selectedSlot={slot} disabled={locked} onDateChange={value => { setDate(value); setSlot(null) }} onSlotChange={setSlot} />}
            <AdminActionReason value={reason} note={note} onValueChange={setReason} onNoteChange={setNote} disabled={locked} />
            {slot && action === 'reschedule' ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">ย้ายไป {formatThaiDateWithWeekday(slot.date)} · {slot.start}–{slot.end} · {slot.branchName}<br />ใช้สิทธิ์เดิม · ไม่เพิ่มจำนวนรอบ</p> : null}
            {!selectedSlotValid && !locked ? <p role="alert" className="text-sm text-red-700">รอบที่เลือกไม่พร้อมแล้ว กรุณาเลือกใหม่</p> : null}
            {uncertain ? <p role="status" className="text-sm text-amber-800">ยังยืนยันผลไม่ได้ เก็บคำขอเดิมไว้แล้ว การตรวจซ้ำไม่สร้างรายการซ้ำ</p> : null}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={locked} onClick={() => setSelected(null)}>ยกเลิก</Button><Button className="bg-[#f57e3b] hover:bg-[#e06d2e]" disabled={saving || (!uncertain && (!fullReason || selected.identity_valid === false || selected.has_attendance || (action === 'reschedule' && (!slot || !selectedSlotValid))))} onClick={() => void submit()}>{saving ? 'กำลังบันทึก...' : uncertain ? 'ตรวจสอบคำขอเดิม' : action === 'store' ? 'ยืนยันเก็บเข้ากระเป๋า' : 'ยืนยันย้ายวัน/รอบ'}</Button></div>
          </>}
        </div> : null}
      </DialogContent>
    </Dialog>
  </section>
}
