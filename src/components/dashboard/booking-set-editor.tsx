'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {CalendarDays,Clock,Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BookingCalendar} from './booking-calendar'
import {BookingChoice} from './booking-choice'
import { BookingFlowSteps, BookingCalendarHeading, BookingLearnerTabs } from './booking-flow-ui'
import {formatThaiDateWithWeekday} from '@/lib/date-format'
import {packageExpiryAt,packageRoundWithinExpiry,packageValidityDescription,PACKAGE_DATE_ERROR} from '@/lib/booking-package-validity'
import {checkoutRequest,paymentTimeLeft} from '@/lib/booking-checkout'
import {getTemplateSlots,type ScheduleTemplateOption} from '@/lib/schedule-template-utils'
import type {CourseTypeName} from '@/types/database'
import type {PaymentState,Bill} from './booking-payment-client'
import {formatLearnerDisplayName} from '@/lib/learner-display-name'

type Round={date:string;startTime:string;endTime:string;branchId:string;childId:string|null;scheduleTemplateId?:string|null}
type CouponChange={bookingId:string;action:'keep'|'remove'|'apply';code?:string}
type EditPreview={total:number;quoteToken:string;bills?:Array<Partial<Bill>&{id:string}>;couponWarnings?:Array<{bookingId:string;code:string;message:string}>}
type EditorData=PaymentState&{editor:{token:string;templates:Array<{id:string;branch_id:string;course_type_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean;notes:string|null;branches:{slug:string}|null;course_types:{name:CourseTypeName}|null}>;closures:Array<{branch_id:string;closure_date:string}>}}
const label=(s:Round)=>new Date(s.date+'T00:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})+' '+s.startTime.slice(0,5)+'–'+s.endTime.slice(0,5)
const groupRounds=(rounds:Round[],family:boolean)=>{const groups:Array<{indices:number[];round:Round}>=[];rounds.forEach((r,i)=>{const found=family&&groups.find(g=>g.round.date===r.date&&g.round.startTime===r.startTime&&g.round.endTime===r.endTime&&g.round.branchId===r.branchId);if(found)found.indices.push(i);else groups.push({indices:[i],round:r})});return groups}
const originalBillMembers=(bill:Bill,sessions:PaymentState['sessions'])=>{
 const participants=bill.package_participants?.length?bill.package_participants:sessions.filter(s=>s.booking_id===bill.id&&!['cancelled','walleted','rescheduled'].includes(s.status)).map(s=>s.child_id)
 return [...new Set((participants.length?participants:[bill.child_id]).map(id=>id||'self'))]
}

export function BookingSetEditor({url,onDone,onBack}:{url:string;onDone:()=>void|Promise<void>;onBack:()=>void}){
 const [data,setData]=useState<EditorData|null>(null),[rounds,setRounds]=useState<Record<string,Round[]>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState<EditPreview|null>(null),[unknown,setUnknown]=useState(false)
 const [viewMonth,setViewMonth]=useState(''),[activeCourse,setActiveCourse]=useState(''),[activeLearner,setActiveLearner]=useState(''),[selectedBranches,setSelectedBranches]=useState<string[]>([]),[expanded,setExpanded]=useState<string|null>(null)
 const [couponChanges,setCouponChanges]=useState<Record<string,CouponChange>>({}),[couponInputs,setCouponInputs]=useState<Record<string,string>>({})
 const [membersByBill,setMembersByBill]=useState<Record<string,string[]>>({})
 const originalMembersByBill=useMemo<Record<string,string[]>>(()=>Object.fromEntries((data?.bookings||[]).map(b=>[b.id,originalBillMembers(b,data!.sessions)])),[data])
 const [quotedKey,setQuotedKey]=useState(''),[quoteError,setQuoteError]=useState<{key:string;message:string}|null>(null),[quoteAttempt,setQuoteAttempt]=useState(0)
 const [now,setNow]=useState(Date.now()),clockOffset=useRef(0),quoteGeneration=useRef(0)
 const deadline=data?.bookings.map(b=>b.lifecycle?.deadline).filter((v):v is string=>Boolean(v)).sort()[0]
 const expired=Boolean(deadline&&Date.parse(deadline)<=now),locked=busy||unknown||expired
 const invalidRounds=Boolean(data?.bookings.some(b=>(rounds[b.id]||[]).some(r=>!packageRoundWithinExpiry(b.package_expiry||packageExpiryAt(b.package_snapshot,data.serverNow),r.date,r.endTime))))
 const missingLearners=useMemo(()=>data?.bookings.flatMap(b=>b.course_types?.name==='kids_group'?(membersByBill[b.id]||originalMembersByBill[b.id]||[]).filter(id=>!(rounds[b.id]||[]).some(r=>(r.childId||'self')===id)).map(id=>({billId:b.id,id})):[])||[],[data,membersByBill,originalMembersByBill,rounds])
 const missing=Boolean(missingLearners.length||data?.bookings.some(b=>(!b.package_snapshot||b.total_sessions===1)&&!rounds[b.id]?.length))
 const editInput=useMemo(()=>data?{action:'edit',token:data.editor.token,bookingIds:data.bookings.map(b=>b.id),edits:data.bookings.map(b=>({id:b.id,sessions:rounds[b.id]||[],...((b.course_types?.name==='kids_group'&&!(originalMembersByBill[b.id]||[]).includes('self')||b.course_types?.name==='adult_group'||b.course_types?.name==='private'&&b.package_snapshot)?{participants:(b.course_types?.name==='adult_group'?['self']:membersByBill[b.id]||originalMembersByBill[b.id]||[]).map(id=>id==='self'?null:id)}:{})})),couponChanges:data.bookings.map(b=>couponChanges[b.id]||{bookingId:b.id,action:'keep' as const})}:null,[data,rounds,couponChanges,membersByBill,originalMembersByBill])
 const inputKey=JSON.stringify(editInput),currentPreview=quotedKey===inputKey?preview:null
 const currentQuoteError=quoteError?.key===inputKey?quoteError.message:''
 const quotePending=Boolean(data&&!missing&&!invalidRounds&&!expired&&!unknown&&!currentPreview&&!currentQuoteError)
 const unappliedCode=Object.values(couponInputs).some(value=>Boolean(value.trim()))
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+clockOffset.current),1000);return()=>clearInterval(timer)},[])
 const mutating=useRef(false)
 const command=useRef<{id:string;input:unknown}|null>(null),storage='nabs:set-edit:'+url
 useEffect(()=>{let alive=true;setBusy(true);void checkoutRequest<EditorData>(url+'&editor=1').then(d=>{if(!alive)return;setData(d);setMembersByBill(Object.fromEntries(d.bookings.map(b=>[b.id,originalBillMembers(b,d.sessions)])));clockOffset.current=Date.parse(d.serverNow)-Date.now();setNow(Date.now()+clockOffset.current);setCouponChanges(Object.fromEntries(d.bookings.map(b=>[b.id,{bookingId:b.id,action:'keep' as const}])));setActiveCourse(d.bookings[0]?.course_type_id||'');setActiveLearner(d.sessions.find(s=>s.booking_id===d.bookings[0]?.id)?.child_id||d.bookings[0]?.package_participants?.[0]||'self');setSelectedBranches([...new Set(d.sessions.map(s=>s.branch_id).concat(d.bookings.map(b=>b.branch_id)))]);setViewMonth((d.sessions.find(s=>s.booking_id===d.bookings[0]?.id)?.date||String(d.bookings[0]?.year)+'-'+String(d.bookings[0]?.month).padStart(2,'0')).slice(0,7));setRounds(Object.fromEntries(d.bookings.map(b=>[b.id,d.sessions.filter(s=>s.booking_id===b.id&&!['cancelled','walleted','rescheduled'].includes(s.status)).map(s=>({date:s.date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),branchId:s.branch_id,childId:s.child_id}))])));try{const saved=sessionStorage.getItem(storage);if(saved){command.current=JSON.parse(saved);setUnknown(true);setError('มีคำขอบันทึกที่ยังไม่ทราบผล ตรวจคำขอเดิมก่อนแก้ต่อ')}}catch{}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[url,storage])
 const recover=async()=>{if(!command.current||mutating.current)return;mutating.current=true;setBusy(true);try{const r=await checkoutRequest<{found:boolean}>('/api/booking-checkout?operation=set&requestId='+command.current.id,{},6000);if(r.found){await onDone();sessionStorage.removeItem(storage);command.current=null}else setError('ยังไม่พบผลบันทึก สามารถส่งคำขอเดิมอีกครั้งได้ ระบบจะไม่บันทึกซ้ำ')}catch{setError('ยังตรวจผลไม่ได้ กรุณาลองตรวจอีกครั้ง')}finally{mutating.current=false;setBusy(false)}}
 const save=async(retry=false)=>{
  if(mutating.current||!data||(!retry&&(!editInput||!currentPreview?.quoteToken||quotePending||Boolean(currentPreview.couponWarnings?.length)||unappliedCode||expired||missing||invalidRounds||!selectedBranches.length)))return
  mutating.current=true;setBusy(true);setError('')
  try{
   if(!retry){command.current={id:crypto.randomUUID(),input:{...editInput,expectedTotal:currentPreview!.total,quoteToken:currentPreview!.quoteToken}};sessionStorage.setItem(storage,JSON.stringify(command.current))}
   if(!command.current)throw Error('ไม่พบคำขอบันทึกเดิม กรุณาตรวจสถานะรายการ')
   const response=await fetch('/api/booking-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set',requestId:command.current.id,input:command.current.input}),signal:AbortSignal.timeout(15000)})
   const result=await response.json()
   if(!response.ok){if(result.definitive&&!result.requiresReadback){sessionStorage.removeItem(storage);command.current=null;setUnknown(false);setPreview(null);setQuoteAttempt(value=>value+1);throw Error(result.error)}setUnknown(true);throw Error(result.error)}
   await onDone();sessionStorage.removeItem(storage);command.current=null
  }catch(e){if(command.current)setUnknown(true);setError(e instanceof Error?e.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจคำขอเดิม')}
  finally{mutating.current=false;setBusy(false)}
 }
 useEffect(()=>{
  const generation=++quoteGeneration.current,controller=new AbortController()
  if(!editInput||missing||invalidRounds||expired||unknown||busy)return()=>controller.abort()
  const timer=setTimeout(()=>{
   setQuoteError(null)
   void checkoutRequest<EditPreview>('/api/booking-checkout',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'set',preview:true,requestId:crypto.randomUUID(),input:editInput})},18000)
    .then(result=>{if(!controller.signal.aborted&&generation===quoteGeneration.current){setPreview(result);setQuotedKey(inputKey)}})
    .catch(e=>{if(!controller.signal.aborted&&generation===quoteGeneration.current)setQuoteError({key:inputKey,message:e instanceof Error?e.message:'คำนวณยอดไม่สำเร็จ'})})
  },300)
  return()=>{clearTimeout(timer);controller.abort()}
 },[editInput,inputKey,missing,invalidRounds,expired,unknown,busy,quoteAttempt])
 const templates:ScheduleTemplateOption[]=(data?.editor.templates||[]).map(t=>({...t,branch_slug:t.branches?.slug||'',course_type_name:t.course_types?.name||'kids_group',closed_dates:data?.editor.closures.filter(c=>c.branch_id===t.branch_id).map(c=>c.closure_date)}))
 if(!data)return <div role="status" className="rounded-xl border bg-white p-5">{error||'กำลังเปิดวันเรียนทั้งหมดในชุดนี้…'}<Button type="button" variant="outline" className="mt-4 block" onClick={onBack}>กลับไปชำระ</Button></div>
 const courses=[...new Map(data.bookings.map(b=>[b.course_type_id,b.course_types?.name||''])).entries()]
 const courseBills=data.bookings.filter(b=>b.course_type_id===activeCourse),course=courseBills[0]?.course_types?.name
 const participantIds=[...new Set(courseBills.flatMap(b=>membersByBill[b.id]||originalMembersByBill[b.id]||[]))]
 const name=(id:string)=>{if(id==='self')return data.userName;const c=data.learners.find(c=>c.id===id);return c?formatLearnerDisplayName({fullName:c.full_name,nickname:c.nickname}):'ข้อมูลผู้เรียนไม่ครบ'}
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name||'ไม่มีข้อมูลชื่อสาขา'
 const courseTitle=(c:string)=>c==='kids_group'?'กลุ่มเด็ก':c==='private'?'Private':'กลุ่มผู้ใหญ่'
 const eligible=courseBills.filter(b=>course!=='kids_group'||(membersByBill[b.id]||originalMembersByBill[b.id]||[]).includes(activeLearner))
 const expiryByBill=new Map(eligible.map(b=>[b.id,b.package_expiry||packageExpiryAt(b.package_snapshot,data.serverNow)]))
 const expiryMonths=eligible.map(b=>expiryByBill.get(b.id)).filter((v):v is string=>Boolean(v))
 const lastMonth=expiryMonths.length===eligible.length&&expiryMonths.length?new Date(Math.max(...expiryMonths.map(Date.parse))+7*3600000).toISOString().slice(0,7):null
 const visibleRounds=courseBills.flatMap(b=>(rounds[b.id]||[]).filter(r=>course!=='kids_group'||(r.childId||'self')===activeLearner))
 const unitCounts=data.bookings.reduce((totals,bill)=>{
  const unitKey=(r:Round)=>[r.date,r.startTime.slice(0,5),r.endTime.slice(0,5),r.branchId,bill.course_types?.name==='private'?'family':r.childId||'self'].join('|')
  const original=data.sessions.filter(s=>s.booking_id===bill.id&&!['cancelled','walleted','rescheduled'].includes(s.status)).map(s=>({date:s.date,startTime:s.start_time,endTime:s.end_time,branchId:s.branch_id,childId:s.child_id}))
  const previous=new Set(original.map(unitKey)),current=new Set((rounds[bill.id]||[]).map(unitKey))
  return{all:totals.all+current.size,removed:totals.removed+[...previous].filter(key=>!current.has(key)).length,added:totals.added+[...current].filter(key=>!previous.has(key)).length}
 },{all:0,removed:0,added:0})
 const slotsFor=(date:string,branchId:string)=>getTemplateSlots(templates,data.branches.find(b=>b.id===branchId)?.slug||'',course as CourseTypeName,new Date(date+'T12:00:00Z').getUTCDay(),date).filter(s=>Date.parse(date+'T'+s.start+':00+07:00')>Math.max(...eligible.map(b=>Date.parse(b.lifecycle.deadline||data.serverNow)),Date.parse(data.serverNow))&&eligible.some(b=>packageRoundWithinExpiry(expiryByBill.get(b.id),date,s.end)))
 const toggle=(date:string,branchId:string,slot:{start:string;end:string;templateId?:string})=>{
   if(locked)return
   const existing=eligible.find(b=>(rounds[b.id]||[]).some(r=>r.date===date&&r.branchId===branchId&&r.startTime===slot.start&&(course!=='kids_group'||r.childId===activeLearner)))
   if(existing){setRounds(prev=>({...prev,[existing.id]:prev[existing.id].filter(r=>!(r.date===date&&r.branchId===branchId&&r.startTime===slot.start&&(course!=='kids_group'||r.childId===activeLearner)))}));setPreview(null);setError('');return}
   const candidates=eligible.filter(b=>packageRoundWithinExpiry(expiryByBill.get(b.id),date,slot.end)&&(!b.package_snapshot||groupRounds(rounds[b.id],course==='private').length<b.total_sessions)).sort((a,b)=>{
     const deficit=(x:Bill)=>data.sessions.filter(s=>s.booking_id===x.id).length-(rounds[x.id]||[]).length
     return deficit(b)-deficit(a)||(rounds[a.id]||[]).length-(rounds[b.id]||[]).length
   })
   const bill=candidates[0];if(!bill){setError('เลือกครบจำนวนแพ็กเกจแล้ว แตะรอบเดิมเพื่อนำออกก่อนเลือกรอบใหม่');return}
   const members=course==='kids_group'?[activeLearner]:membersByBill[bill.id]||originalMembersByBill[bill.id]||['self']
   setRounds(prev=>({...prev,[bill.id]:[...prev[bill.id],...members.map(id=>({date,startTime:slot.start,endTime:slot.end,branchId,childId:id==='self'?null:id,scheduleTemplateId:slot.templateId}))]}));setPreview(null);setError('')
 }
 const [year,month]=viewMonth.split('-').map(Number),days=Array.from({length:new Date(year,month,0).getDate()},(_,i)=>viewMonth+'-'+String(i+1).padStart(2,'0'))
 const move=(delta:number)=>{if(locked||delta>0&&lastMonth&&viewMonth>=lastMonth)return;setViewMonth(new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7));setExpanded(null)}
 const chooseCoupon=(bookingId:string,action:CouponChange['action'],code?:string)=>{if(locked)return;setCouponChanges(previous=>({...previous,[bookingId]:{bookingId,action,...(code?{code}:{})}}));setCouponInputs(previous=>({...previous,[bookingId]:''}));setError('')}
 const billNames=(bill:Bill)=>(membersByBill[bill.id]||originalMembersByBill[bill.id]||[]).map(name).join(', ')
 const learnerOptions=data.learners.map(learner=>({id:learner.id,label:formatLearnerDisplayName({fullName:learner.full_name,nickname:learner.nickname})}))
 const participantChangeNotice=(bill:Bill,ids:string[],family=false)=>{
  const removed=(membersByBill[bill.id]||originalMembersByBill[bill.id]||[]).filter(id=>!ids.includes(id))
  if(!removed.length)return null
  const names=removed.map(name).join(', ')
  if(family)return 'ถอด '+names+' ออกจากทุกชั่วโมงของแพ็กเกจ จำนวนชั่วโมงเดิมยังอยู่'
  const count=(rounds[bill.id]||[]).filter(r=>removed.includes(r.childId||'self')).length
  return 'ถอด '+names+' และนำวันเรียนของผู้เรียนนี้ออก '+count+' รอบจากแบบร่าง ผู้เรียนใหม่ต้องเลือกวันเรียนเอง'
 }
 const applyKidsLearners=(bill:Bill,ids:string[])=>{
  if(locked||!ids.length)return
  const selected=[...new Set(ids)],previousMembers=membersByBill[bill.id]||originalMembersByBill[bill.id]||[]
  const newlyAdded=selected.find(id=>!previousMembers.includes(id))
  setMembersByBill(previous=>({...previous,[bill.id]:selected}))
  setRounds(previous=>({...previous,[bill.id]:(previous[bill.id]||[]).filter(r=>selected.includes(r.childId||'self'))}))
  setActiveLearner(newlyAdded||(selected.includes(activeLearner)?activeLearner:selected[0]||''));setExpanded(null);setPreview(null);setError('')
 }
 const applyPrivateLearners=(bill:Bill,ids:string[])=>{
  if(locked||!ids.length)return
  const selected=[...new Set(ids)]
  if(selected.length>20){setError('เลือกผู้เรียนได้ไม่เกิน 20 คน');return}
  setMembersByBill(previous=>({...previous,[bill.id]:selected}))
  setRounds(previous=>({...previous,[bill.id]:groupRounds(previous[bill.id]||[],true).flatMap(group=>selected.map(id=>({...group.round,childId:id==='self'?null:id})))}))
  setExpanded(null);setPreview(null);setError('')
 }
 return <section className="space-y-4" aria-label="แก้ไขวันเรียนและคูปอง" data-booking-mode="edit" data-testid="booking-stage2-editor">
   <BookingFlowSteps step={1} />
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><p>แก้ไขรายการเดิม · บันทึกแล้วกลับไปชำระเงิน</p>{deadline&&<p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4"/>เวลาชำระเหลือ <span data-testid="booking-edit-countdown">{paymentTimeLeft(deadline,now)}</span></p>}</div>
   {expired&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">หมดเวลาแก้ไขรายการแล้ว กรุณากลับไปตรวจสถานะการชำระเงิน</p>}
   {error&&<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">{error}</div>}
   {unknown?<div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>void recover()}>ตรวจผลคำขอเดิม</Button><Button variant="outline" disabled={busy} onClick={()=>void save(true)}>ส่งคำขอเดิมอีกครั้ง</Button></div>:<>
   <>
   {courses.length>1&&<label className="block text-sm font-medium">คอร์สที่กำลังแก้ไข<select aria-label="คอร์สที่กำลังแก้ไข" value={activeCourse} disabled={locked} className="mt-1 min-h-11 w-full rounded-xl border p-3" onChange={e=>{const b=data.bookings.find(b=>b.course_type_id===e.target.value)!;setActiveCourse(b.course_type_id);setViewMonth((data.sessions.find(s=>s.booking_id===b.id)?.date||String(b.year)+'-'+String(b.month).padStart(2,'0')).slice(0,7));setActiveLearner((membersByBill[b.id]||originalMembersByBill[b.id]||[])[0]||'self');setExpanded(null)}}>{courses.map(([id,c])=><option key={id} value={id}>{courseTitle(c)}</option>)}</select></label>}
   <div className="grid min-w-0 gap-3 md:grid-cols-2">
     {course==='kids_group'?<div className="min-w-0 space-y-3">{courseBills.map((bill,index)=>(originalMembersByBill[bill.id]||[]).includes('self')?<div key={bill.id} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">ผู้เรียน · {courseTitle(course)}</p><p className="break-words font-semibold text-[#153c85]">{billNames(bill)}</p></div>:<BookingChoice key={bill.id} disabled={locked} title={courseBills.length>1?'ผู้เรียนรายการ '+(index+1):'ผู้เรียน'} options={learnerOptions} selected={membersByBill[bill.id]||originalMembersByBill[bill.id]||[]} description="เพิ่ม ถอด หรือเปลี่ยนผู้เรียนได้ แต่ละรายการต้องมีอย่างน้อย 1 คน" changeNotice={ids=>participantChangeNotice(bill,ids)} onApply={ids=>applyKidsLearners(bill,ids)}/>)}</div>:course==='private'?<div className="min-w-0 space-y-3">{courseBills.map((bill,index)=>bill.package_snapshot?<BookingChoice key={bill.id} disabled={locked} title={courseBills.length>1?'ผู้เรียนแพ็กเกจ '+(index+1):'ผู้เรียน'} options={[{id:'self',label:data.userName+' (ตนเอง)'},...learnerOptions]} selected={membersByBill[bill.id]||originalMembersByBill[bill.id]||[]} description="เพิ่ม ถอด หรือเปลี่ยนสมาชิกได้ ต้องมีอย่างน้อย 1 คน ทุกชั่วโมงใช้สมาชิกชุดเดียวกัน" changeNotice={ids=>participantChangeNotice(bill,ids,true)} onApply={ids=>applyPrivateLearners(bill,ids)}/>:<div key={bill.id} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">ผู้เรียน · {courseTitle(course)}</p><p className="break-words font-semibold text-[#153c85]">{billNames(bill)}</p></div>)}</div>:<div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">ผู้เรียน · {courseTitle(course||'')}</p><p className="break-words font-semibold text-[#153c85]">{participantIds.map(name).join(', ')}</p></div>}
     <BookingChoice disabled={locked} title="สาขา" options={data.branches.filter(b=>b.is_active||selectedBranches.includes(b.id)).map(b=>({id:b.id,label:b.name}))} selected={selectedBranches} removalCount={ids=>courseBills.reduce((n,b)=>n+groupRounds(rounds[b.id],b.course_types?.name==='private').filter(g=>!ids.includes(g.round.branchId)).length,0)} onApply={ids=>{setSelectedBranches(ids);setRounds(prev=>Object.fromEntries(data.bookings.map(b=>[b.id,b.course_type_id===activeCourse?prev[b.id].filter(r=>ids.includes(r.branchId)):prev[b.id]])));setExpanded(null);setPreview(null)}}/>
   </div>
   <div className="space-y-4">
   {eligible.filter(b=>b.package_snapshot).map(b=><p key={b.id} className="rounded-xl bg-blue-50 p-3 text-sm" data-testid={'editor-package-expiry-'+b.id}>แพ็กเกจ {b.total_sessions} {course==='private'?'ชั่วโมง':'ครั้ง'} · {packageValidityDescription(b.package_snapshot!,data.serverNow)}</p>)}
   {invalidRounds&&<p role="alert" className="text-sm font-semibold text-red-700">{PACKAGE_DATE_ERROR} แตะรอบที่เลือกเพื่อนำออกแล้วเลือกวันใหม่</p>}
   {missingLearners.length>0&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-testid="booking-edit-missing-learner-rounds">เลือกวันเรียนอย่างน้อย 1 รอบให้ {([...new Set(missingLearners.map(learner=>learner.id))]).map(name).join(', ')}</p>}
   <BookingCalendarHeading title={selectedBranches.map(branchName).join(', ')} month={new Date(year,month-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}
     previousDisabled={locked||viewMonth<=data.serverNow.slice(0,7)||!courseBills.every(b=>b.package_snapshot)} nextDisabled={locked||!courseBills.every(b=>b.package_snapshot)||Boolean(lastMonth&&viewMonth>=lastMonth)} onPrevious={()=>move(-1)} onNext={()=>move(1)} />
   {course==='kids_group'&&<BookingLearnerTabs learners={participantIds.map(id=>({id,name:name(id),count:courseBills.flatMap(b=>rounds[b.id]||[]).filter(r=>(r.childId||'self')===id).length}))} activeId={activeLearner} disabled={locked} onChange={id=>{setActiveLearner(id);setExpanded(null)}} />}
   <BookingCalendar invalid={missing} onDay={date=>{if(!locked)setExpanded(expanded===date?null:date)}} days={days.map(date=>({date,selectable:!locked&&(selectedBranches.some(id=>slotsFor(date,id).length>0)||visibleRounds.some(r=>r.date===date)),selected:visibleRounds.some(r=>r.date===date),expanded:expanded===date,selectedCount:courseBills.reduce((total,b)=>total+groupRounds((rounds[b.id]||[]).filter(r=>r.date===date&&(course!=='kids_group'||(r.childId||'self')===activeLearner)),course==='private').length,0),existing:[]}))}>
     {expanded&&<div className="mt-4 space-y-3 rounded-lg border bg-gray-50 p-3"><p className="text-sm font-medium"><CalendarDays className="mr-1 inline h-4 w-4"/>{formatThaiDateWithWeekday(expanded)} — เลือกรอบเรียน:</p>
       {selectedBranches.map(id=>{const slots=slotsFor(expanded,id),chosen=visibleRounds.filter(r=>r.date===expanded&&r.branchId===id);const options=[...slots];chosen.forEach(r=>{if(!options.some(s=>s.start===r.startTime))options.push({start:r.startTime,end:r.endTime,templateId:r.scheduleTemplateId||undefined})});return options.length?<div key={id}><p className="mb-1 text-xs text-gray-500">{data.branches.find(b=>b.id===id)?.name}</p><div className="flex flex-wrap gap-2">{options.map(slot=>{const selected=chosen.some(r=>r.startTime===slot.start);return <Button type="button" key={slot.start} size="sm" variant={selected?'default':'outline'} className={selected?'bg-[#2748bf]':''} aria-pressed={selected} disabled={locked} data-testid={'booking-slot-'+expanded+'-'+id+'-'+slot.start} onClick={()=>toggle(expanded,id,slot)}><Clock className="mr-1 h-3 w-3"/>{slot.start} - {slot.end}{selected?' ✓':''}</Button>})}</div></div>:null})}
     </div>}
   </BookingCalendar>
   <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold text-[#153c85]">รวมทั้งหมด {unitCounts.all} รอบ</p><p className="mt-1 text-xs text-gray-600">นำออก {unitCounts.removed} รอบ · เพิ่ม {unitCounts.added} รอบ</p>{data.bookings.map(b=><div key={b.id} className="mt-3"><p className="text-xs text-gray-600">{billNames(b)}</p><div className="mt-1 flex flex-wrap gap-1">{groupRounds(rounds[b.id]||[],b.course_types?.name==='private').map((group,index)=><Button type="button" variant="outline" size="sm" key={index} className="h-auto max-w-full whitespace-normal bg-white px-2 py-1 text-xs" disabled={locked} aria-label={'นำรอบ '+label(group.round)+' ของ '+(b.course_types?.name==='kids_group'?name(group.round.childId||'self'):billNames(b))+' ออก'} onClick={()=>{setRounds(previous=>({...previous,[b.id]:previous[b.id].filter((_,i)=>!group.indices.includes(i))}));setError('')}}>{b.course_types?.name==='kids_group'?name(group.round.childId||'self')+' · ':''}{label(group.round)} ×</Button>)}</div></div>)}</div>
   </div>
   </>
   <section className="space-y-4 rounded-xl border bg-white p-4" aria-label="รหัสส่วนลดและยอดชำระ" data-testid="booking-edit-checkout-total">
    {data.bookings.map(bill=>{
     const change=couponChanges[bill.id]||{bookingId:bill.id,action:'keep' as const}
     const activeCode=change.action==='apply'?change.code:change.action==='keep'&&bill.coupon_state!=='released'?bill.coupon_code:null
     const quoted=currentPreview?.bills?.find(b=>b.id===bill.id),warning=currentPreview?.couponWarnings?.find(w=>w.bookingId===bill.id)
     return <div key={bill.id} className="space-y-2 border-b pb-4 last:border-b-0" data-testid={'booking-edit-coupon-'+bill.id}>
      <p className="text-sm font-semibold text-[#153c85]">{data.bookings.length>1?billNames(bill)+' · ':''}{courseTitle(bill.course_types?.name||'')}</p>
      <label className="block text-sm font-medium" htmlFor={'edit-coupon-'+bill.id}>รหัสส่วนลด{data.bookings.length>1?'ของรายการนี้':''}</label>
      {activeCode&&<div className={'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3 '+(warning?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50')}><p className="min-w-0 break-words text-sm font-medium">{activeCode}{quoted&&Number(quoted.coupon_discount)>0?' · ลด ฿'+Number(quoted.coupon_discount).toLocaleString():''}</p><Button type="button" size="sm" variant="outline" disabled={locked} onClick={()=>chooseCoupon(bill.id,'remove')}>ไม่ใช้คูปอง</Button></div>}
      {change.action==='remove'&&<p className="text-sm text-gray-600">ไม่ใช้คูปองในรายการนี้{bill.coupon_state==='reserved'?' · คืนสิทธิ์เมื่อบันทึกสำเร็จ':''}</p>}
      <div className="flex min-w-0 gap-2"><input id={'edit-coupon-'+bill.id} value={couponInputs[bill.id]||''} disabled={locked} onChange={event=>setCouponInputs(previous=>({...previous,[bill.id]:event.target.value.toUpperCase()}))} placeholder={activeCode?'กรอกรหัสอื่นเพื่อเปลี่ยน':'กรอกรหัสคูปอง'} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2748bf]/30"/><Button type="button" variant="outline" disabled={locked||!couponInputs[bill.id]?.trim()} onClick={()=>chooseCoupon(bill.id,'apply',couponInputs[bill.id].trim().toUpperCase())}>ใช้โค้ด</Button></div>
      {change.action!=='keep'&&<div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="ghost" disabled={locked} onClick={()=>chooseCoupon(bill.id,'keep')}>{bill.coupon_state!=='released'&&bill.coupon_code?'คืนคูปองเดิม':'กลับไปไม่ใช้คูปอง'}</Button></div>}
      {warning&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-testid="booking-edit-coupon-warning">{warning.message} เลือก “ไม่ใช้คูปอง” หรือปรับวันเรียนให้เข้าเงื่อนไขก่อนบันทึก</p>}
      {quoted&&data.bookings.length>1&&<p className="text-right text-sm font-semibold">ยอดรายการนี้ ฿{Number(quoted.total_price).toLocaleString()}</p>}
     </div>
    })}
    {quotePending&&<p role="status" className="flex items-center gap-2 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin"/>กำลังคำนวณยอดและตรวจคูปอง…</p>}
    {currentQuoteError&&<div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><p>{currentQuoteError}</p><Button type="button" size="sm" variant="outline" disabled={locked} onClick={()=>{setQuoteError(null);setQuoteAttempt(value=>value+1)}}>ตรวจยอดอีกครั้ง</Button></div>}
    {currentPreview&&<div className="space-y-2 border-t pt-3" aria-live="polite"><p className="flex justify-between gap-2 text-sm text-gray-600"><span>ราคาก่อนส่วนลด</span><span>฿{(currentPreview.bills||[]).reduce((sum,b)=>sum+Number(b.coupon_gross??b.total_price??0),0).toLocaleString()}</span></p><p className="flex justify-between gap-2 text-sm text-green-700"><span>ส่วนลดคูปอง</span><span>−฿{(currentPreview.bills||[]).reduce((sum,b)=>sum+Number(b.coupon_discount||0),0).toLocaleString()}</span></p><p className="flex flex-wrap items-center justify-between gap-2 font-bold"><span>ยอดสุทธิ</span><span className="text-3xl text-[#2748bf]" data-testid="booking-edit-total">฿{currentPreview.total.toLocaleString()}</span></p>{currentPreview.total===0&&<p className="text-sm text-green-800">ยอดสุทธิ 0 บาท ยืนยันได้โดยไม่ต้องโอนเงินหรือแนบสลิป</p>}</div>}
    {unappliedCode&&<p role="status" className="text-sm text-amber-900">กด “ใช้โค้ด” เพื่อตรวจรหัสที่กรอก หรือเคลียร์ช่องรหัสก่อนบันทึก</p>}
    <p className="text-xs text-gray-600">ใช้รายการและเวลาชำระเดิม การแก้ไขจะมีผลเมื่อกดบันทึกสำเร็จ</p>
   </section>
   <div className="flex flex-wrap justify-between gap-3 mt-8">
     <Button type="button" variant="outline" disabled={busy||unknown} onClick={onBack}>กลับโดยไม่บันทึก</Button>
     <Button type="button" className="h-auto min-h-11 max-w-[72%] whitespace-normal bg-[#f57e3b] px-4 py-3 text-white hover:bg-[#e06a2a]" data-testid="booking-edit-save" disabled={locked||missing||invalidRounds||!selectedBranches.length||!currentPreview?.quoteToken||quotePending||Boolean(currentPreview?.couponWarnings?.length)||unappliedCode} onClick={()=>void save()}>{busy?'กำลังบันทึก…':'บันทึกการแก้ไขและไปชำระเงิน'}</Button>
   </div>
   </>}
 </section>
}
