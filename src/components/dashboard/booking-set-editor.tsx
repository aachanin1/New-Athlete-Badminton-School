'use client'
import {useEffect,useRef,useState} from 'react'
import {CalendarDays,Clock} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {BookingCalendar} from './booking-calendar'
import {BookingChoice} from './booking-choice'
import { BookingFlowSteps, BookingCalendarHeading, BookingLearnerTabs, BookingReviewCard } from './booking-flow-ui'
import { BookingBillSummary } from './booking-bill-summary'
import {formatThaiDateWithWeekday} from '@/lib/date-format'
import {packageExpiryAt,packageRoundWithinExpiry,packageValidityDescription,PACKAGE_DATE_ERROR} from '@/lib/booking-package-validity'
import {checkoutRequest} from '@/lib/booking-checkout'
import {getTemplateSlots,type ScheduleTemplateOption} from '@/lib/schedule-template-utils'
import type {CourseTypeName} from '@/types/database'
import type {PaymentState,Bill} from './booking-payment-client'
import {formatLearnerDisplayName} from '@/lib/learner-display-name'

type Round={date:string;startTime:string;endTime:string;branchId:string;childId:string|null;scheduleTemplateId?:string|null;origin?:{label:string;branchId:string}}
type EditorData=PaymentState&{editor:{token:string;templates:Array<{id:string;branch_id:string;course_type_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean;notes:string|null;branches:{slug:string}|null;course_types:{name:CourseTypeName}|null}>;closures:Array<{branch_id:string;closure_date:string}>}}
const label=(s:Round)=>new Date(s.date+'T00:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})+' '+s.startTime.slice(0,5)+'–'+s.endTime.slice(0,5)
const groupRounds=(rounds:Round[],family:boolean)=>{const groups:Array<{indices:number[];round:Round}>=[];rounds.forEach((r,i)=>{const found=family&&groups.find(g=>g.round.date===r.date&&g.round.startTime===r.startTime&&g.round.endTime===r.endTime&&g.round.branchId===r.branchId);if(found)found.indices.push(i);else groups.push({indices:[i],round:r})});return groups}

export function BookingSetEditor({url,onDone,onBack}:{url:string;onDone:()=>void;onBack:()=>void}){
 const [data,setData]=useState<EditorData|null>(null),[rounds,setRounds]=useState<Record<string,Round[]>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState<{total:number}|null>(null),[unknown,setUnknown]=useState(false)
 const [viewMonth,setViewMonth]=useState(''),[activeCourse,setActiveCourse]=useState(''),[activeLearner,setActiveLearner]=useState(''),[selectedBranches,setSelectedBranches]=useState<string[]>([]),[expanded,setExpanded]=useState<string|null>(null)
 const top=useRef<HTMLElement>(null)
 const reviewOpen=Boolean(preview)
 useEffect(()=>{top.current?.scrollIntoView({block:'start'})},[reviewOpen])
 const command=useRef<{id:string;input:unknown}|null>(null),storage='nabs:set-edit:'+url
 useEffect(()=>{let alive=true;setBusy(true);void checkoutRequest<EditorData>(url+'&editor=1').then(d=>{if(!alive)return;setData(d);setActiveCourse(d.bookings[0]?.course_type_id||'');setActiveLearner(d.sessions.find(s=>s.booking_id===d.bookings[0]?.id)?.child_id||d.bookings[0]?.package_participants?.[0]||'self');setSelectedBranches([...new Set(d.sessions.map(s=>s.branch_id).concat(d.bookings.map(b=>b.branch_id)))]);setViewMonth((d.sessions.find(s=>s.booking_id===d.bookings[0]?.id)?.date||String(d.bookings[0]?.year)+'-'+String(d.bookings[0]?.month).padStart(2,'0')).slice(0,7));setRounds(Object.fromEntries(d.bookings.map(b=>[b.id,d.sessions.filter(s=>s.booking_id===b.id&&!['cancelled','walleted','rescheduled'].includes(s.status)).map(s=>({date:s.date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),branchId:s.branch_id,childId:s.child_id,origin:{label:label({date:s.date,startTime:s.start_time,endTime:s.end_time,branchId:s.branch_id,childId:s.child_id}),branchId:s.branch_id}}))])));try{const saved=sessionStorage.getItem(storage);if(saved){command.current=JSON.parse(saved);setUnknown(true);setError('มีคำขอบันทึกที่ยังไม่ทราบผล ตรวจคำขอเดิมก่อนแก้ต่อ')}}catch{}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[url,storage])
 const recover=async()=>{if(!command.current)return;setBusy(true);try{const r=await checkoutRequest<{found:boolean}>('/api/booking-checkout?operation=set&requestId='+command.current.id,{},6000);if(r.found){sessionStorage.removeItem(storage);onDone()}else setError('ยังไม่พบผลบันทึก สามารถส่งคำขอเดิมอีกครั้งได้ ระบบจะไม่บันทึกซ้ำ')}catch{setError('ยังตรวจผลไม่ได้ กรุณาลองตรวจอีกครั้ง')}finally{setBusy(false)}}
 const save=async(retry=false)=>{if(!data)return;setBusy(true);setError('');try{if(!retry){command.current={id:crypto.randomUUID(),input:{action:'edit',token:data.editor.token,bookingIds:data.bookings.map(b=>b.id),edits:data.bookings.map(b=>({id:b.id,sessions:rounds[b.id]})),expectedTotal:preview?.total}};sessionStorage.setItem(storage,JSON.stringify(command.current))}const response=await fetch('/api/booking-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set',requestId:command.current!.id,input:command.current!.input}),signal:AbortSignal.timeout(15000)});const r=await response.json();if(!response.ok){if(r.definitive&&!r.requiresReadback){sessionStorage.removeItem(storage);command.current=null;setPreview(null);throw Error(r.error)}setUnknown(true);throw Error(r.error)}sessionStorage.removeItem(storage);onDone()}catch(e){if(command.current)setUnknown(true);setError(e instanceof Error?e.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจคำขอเดิม')}finally{setBusy(false)}}
 const quote=async()=>{if(!data)return;if(invalidRounds){setError(PACKAGE_DATE_ERROR);return}if(data.bookings.some(b=>(!b.package_snapshot||b.total_sessions===1)&&!rounds[b.id]?.length)){setError('กรุณาเลือกวันเรียนอย่างน้อย 1 รอบให้รายการที่ยังว่าง');return}setBusy(true);setError('');try{setPreview(await checkoutRequest('/api/booking-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set',preview:true,requestId:crypto.randomUUID(),input:{action:'edit',token:data.editor.token,bookingIds:data.bookings.map(b=>b.id),edits:data.bookings.map(b=>({id:b.id,sessions:rounds[b.id]}))}})},18000))}catch(e){setError(e instanceof Error?e.message:'ตรวจรายการไม่สำเร็จ')}finally{setBusy(false)}}
 const templates:ScheduleTemplateOption[]=(data?.editor.templates||[]).map(t=>({...t,branch_slug:t.branches?.slug||'',course_type_name:t.course_types?.name||'kids_group',closed_dates:data?.editor.closures.filter(c=>c.branch_id===t.branch_id).map(c=>c.closure_date)}))
 if(!data)return <div role="status" className="rounded-xl border bg-white p-5">{error||'กำลังเปิดวันเรียนทั้งหมดในชุดนี้…'}<Button type="button" variant="outline" className="mt-4 block" onClick={onBack}>กลับไปชำระ</Button></div>
 const courses=[...new Map(data.bookings.map(b=>[b.course_type_id,b.course_types?.name||''])).entries()]
 const courseBills=data.bookings.filter(b=>b.course_type_id===activeCourse),course=courseBills[0]?.course_types?.name
 const participantIds=[...new Set(courseBills.flatMap(b=>b.package_participants||data.sessions.filter(s=>s.booking_id===b.id).map(s=>s.child_id)).map(id=>id||'self'))]
 const name=(id:string)=>{if(id==='self')return data.userName;const c=data.learners.find(c=>c.id===id);return c?formatLearnerDisplayName({fullName:c.full_name,nickname:c.nickname}):'ข้อมูลผู้เรียนไม่ครบ'}
 const branchName=(id:string)=>data.branches.find(b=>b.id===id)?.name||'ไม่มีข้อมูลชื่อสาขา'
 const courseTitle=(c:string)=>c==='kids_group'?'กลุ่มเด็ก':c==='private'?'Private':'กลุ่มผู้ใหญ่'
 const eligible=courseBills.filter(b=>course!=='kids_group'||b.child_id===activeLearner||data.sessions.some(s=>s.booking_id===b.id&&s.child_id===activeLearner))
 const expiryByBill=new Map(eligible.map(b=>[b.id,b.package_expiry||packageExpiryAt(b.package_snapshot,data.serverNow)]))
 const expiryMonths=eligible.map(b=>expiryByBill.get(b.id)).filter((v):v is string=>Boolean(v))
 const lastMonth=expiryMonths.length===eligible.length&&expiryMonths.length?new Date(Math.max(...expiryMonths.map(Date.parse))+7*3600000).toISOString().slice(0,7):null
 const invalidRounds=data.bookings.some(b=>(rounds[b.id]||[]).some(r=>!packageRoundWithinExpiry(b.package_expiry||packageExpiryAt(b.package_snapshot,data.serverNow),r.date,r.endTime)))
 const visibleRounds=courseBills.flatMap(b=>(rounds[b.id]||[]).filter(r=>course!=='kids_group'||(r.childId||'self')===activeLearner))
 const key=(r:Round)=>[r.date,r.startTime.slice(0,5),r.endTime.slice(0,5),r.branchId,r.childId||'self'].join('|')
 const original=data.sessions.filter(s=>!['cancelled','walleted','rescheduled'].includes(s.status)).map(s=>({date:s.date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),branchId:s.branch_id,childId:s.child_id}))
 const all=data.bookings.flatMap(b=>rounds[b.id]||[]),oldKeys=new Set(original.map(key)),newKeys=new Set(all.map(key))
 const removed=original.filter(r=>!newKeys.has(key(r))),added=all.filter(r=>!oldKeys.has(key(r)))
 const familyKeys=new Set(data.bookings.filter(b=>b.course_types?.name==='private').flatMap(b=>[...(rounds[b.id]||[]),...data.sessions.filter(s=>s.booking_id===b.id).map(s=>({date:s.date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),branchId:s.branch_id,childId:s.child_id}))]).map(key))
 const count=(rows:Round[])=>new Set(rows.map(r=>familyKeys.has(key(r))?[r.date,r.startTime,r.endTime,r.branchId,'family'].join('|'):key(r))).size
 const slotsFor=(date:string,branchId:string)=>getTemplateSlots(templates,data.branches.find(b=>b.id===branchId)?.slug||'',course as CourseTypeName,new Date(date+'T12:00:00Z').getUTCDay(),date).filter(s=>Date.parse(date+'T'+s.start+':00+07:00')>Math.max(...eligible.map(b=>Date.parse(b.lifecycle.deadline||data.serverNow)),Date.parse(data.serverNow))&&eligible.some(b=>packageRoundWithinExpiry(expiryByBill.get(b.id),date,s.end)))
 const toggle=(date:string,branchId:string,slot:{start:string;end:string;templateId?:string})=>{
   const existing=eligible.find(b=>(rounds[b.id]||[]).some(r=>r.date===date&&r.branchId===branchId&&r.startTime===slot.start&&(course!=='kids_group'||r.childId===activeLearner)))
   if(existing){setRounds(prev=>({...prev,[existing.id]:prev[existing.id].filter(r=>!(r.date===date&&r.branchId===branchId&&r.startTime===slot.start&&(course!=='kids_group'||r.childId===activeLearner)))}));setPreview(null);setError('');return}
   const candidates=eligible.filter(b=>packageRoundWithinExpiry(expiryByBill.get(b.id),date,slot.end)&&(!b.package_snapshot||groupRounds(rounds[b.id],course==='private').length<b.total_sessions)).sort((a,b)=>{
     const deficit=(x:Bill)=>data.sessions.filter(s=>s.booking_id===x.id).length-(rounds[x.id]||[]).length
     return deficit(b)-deficit(a)||(rounds[a.id]||[]).length-(rounds[b.id]||[]).length
   })
   const bill=candidates[0];if(!bill){setError('เลือกครบจำนวนแพ็กเกจแล้ว แตะรอบเดิมเพื่อนำออกก่อนเลือกรอบใหม่');return}
   const members=course==='kids_group'?[activeLearner]:bill.package_participants||[bill.child_id]
   setRounds(prev=>({...prev,[bill.id]:[...prev[bill.id],...members.map(id=>({date,startTime:slot.start,endTime:slot.end,branchId,childId:id==='self'?null:id,scheduleTemplateId:slot.templateId}))]}));setPreview(null);setError('')
 }
 const [year,month]=viewMonth.split('-').map(Number),days=Array.from({length:new Date(year,month,0).getDate()},(_,i)=>viewMonth+'-'+String(i+1).padStart(2,'0'))
 const missing=data.bookings.some(b=>(!b.package_snapshot||b.total_sessions===1)&&!rounds[b.id]?.length)
 const move=(delta:number)=>{if(delta>0&&lastMonth&&viewMonth>=lastMonth)return;setViewMonth(new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7));setExpanded(null)}
 const originalTotal=data.bookings.reduce((n,b)=>n+Number(b.total_price),0)
 return <section ref={top} className="space-y-4" aria-label="แก้ไขวันเรียนทั้งชุด">
   <BookingFlowSteps step={preview ? 2 : 1} />
   <p className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">กำลังแก้รายการเดิม · เวลาชำระเหลือเท่าเดิม · ตรวจสรุปก่อนยืนยันการแก้ไข</p>
   {error&&<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">{error}</div>}
   {unknown?<div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>void recover()}>ตรวจผลคำขอเดิม</Button><Button variant="outline" disabled={busy} onClick={()=>void save(true)}>ส่งคำขอเดิมอีกครั้ง</Button></div>:<>
   {!preview && <>
   {courses.length>1&&<label className="block text-sm font-medium">คอร์สที่กำลังแก้ไข<select aria-label="คอร์สที่กำลังแก้ไข" value={activeCourse} className="mt-1 min-h-11 w-full rounded-xl border p-3" onChange={e=>{const b=data.bookings.find(b=>b.course_type_id===e.target.value)!;setActiveCourse(b.course_type_id);setViewMonth((data.sessions.find(s=>s.booking_id===b.id)?.date||String(b.year)+'-'+String(b.month).padStart(2,'0')).slice(0,7));setActiveLearner(b.package_participants?.[0]||data.sessions.find(s=>s.booking_id===b.id)?.child_id||'self');setExpanded(null)}}>{courses.map(([id,c])=><option key={id} value={id}>{courseTitle(c)}</option>)}</select></label>}
   <div className="grid min-w-0 gap-3 md:grid-cols-2">
     {<div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">ผู้เรียน · {courseTitle(course||'')}</p><p className="break-words font-semibold text-[#153c85]">{participantIds.map(name).join(', ')}</p></div>}
     <BookingChoice disabled={busy} title="สาขา" options={data.branches.filter(b=>b.is_active||selectedBranches.includes(b.id)).map(b=>({id:b.id,label:b.name}))} selected={selectedBranches} removalCount={ids=>courseBills.reduce((n,b)=>n+groupRounds(rounds[b.id],b.course_types?.name==='private').filter(g=>!ids.includes(g.round.branchId)).length,0)} onApply={ids=>{setSelectedBranches(ids);setRounds(prev=>Object.fromEntries(data.bookings.map(b=>[b.id,b.course_type_id===activeCourse?prev[b.id].filter(r=>ids.includes(r.branchId)):prev[b.id]])));setExpanded(null);setPreview(null)}}/>
   </div>
   <div className="space-y-4">
   {eligible.filter(b=>b.package_snapshot).map(b=><p key={b.id} className="rounded-xl bg-blue-50 p-3 text-sm" data-testid={'editor-package-expiry-'+b.id}>แพ็กเกจ {b.total_sessions} {course==='private'?'ชั่วโมง':'ครั้ง'} · {packageValidityDescription(b.package_snapshot!,data.serverNow)}</p>)}
   {invalidRounds&&<p role="alert" className="text-sm font-semibold text-red-700">{PACKAGE_DATE_ERROR} แตะรอบที่เลือกเพื่อนำออกแล้วเลือกวันใหม่</p>}
   <BookingCalendarHeading title={selectedBranches.map(branchName).join(', ')} month={new Date(year,month-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}
     previousDisabled={busy||viewMonth<=data.serverNow.slice(0,7)||!courseBills.every(b=>b.package_snapshot)} nextDisabled={busy||!courseBills.every(b=>b.package_snapshot)||Boolean(lastMonth&&viewMonth>=lastMonth)} onPrevious={()=>move(-1)} onNext={()=>move(1)} />
   {course==='kids_group'&&<BookingLearnerTabs learners={participantIds.map(id=>({id,name:name(id),count:courseBills.flatMap(b=>rounds[b.id]||[]).filter(r=>(r.childId||'self')===id).length}))} activeId={activeLearner} disabled={busy} onChange={id=>{setActiveLearner(id);setExpanded(null)}} />}
   <BookingCalendar invalid={missing} onDay={date=>{if(!busy)setExpanded(expanded===date?null:date)}} days={days.map(date=>({date,selectable:!busy&&(selectedBranches.some(id=>slotsFor(date,id).length>0)||visibleRounds.some(r=>r.date===date)),selected:visibleRounds.some(r=>r.date===date),expanded:expanded===date,selectedCount:visibleRounds.filter(r=>r.date===date).length,existing:[]}))}>
     {expanded&&<div className="mt-4 space-y-3 rounded-lg border bg-gray-50 p-3"><p className="text-sm font-medium"><CalendarDays className="mr-1 inline h-4 w-4"/>{formatThaiDateWithWeekday(expanded)} — เลือกรอบเรียน:</p>
       {selectedBranches.map(id=>{const slots=slotsFor(expanded,id),chosen=visibleRounds.filter(r=>r.date===expanded&&r.branchId===id);const options=[...slots];chosen.forEach(r=>{if(!options.some(s=>s.start===r.startTime))options.push({start:r.startTime,end:r.endTime,templateId:r.scheduleTemplateId||undefined})});return options.length?<div key={id}><p className="mb-1 text-xs text-gray-500">{data.branches.find(b=>b.id===id)?.name}</p><div className="flex flex-wrap gap-2">{options.map(slot=>{const selected=chosen.some(r=>r.startTime===slot.start);return <Button type="button" key={slot.start} size="sm" variant={selected?'default':'outline'} className={selected?'bg-[#2748bf]':''} aria-pressed={selected} disabled={busy} data-testid={'booking-slot-'+expanded+'-'+id+'-'+slot.start} onClick={()=>toggle(expanded,id,slot)}><Clock className="mr-1 h-3 w-3"/>{slot.start} - {slot.end}{selected?' ✓':''}</Button>})}</div></div>:null})}
     </div>}
   </BookingCalendar>
   <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold text-[#153c85]">รวมทั้งชุด {count(all)} รอบ · นำออก {count(removed)} รอบ · เพิ่ม {count(added)} รอบ</p><details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">ดูวันเรียนทั้งหมด</summary><div className="mt-2 max-h-64 space-y-1 overflow-y-auto">{data.bookings.map(b=><div key={b.id}>{groupRounds(rounds[b.id],b.course_types?.name==='private').map((g,i)=><p key={i}>{name(g.round.childId||'self')} · {label(g.round)} · {data.branches.find(x=>x.id===g.round.branchId)?.name}</p>)}</div>)}</div></details></div>
   </div>
   </>}
   {preview && <div data-testid="booking-edit-summary"><BookingReviewCard>
     <div className="grid grid-cols-2 gap-4 text-sm">
       <div><p className="text-gray-500">ประเภทคอร์ส</p><p className="font-medium">{courses.map(([,c])=>courseTitle(c)).join(', ')}</p></div>
       <div><p className="text-gray-500">สาขา</p><p className="font-medium">{[...new Set(all.map(r=>r.branchId).concat(data.bookings.filter(b=>!rounds[b.id]?.length).map(b=>b.branch_id)))].map(branchName).join(', ')}</p></div>
       <div><p className="text-gray-500">ผู้เรียน</p><p className="font-medium">{[...new Set(data.bookings.flatMap(b=>b.package_participants?.length?b.package_participants:(rounds[b.id]?.length?rounds[b.id].map(r=>r.childId):[b.child_id])).map(id=>name(id||'self')))].join(', ')}</p></div>
       <div><p className="text-gray-500">จำนวนรอบที่เลือก</p><p className="font-medium">{count(all)} รอบ</p></div>
     </div>
     {data.bookings.flatMap(b=>{
       const rows=rounds[b.id]||[],ids=b.course_types?.name==='kids_group'?[...new Set(rows.map(r=>r.childId))]:[undefined]
       return (ids.length?ids:[b.child_id]).map(childId=>{
         const sessions=childId===undefined?rows:rows.filter(r=>r.childId===childId)
         return <BookingBillSummary key={b.id+'-'+String(childId)} bill={childId===undefined?b:{...b,package_participants:[childId],child_id:childId}} data={data} showPrice={false} showAllRounds sessions={sessions.map((r,i)=>({id:b.id+'-draft-'+i,booking_id:b.id,branch_id:r.branchId,child_id:r.childId,date:r.date,start_time:r.startTime,end_time:r.endTime,status:'scheduled',children:null}))} />
       })
     })}

     <div className="border-t pt-4 space-y-2">
       <p className="text-sm text-gray-500">ยอดเดิม ฿{originalTotal.toLocaleString()} · นำออก {count(removed)} รอบ · เพิ่ม {count(added)} รอบ</p>
       <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-lg font-medium">ยอดชำระครั้งนี้</p><p className="text-3xl font-bold text-[#2748bf]" data-testid="booking-edit-total">฿{preview.total.toLocaleString()}</p></div>
     </div>
     <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700"><p className="font-medium">หลังจากกดยืนยัน:</p><p>บันทึกการแก้ไขทั้งชุดในรายการเดิม แล้วกลับไปโอนและแนบสลิปตามยอดนี้ โดยใช้กำหนดชำระเดิม</p></div>
   </BookingReviewCard></div>}
   <div className="flex flex-wrap justify-between gap-3 mt-8">
     <Button type="button" variant="outline" disabled={busy} onClick={()=>preview?setPreview(null):onBack()}>{preview?'ย้อนกลับไปแก้วัน':'กลับโดยไม่บันทึก'}</Button>
     <Button type="button" className={preview?'bg-[#f57e3b] hover:bg-[#e06a2a] text-white':'bg-[#2748bf] hover:bg-[#1e3da0]'} disabled={busy||missing||invalidRounds||!selectedBranches.length} onClick={()=>void(preview?save():quote())}>{busy?'กำลังตรวจและบันทึก…':preview?'ยืนยันการแก้ไขและชำระต่อ':'ถัดไป'}</Button>
   </div>
   </>}
 </section>
}
