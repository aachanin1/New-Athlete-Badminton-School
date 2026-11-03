'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {AdminActionReason,adminActionReason} from '@/components/admin/admin-action-reason'
import {MakeupCalendarPicker,useMakeupCalendarNow} from '@/components/admin/makeup-calendar-picker'
import {MakeupHistoryDialog} from '@/components/admin/makeup-history-dialog'
import {MakeupCreditApproval} from '@/components/admin/makeup-credit-approval'
import {ListPagination} from '@/components/admin/list-pagination'
import {useMakeupOptions} from '@/components/admin/use-makeup-options'
import {courseMakeupCalendarDays,type MakeupCalendarSlot} from '@/lib/makeup-calendar'
import {adminMakeupCurrentMonth} from '@/lib/admin-makeup-month'
import {formatThaiDateTimeWithWeekday,formatThaiDateWithWeekday,formatThaiMonthYear,getBangkokDateKey} from '@/lib/date-format'
import {makeupOverlap,makeupCardDestinations,type MakeupWorkspaceCard} from '@/lib/admin-makeup-workspace'
import {availableFamilyMakeupCount,type KidsFamilyMakeupSource} from '@/lib/kids-family-makeup'
import {forgetMakeupOperation,sendMakeupOperation} from '@/lib/admin-makeup-operation-client'
import type {MakeupHistorySubject} from '@/lib/admin-makeup-history'
import type {BranchOption} from '@/lib/admin-makeup-read-model'
import type {MakeupContinuation} from '@/components/admin/admin-lesson-manager'

const pendingKey='nasc-admin-makeup-workspace-v2'
export function AdminMakeupWorkspace({month,active,blocked,revision,branches,search,branch,course,status,onSavingChange,continuation,onContinuationHandled}:{
 month:string;active:boolean;branches:BranchOption[];search:string;branch:string;course:string;status:string
 blocked:boolean;revision:number
 onSavingChange:(value:boolean)=>void;continuation:MakeupContinuation|null;onContinuationHandled:()=>void
}){
 const [page,setPage]=useState(1),[pageScope,setPageScope]=useState(''),[epoch,setEpoch]=useState(0)
 const scope=JSON.stringify([month,course,branch,search,status]),currentPage=pageScope===scope?page:1,key=JSON.stringify([scope,currentPage,epoch,revision])
 const [list,setList]=useState<{key:string;cards:MakeupWorkspaceCard[];total:number}|null>(null),[loading,setLoading]=useState(false),[listError,setListError]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [selected,setSelected]=useState<MakeupWorkspaceCard|null>(null),[mode,setMode]=useState<'use'|'grant'>('use'),[reading,setReading]=useState(false)
 const [history,setHistory]=useState<MakeupHistorySubject|null>(null),[child,setChild]=useState(''),[sourceId,setSourceId]=useState('')
 const [revoking,setRevoking]=useState<{grantId:string;title:string}|null>(null)
 const [targetMonth,setTargetMonth]=useState(()=>adminMakeupCurrentMonth()),[date,setDate]=useState(''),[slot,setSlot]=useState<MakeupCalendarSlot|null>(null)
 const [reason,setReason]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[approvalBusy,setApprovalBusy]=useState(false),[notRecorded,setNotRecorded]=useState(false)
 const request=useRef<Record<string,unknown>|null>(null),inFlight=useRef(false),readRevision=useRef(0),continued=useRef('')
 const now=useMakeupCalendarNow(Boolean(selected)),calendarMonth=targetMonth<adminMakeupCurrentMonth(now)?adminMakeupCurrentMonth(now):targetMonth
 const source=selected?.sources.find(s=>s.sourceSessionId===sourceId)
 const attending=selected?.course==='private'&&mode==='use'&&source?.kind==='absent'?selected.learners.filter(l=>(l.childId??(l.id==='self'?null:l.id))===(source.sourceChildId||null)):selected?.learners||[]
 const children=selected?.course==='kids_group'?[child||'']:attending.map(l=>l.childId??(l.id==='self'?null:l.id))
 const options=useMakeupOptions(Boolean(selected)&&children.length>0&&children.every(id=>id!==''),selected?{parentId:selected.parentId,children:children.map(id=>id==='self'?null:id),month:calendarMonth,legacy:mode==='use'&&selected.course!=='kids_group'&&source?.kind==='absent'}:undefined)
 const days=useMemo(()=>{
  const duration=selected?.course==='private'?(mode==='grant'?selected.durationMinutes:source?.kind==='wallet'?source.durationMinutes:null):null
  const expiry=mode==='use'&&selected?.course!=='kids_group'&&source?.kind==='wallet'&&source.expiresAt?getBangkokDateKey(new Date(source.expiresAt)):null
  const minutes=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m}
  return courseMakeupCalendarDays(selected?.course||course,calendarMonth,branches,options.templates,now).filter(d=>!expiry||d.dateInput<=expiry).map(d=>({...d,slotsByBranch:d.slotsByBranch.map(b=>({...b,slots:b.slots.filter(s=>!duration||minutes(s.end)-minutes(s.start)===duration)})).filter(b=>b.slots.length>0)})).filter(d=>d.slotsByBranch.length>0)
 },[selected?.course,selected?.durationMinutes,source?.kind,source?.durationMinutes,source?.expiresAt,mode,course,calendarMonth,branches,options.templates,now])
 const current=list?.key===key&&!loading&&!listError?list:null,locked=blocked||saving||uncertain||approvalBusy
 const fullReason=adminActionReason(reason,note)
 const sourceReady=mode==='grant'?Boolean(selected?.additionalAvailable):Boolean(source&&(selected?.course!=='kids_group'||selected.family?.eligible))
 const conflict=(day:string,start:string,end:string)=>makeupOverlap(options.busy,day,start,end)?makeupOverlap(options.busy.filter(b=>b.cancelled),day,start,end)?'มีรายการเดิมที่ต้องตรวจประวัติ':'ผู้เรียนมีเรียนเวลานี้แล้ว':null
 const validSlot=Boolean(slot&&options.ready&&days.some(d=>d.dateInput===slot.date&&d.slotsByBranch.some(b=>b.branch.id===slot.branchId&&b.slots.some(s=>s.templateId===slot.templateId&&s.start===slot.start&&s.end===slot.end)))&&!conflict(slot.date,slot.start,slot.end))
 useEffect(()=>{if(slot&&options.ready&&!validSlot&&!locked){setSlot(null);setError('รอบที่เลือกเปลี่ยนหรือไม่พร้อมใช้งานแล้ว กรุณาเลือกรอบใหม่')}},[slot,options.ready,validSlot,locked])
 useEffect(()=>{
  if(!active)return
  const controller=new AbortController();setLoading(true);setListError('')
  const timer=setTimeout(()=>{void fetch('/api/admin/makeup/workspace?'+new URLSearchParams({month,course,search:search.trim(),branch,status,page:String(currentPage)}),{cache:'no-store',signal:controller.signal}).then(async r=>{
   const data=await r.json();if(!r.ok||!Array.isArray(data.cards))throw Error(data.error||'อ่านสิทธิ์ไม่สำเร็จ')
   if(!controller.signal.aborted){const last=Math.max(1,Math.ceil(data.total/10));if(currentPage>last){setPageScope(scope);setPage(last)}else setList({...data,key})}
  }).catch(e=>{if(!controller.signal.aborted)setListError(e instanceof Error?e.message:'อ่านสิทธิ์ไม่สำเร็จ')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},200)
  return()=>{clearTimeout(timer);controller.abort()}
 },[active,month,course,search,branch,status,currentPage,scope,key])
 useEffect(()=>{onSavingChange(locked);return()=>onSavingChange(false)},[locked,onSavingChange])
 async function readCard(reference:string,m:string,signal?:AbortSignal){
  const r=await fetch('/api/admin/makeup/workspace?'+new URLSearchParams({reference,month:m}),{cache:'no-store',signal}),data=await r.json()
  if(!r.ok||!data.reference)throw Error(data.error||'อ่านสิทธิ์ล่าสุดไม่ได้');return data as MakeupWorkspaceCard
 }
 function selectCard(card:MakeupWorkspaceCard,kind:'use'|'grant',preferred?:string){
  setSelected(card);setMode(kind);setDate('');setSlot(null);setTargetMonth(adminMakeupCurrentMonth());setReason('');setNote('');setError('')
  const source=card.sources.find(s=>s.sourceSessionId===preferred)||card.sources[0];setSourceId(source?.sourceSessionId||'')
  setChild(card.course==='kids_group'?(source?.sourceChildId||card.learners[0]?.id||''):card.learners[0]?.id||'')
 }
 async function open(card:MakeupWorkspaceCard,kind:'use'|'grant'){
  if(request.current||inFlight.current)return
  const revision=++readRevision.current;selectCard(card,kind);setReading(true)
  try{const fresh=await readCard(card.reference,card.month);if(revision===readRevision.current){
   if(kind==='grant'&&!fresh.additionalAvailable||kind==='use'&&fresh.sources.length===0){setSelected(null);setError(fresh.sources.length?'มีต้นทางที่ใช้ได้แล้ว กรุณาเลือกชดเชยจากต้นทางเดิม':'สิทธิ์หรือสถานะเปลี่ยนแล้ว กรุณาตรวจรายการล่าสุด');setEpoch(n=>n+1)}else selectCard(fresh,kind)
  }}catch(e){if(revision===readRevision.current){setError(e instanceof Error?e.message:'อ่านสิทธิ์ไม่ได้');setSelected(null)}}finally{if(revision===readRevision.current)setReading(false)}
 }
 useEffect(()=>{
  if(!active||!continuation||continued.current===continuation.key||request.current||inFlight.current)return
  const controller=new AbortController();setReading(true)
  void readCard(continuation.sourceSessionId,continuation.sourceMonth,controller.signal).then(card=>{
   if(controller.signal.aborted)return;continued.current=continuation.key;selectCard(card,'use',continuation.sourceSessionId);setChild(continuation.childId);setReason(continuation.reason);setNote(continuation.note);onContinuationHandled()
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'อ่านต้นทางไม่ได้')}).finally(()=>{if(!controller.signal.aborted)setReading(false)})
  return()=>controller.abort()
 },[active,continuation,onContinuationHandled,uncertain])
 useEffect(()=>{
  const pending=sessionStorage.getItem(pendingKey);if(!pending)return
  setUncertain(true);setError('กำลังตรวจคำขอเดิมก่อนทำรายการใหม่')
  const controller=new AbortController()
  void fetch('/api/admin/makeup/workspace?request='+encodeURIComponent(pending),{cache:'no-store',signal:controller.signal}).then(async r=>{
   const data=await r.json();if(r.ok&&data.payload===null){if(!controller.signal.aborted){sessionStorage.removeItem(pendingKey);setUncertain(false);setError('')}return}if(!r.ok||!data.payload)throw Error(data.error||'ยังอ่านคำขอเดิมไม่ได้')
   if(controller.signal.aborted)return;request.current=data.payload;setUncertain(true);setError('มีคำขอเดิมที่ต้องตรวจผลก่อนทำรายการใหม่')
  }).catch(e=>{if(!controller.signal.aborted){setUncertain(true);setError(e instanceof Error?e.message:'อ่านคำขอเดิมไม่ได้')}})
  return()=>controller.abort()
 },[])
 async function submit(){
  if(inFlight.current||reading)return
  if(!request.current){
   if(!selected||!validSlot||!slot||!sourceReady||!fullReason)return
   request.current={operation:mode,reference:selected.reference,month:selected.month,childId:child==='self'?null:child,templateId:slot.templateId,date:slot.date,branchId:slot.branchId,startTime:slot.start,endTime:slot.end,requestId:crypto.randomUUID(),reason:fullReason,...(mode==='use'?{sourceId}: {})}
  }
  inFlight.current=true;setSaving(true);setError('');let resolved=false
  try{
   let response:Response,data:Record<string,unknown>
   if(request.current.operation==='use'&&selected?.course==='kids_group'){
    const body={parent_id:selected.parentId,source_month:selected.month,original_session_id:sourceId,attending_child_id:child,schedule_template_id:request.current.templateId,branch_id:slot?.branchId,makeup_date:request.current.date,start_time:slot?.start,end_time:slot?.end,request_id:request.current.requestId,reason:request.current.reason}
    const result=await sendMakeupOperation('use',body,uncertain&&!notRecorded);response=result.response;data=result.data
    if(response.ok&&data.confirmed===false){setNotRecorded(true);throw Error('ยังไม่พบผลบันทึก กดตรวจผลอีกครั้งเพื่อส่งคำขอเดิมได้')}
   }else{
    const prepared=await fetch('/api/admin/makeup/workspace',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({...request.current,prepare_only:true})}),preparation=await prepared.json()
    if(!prepared.ok||preparation.prepared!==true){if(prepared.status>=400&&prepared.status<500)resolved=true;throw Error(preparation.error||'ยังเตรียมคำขอเดิมไม่ได้')}
    sessionStorage.setItem(pendingKey,String(request.current.requestId))
    response=await fetch('/api/admin/makeup/workspace',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify(request.current)});data=await response.json()
   }
   if(!response.ok||!data.success){if(response.status>=400&&response.status<500&&data.code!=='TASK10_IDEMPOTENCY_CONFLICT')resolved=true;throw Error(String(data.error||'ยังยืนยันผลไม่ได้ กรุณาตรวจคำขอเดิม'))}
   if(request.current.operation!=='revoke')await readCard(String(request.current.reference),String(request.current.month))
   resolved=true;setSuccess('บันทึกเรียบร้อยแล้ว · ตารางเรียนและประวัติอัปเดตแล้ว');setSelected(null);setRevoking(null);setEpoch(n=>n+1)
  }catch(e){const message=e instanceof Error?e.message:'ยังตรวจผลไม่ได้';setError(!resolved&&/fetch|timeout|timed out|aborted/i.test(message)?'ยังยืนยันผลไม่ได้ กรุณาตรวจผลคำขอเดิม':message);if(resolved){options.retry();setEpoch(n=>n+1);if(selected)try{const fresh=await readCard(selected.reference,selected.month);setSelected(fresh);if(!fresh.sources.some(s=>s.sourceSessionId===sourceId))setSourceId('')}catch{setError('รายการถูกปฏิเสธ และยังอ่านสิทธิ์ล่าสุดไม่ได้ กรุณาปิดแล้วลองเปิดใหม่')}}}
  finally{inFlight.current=false;setSaving(false);setUncertain(!resolved);if(resolved){forgetMakeupOperation(String(request.current?.requestId));sessionStorage.removeItem(pendingKey);request.current=null;setNotRecorded(false)}}
 }
 if(!active)return uncertain?<section aria-label="คำขอชดเชยที่ต้องตรวจผล" className="space-y-3"><p role="alert">{error}</p><Button disabled={saving} onClick={()=>void submit()}>ตรวจผลคำขอเดิม</Button></section>:null
 return <section aria-label="รายการสิทธิ์ชดเชย" className="space-y-3">
  {loading?<p role="status">กำลังอ่านสิทธิ์...</p>:null}
  {listError?<p role="alert" className="text-red-700">{listError} <Button variant="outline" disabled={locked} onClick={()=>setEpoch(n=>n+1)}>ลองใหม่</Button></p>:null}
  {error?<p role="alert" className="text-red-700">{error} {!locked?<Button variant="outline" onClick={()=>{setError('');setEpoch(n=>n+1)}}>ลองใหม่</Button>:null}</p>:null}
  {success?<p role="status" className="text-emerald-700">{success}</p>:null}
  {uncertain?<Button onClick={()=>void submit()} disabled={saving}>ตรวจผลคำขอเดิม</Button>:null}
  {!loading&&current&&!current.cards.length?<p>ไม่พบผู้เรียนที่เคยซื้อคอร์สตามเงื่อนไขนี้</p>:null}
  {!loading&&current?<p className="text-sm text-gray-500">พบ {current.total} รายการ</p>:null}
  {current?.cards.map(card=><Card key={card.reference} data-testid={'makeup-card-'+card.reference} className={card.course==='adult_group'?'border-emerald-200':card.course==='private'?'border-orange-200':'border-blue-200'}><CardContent className="space-y-3 p-4">
   <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-[#153c85]">{card.learners.map(l=>l.name).join(' · ')}</p><p className="text-sm text-gray-600">ผู้ปกครอง / ผู้ซื้อ {card.parentName}</p></div><Badge variant="outline">{formatThaiMonthYear(card.month+'-01')}</Badge></div>
   {card.family?<p>โควตา {card.family.quota} · ใช้แล้ว {card.family.used} · เหลือ {card.family.remaining} · ใช้ได้ตอนนี้ {availableFamilyMakeupCount(card.family)} ครั้ง</p>:<p>{card.course==='private'?'กระเป๋านับชั่วโมงต่อหน่วยครอบครัว · ขาดเรียนตามสิทธิ์รายผู้เรียนเดิม':'สิทธิ์ตามคอร์สเดิม · หน่วยครั้ง'}</p>}
   <div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline" className="bg-purple-50 text-purple-800">กระเป๋า {card.sources.filter(s=>s.kind==='wallet').length}</Badge><Badge variant="outline" className="bg-orange-50 text-orange-800">ขาดเรียน {card.sources.filter(s=>s.kind==='absent').length}</Badge></div>
   {card.sources.length===0?<p className="text-sm text-gray-600">ไม่มีต้นทางที่ยังใช้ได้</p>:null}
   {makeupCardDestinations(card).map(d=><div key={d.id} className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"><p>{d.additional?'ชดเชยเพิ่มเติมโดย Admin':'จองชดเชยแล้ว'} · {d.childName}</p><p>{formatThaiDateWithWeekday(d.date)} · {d.startTime.slice(0,5)}–{d.endTime.slice(0,5)} · {d.branchName}{d.cancelled?' · ยกเลิกแล้ว':''}</p>{d.additional&&d.grantId&&!d.cancelled?<Button variant="outline" size="sm" disabled={locked} onClick={()=>{setReason('');setNote('');setRevoking({grantId:d.grantId!,title:formatThaiDateWithWeekday(d.date)+' · '+d.childName})}}>ยกเลิกรายการเพิ่มเติม</Button>:null}</div>)}
   <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={locked} onClick={()=>setHistory({parentId:card.parentId,month:card.month,course:card.course,childId:card.course==='kids_group'?null:card.learners[0]?.childId??null,title:card.learners.map(l=>l.name).join(' · '),...(card.course==='private'?{reference:card.reference}:{})})}>ดูประวัติ</Button>
    {card.sources.length>0?<Button disabled={locked} onClick={()=>void open(card,'use')}>เลือกวันชดเชย</Button>:card.additionalAvailable?<Button disabled={locked} onClick={()=>void open(card,'grant')}>จัดชดเชยเพิ่มเติม</Button>:null}
   </div>
  </CardContent></Card>)}
  {current&&current.total>10?<ListPagination page={currentPage} total={current.total} pageSize={10} pageSizeOptions={[10]} onPageChange={v=>{setPageScope(scope);setPage(v)}} onPageSizeChange={()=>{}}/>:null}
  <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open&&!locked){readRevision.current++;setSelected(null)}}}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" onEscapeKeyDown={e=>{if(locked)e.preventDefault()}} onInteractOutside={e=>{if(locked)e.preventDefault()}}>
   <DialogHeader><DialogTitle>{mode==='grant'?'จัดชดเชยเพิ่มเติม':'เลือกวันชดเชย'}</DialogTitle><DialogDescription>{mode==='grant'?'จัดเพิ่มเติมโดย Admin · ไม่ใช้กระเป๋าหรือโควตาปกติ':'เลือกผู้เข้าเรียน วัน สาขา และรอบเรียนจริงตามสิทธิ์เดิม'}</DialogDescription></DialogHeader>
   {selected?<div className="space-y-4">
    {reading?<p role="status">กำลังตรวจสิทธิ์ล่าสุด...</p>:null}
    {selected.course==='kids_group'?<label className="block space-y-2 text-sm">ผู้เข้าเรียน<Select value={child} disabled={locked||reading} onValueChange={v=>{setChild(v);setDate('');setSlot(null)}}><SelectTrigger aria-label="ผู้เข้าเรียน"><SelectValue/></SelectTrigger><SelectContent>{selected.learners.map(l=><SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></label>:<p>ผู้เข้าเรียน: {attending.map(l=>l.name).join(' · ')}</p>}
    {mode==='use'?<label className="block space-y-2 text-sm">ต้นทางที่จะใช้<Select value={sourceId} disabled={locked||reading} onValueChange={id=>{setSourceId(id);setDate('');setSlot(null)}}><SelectTrigger aria-label="ต้นทางที่จะใช้"><SelectValue placeholder="เลือกต้นทาง"/></SelectTrigger><SelectContent>{selected.sources.map(s=><SelectItem key={s.sourceSessionId} value={s.sourceSessionId}>{s.kind==='wallet'?'กระเป๋า':'ขาดเรียน'} · {formatThaiDateWithWeekday(s.sourceDate)}</SelectItem>)}</SelectContent></Select></label>:null}
    {mode==='use'&&selected.family&&source?<><p className="text-sm">เจ้าของต้นทาง: {selected.learners.find(l=>l.id===source.sourceChildId)?.name||'ตามรายการเดิม'} → ผู้เข้าเรียน: {selected.learners.find(l=>l.id===child)?.name}</p><MakeupCreditApproval source={source as KidsFamilyMakeupSource} family={selected.family} disabled={locked} initialReason={fullReason} onBusyChange={setApprovalBusy} onDecided={async()=>{setSelected(await readCard(selected.reference,selected.month))}}/></>:null}
    {mode==='use'&&(source?.expiresAt||selected.family?.expiresAt)?<p className="text-sm text-gray-600">ต้องใช้สิทธิ์ภายใน {formatThaiDateTimeWithWeekday(new Date(source?.expiresAt||selected.family!.expiresAt))} · คงอายุสิทธิ์เดิม</p>:null}
    {options.loading?<p role="status">กำลังอ่านรอบเรียนและตารางผู้เรียน...</p>:null}
    {options.error?<p role="alert">{options.error} <Button onClick={options.retry}>ลองใหม่</Button></p>:null}
    {options.ready?<MakeupCalendarPicker month={calendarMonth} days={days} selectedDate={date} selectedSlot={slot} disabled={locked||reading} conflict={conflict} onMonthChange={m=>{setTargetMonth(m);setDate('');setSlot(null)}} onDateChange={d=>{setDate(d);setSlot(null)}} onSlotChange={s=>{setSlot(s);setError('')}}/>:null}
    <AdminActionReason value={reason} note={note} onValueChange={setReason} onNoteChange={setNote} disabled={locked}/>
    {slot?<div className="rounded-lg bg-blue-50 p-3 text-sm">{attending.filter(l=>selected.course!=='kids_group'||l.id===child).map(l=>l.name).join(' · ')} · {formatThaiDateWithWeekday(slot.date)} · {slot.start.slice(0,5)}–{slot.end.slice(0,5)} · {slot.branchName}<p>{mode==='grant'?'ชดเชยเพิ่มเติม 1 รอบ · ไม่หักโควตาปกติ':'ใช้ต้นทาง 1 หน่วยตามกติกาเดิม'}</p></div>:null}
    {error?<p role="alert" className="text-red-700">{error}</p>:null}
    <Button disabled={locked||reading||!validSlot||!sourceReady||!fullReason} onClick={()=>void submit()}>{saving?'กำลังบันทึก...':'ยืนยันจัดวันชดเชย'}</Button>
    {uncertain?<Button disabled={saving} onClick={()=>void submit()}>ตรวจผลคำขอเดิม</Button>:null}
   </div>:null}
  </DialogContent></Dialog>
  <Dialog open={Boolean(revoking)} onOpenChange={open=>{if(!open&&!locked)setRevoking(null)}}><DialogContent><DialogHeader><DialogTitle>ยกเลิกรายการชดเชยเพิ่มเติม</DialogTitle><DialogDescription>{revoking?.title} · ยกเลิกทั้งหน่วย โดยไม่คืนเงินหรือเพิ่มสิทธิ์กระเป๋า</DialogDescription></DialogHeader><AdminActionReason value={reason} note={note} onValueChange={setReason} onNoteChange={setNote} disabled={locked}/>{error?<p role="alert">{error}</p>:null}<Button disabled={locked||!fullReason} onClick={()=>{if(!revoking)return;request.current={operation:'revoke',grantId:revoking.grantId,requestId:crypto.randomUUID(),reason:fullReason};void submit()}}>ยืนยันยกเลิกรายการเพิ่มเติม</Button></DialogContent></Dialog>
  <MakeupHistoryDialog subject={history} onClose={()=>setHistory(null)}/>
 </section>
}
