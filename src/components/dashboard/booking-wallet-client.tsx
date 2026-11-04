'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock,MapPin,RefreshCw,Users,X,Info} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {BookingCalendar} from './booking-calendar'
import {BookingChoice} from './booking-choice'
import {BookingCalendarHeading,BookingLearnerTabs} from './booking-flow-ui'
import {BookingWalletRules} from './booking-wallet-rules'
import {BookingWalletHistory} from './booking-wallet-history'
import {walletSelfUseCount,type WalletRules,type WalletHistoryPage} from '@/lib/booking-wallet-view'
import {walletGroupKey} from '@/lib/booking-wallet-group'
import {walletGroupBalance,walletSourceQuantity,walletDurationMatches,type WalletInventory,type WalletInventorySource} from '@/lib/booking-wallet-inventory'
import {checkoutRequest} from '@/lib/booking-checkout'
import {getBangkokDateString} from '@/lib/utils'
import {familyMakeupReason,type KidsFamilyMakeupState} from '@/lib/kids-family-makeup'
import {formatLearnerDisplayName} from '@/lib/learner-display-name'
type Course='kids_group'|'adult_group'|'private'
interface Template{id:string;branch_id:string;day_of_week:number;start_time:string;end_time:string;course_types:{name:Course}}
interface WalletData extends WalletInventory{branches:Array<{id:string;name:string}>;templates:Template[];children:Array<{id:string;full_name:string;nickname:string|null}>;userName:string;rules:WalletRules;closures:Array<{branch_id:string;closure_date:string}>}
interface Source{quantity?:number;fixedParticipants?:boolean;returnCreditId?:string|null;id:string;kind:'package'|'wallet';bookingId:string;course:Course;names:string;participants:Array<string|null>;expires:string;label:string;policy:string;normal:boolean;groupId?:string;originalMonth?:string;originalDate?:string;makeup?:KidsFamilyMakeupState}
interface Pick{id:string;kind:'package'|'wallet';date:string;start:string;end:string;branchId:string;templateId:string;requestId:string;label:string;participants?:Array<string|null>}
interface Group{key:string;source:Source;sources:Source[];total:number}
interface CalendarData{month:string;sessions:Array<{id:string;bookingId:string;branchId:string;date:string;start:string;end:string;childId:string|null}>}
const names:Record<Course,string>={kids_group:'เด็ก',adult_group:'ผู้ใหญ่',private:'Private'}
const dateLabel=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(date+'T12:00:00+07:00'))
const monthLabel=(month:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(month+'-01T12:00:00+07:00'))
const makeupEnd=(m:KidsFamilyMakeupState)=>new Date(Date.parse(m.expiresAt)-1).toISOString()
const dateOf=(instant:string)=>getBangkokDateString(new Date(instant))
const overlaps=(a:{start:string;end:string},b:{start:string;end:string})=>a.start.slice(0,5)<b.end.slice(0,5)&&b.start.slice(0,5)<a.end.slice(0,5)
const groupKey=walletGroupKey
function inventorySource(row:WalletInventorySource,data:WalletData):Source{
 const learner=(id:string|null)=>id?(data.children.find(c=>c.id===id)?.nickname||data.children.find(c=>c.id===id)?.full_name||'ข้อมูลผู้เรียนไม่ครบ'):data.userName
 return {...row,originalMonth:row.originalMonth||undefined,originalDate:row.originalDate||undefined,names:row.participants.map(learner).join(' · '),
  label:row.returnCreditId?'คืนสิทธิ์จากรอบที่ไม่ได้เปิดสอน · ใช้ครั้งละ 1 ชั่วโมง':row.kind==='package'?'แพ็กเกจ · อายุสิทธิ '+row.validityMonths+' เดือนตามบิล':row.policy==='same_month'?'วันเรียนที่เก็บไว้ · '+monthLabel(row.originalMonth!):'วันเรียนที่เก็บไว้ · ใช้ได้ตามอายุสิทธิเดิม',
  makeup:data.makeup.find(m=>m.sourceMonth===row.makeupMonth)}
}
export function BookingWalletClient({userId,initialCourse='kids_group'}:{userId:string;initialCourse?:Course}){
 const storageKey='nabs:wallet-basket-v1:'+userId
 const [data,setData]=useState<WalletData|null>(null),[course,setCourse]=useState<Course>(initialCourse),[stage,setStage]=useState<'sets'|'calendar'|'summary'|'done'>('sets')
 const [kidsNext,setKidsNext]=useState(false),[activeKey,setActiveKey]=useState(''),[month,setMonth]=useState(getBangkokDateString().slice(0,7)),[expanded,setExpanded]=useState('')
 const [basket,setBasket]=useState<Pick[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[result,setResult]=useState('')
 const [privateMembersByGroup,setPrivateMembersByGroup]=useState<Record<string,Array<string|null>>>({})
 const [calendar,setCalendar]=useState<CalendarData|null>(null),[calendarError,setCalendarError]=useState(''),[history,setHistory]=useState<WalletHistoryPage|null>(null)
 const [historyMonth,setHistoryMonth]=useState(getBangkokDateString().slice(0,7)),[historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState('')
 const [rulesFor,setRulesFor]=useState<{month:string;tab:'summary'|'table'}|null>(null)
 const historyGeneration=useRef(0),historyInFlight=useRef(false)
 const request=useRef(''),requestPicks=useRef(''),loaded=useRef(false),generation=useRef(0),calendarGeneration=useRef(0),requestedGroup=useRef<string|null>(null),selectedIds=useRef<string[]>([]),top=useRef<HTMLDivElement>(null)
 const [cache,setCache]=useState(new Map<string,Source>())
 useEffect(()=>{selectedIds.current=basket.map(p=>p.id)},[basket])
 const load=useCallback(async()=>{
  const serial=++generation.current,params=new URLSearchParams({inventory:'2'})
  if(requestedGroup.current)params.set('group',requestedGroup.current)
  if(selectedIds.current.length)params.set('selected',selectedIds.current.join(','))
  const d=await checkoutRequest<WalletData>('/api/booking-wallet?'+params)
  if(serial===generation.current)setData(d);return d
 },[])
 const readCalendar=useCallback(async()=>{const serial=++calendarGeneration.current;try{const d=await checkoutRequest<CalendarData>('/api/booking-wallet?calendarOnly=1&month='+month);if(serial===calendarGeneration.current){setCalendar(d);setCalendarError('')}return d}catch(e){if(serial===calendarGeneration.current)setCalendarError('ยังตรวจรอบเรียนเดิมไม่ได้ กรุณาอ่านข้อมูลใหม่');throw e}},[month])
 const refresh=useCallback(async()=>{try{await Promise.all([load(),readCalendar()]);setError('')}catch{setError('ยังอ่านสิทธิล่าสุดไม่ได้ กรุณาอ่านข้อมูลใหม่ก่อนยืนยัน')}},[load,readCalendar])
 useEffect(()=>{void refresh()},[refresh])
 useEffect(()=>{const update=()=>{if(document.visibilityState==='visible'&&!busy&&!unknown)void refresh()};window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);const timer=setInterval(update,15000);return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}},[refresh,busy,unknown])
 useEffect(()=>{if(loaded.current)return;loaded.current=true;try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved?.picks?.length&&saved?.request){setBasket(saved.picks);request.current=saved.request;requestPicks.current=JSON.stringify(saved.picks);setUnknown(true)}}catch{}},[storageKey])
 useEffect(()=>{top.current?.scrollIntoView({block:'start'})},[stage])
 const sources=useMemo<Source[]>(()=>data?data.sources.map(s=>inventorySource(s,data)):[],[data])
 useEffect(()=>{setCache(old=>new Map([...old,...sources.map(s=>[s.id,s] as const)]))},[sources])
 const byId=new Map(sources.map(s=>[s.id,s])),sourceFor=(id:string)=>byId.get(id)||cache.get(id)
 const eligible=(s:Source)=>s.normal||Boolean(s.makeup?.eligible)
 const grouping:Group[]=data?data.groups.map(g=>({...g,source:inventorySource(g.source,data),sources:sources.filter(s=>s.groupId===g.key)})):[]
 const groups=grouping.filter(g=>g.source.course===course&&(course!=='kids_group'||(kidsNext?Boolean(g.source.makeup):g.source.normal))),active=grouping.find(g=>g.key===activeKey)
 const pickedFor=(g:Group)=>basket.filter(p=>g.sources.some(s=>s.id===p.id)),unit=(s:Source)=>s.course==='private'?'ชั่วโมง':'ครั้ง'
 const editablePrivate=(s:Source|undefined)=>s?.kind==='package'&&s.course==='private'&&!s.fixedParticipants
 const learnerName=(id:string|null)=>{if(id===null)return data?.userName||'ตนเอง';const child=data?.children.find(c=>c.id===id);return child?formatLearnerDisplayName({fullName:child.full_name,nickname:child.nickname}):'ข้อมูลผู้เรียนไม่ครบ'}
 const memberNames=(members:Array<string|null>)=>members.map(learnerName).join(' · ')
 const memberOptions=[{id:'self',label:(data?.userName||'ตนเอง')+' (ตนเอง)'},...(data?.children||[]).map(child=>({id:child.id,label:formatLearnerDisplayName({fullName:child.full_name,nickname:child.nickname})}))]
 const pickMembers=(p:Pick)=>{const s=sourceFor(p.id);return editablePrivate(s)&&p.participants?p.participants:s?.participants||[]}
 const activeMembers=active?(editablePrivate(active.source)?privateMembersByGroup[active.key]||active.source.participants:active.source.participants):[]
 const memberError=(members:Array<string|null>)=>!members.length?'เลือกผู้เรียนอย่างน้อย 1 คน':members.length>20?'เลือกผู้เรียนได้ไม่เกิน 20 คน':new Set(members).size!==members.length||members.some(id=>id!==null&&!data?.children.some(child=>child.id===id))?'ข้อมูลผู้เรียนเปลี่ยนแล้ว กรุณาเลือกผู้เรียนใหม่':''
 const selectedMembers=(ids:string[])=>[...new Set(ids)].map(id=>id==='self'?null:id)
 const choosePrivateDefault=(ids:string[])=>{if(!active||busy||unknown)return;const members=selectedMembers(ids),message=memberError(members);if(message){setError(message);return}setPrivateMembersByGroup(previous=>({...previous,[active.key]:members}));setError('')}
 const choosePickMembers=(id:string,ids:string[])=>{if(busy||unknown||!editablePrivate(sourceFor(id)))return;const members=selectedMembers(ids),message=memberError(members);if(message){setError(message);return}setBasket(previous=>previous.map(p=>p.id===id?{...p,participants:members}:p));setError('')}
 const allowedMonth=(s:Source,date:string)=>s.originalMonth&&date.slice(0,7)!==s.originalMonth?Boolean(s.makeup?.eligible&&date.slice(0,7)===s.makeup.destinationMonth.slice(0,7)):s.normal
 const endAt=(s:Source,date:string)=>s.originalMonth&&date.slice(0,7)!==s.originalMonth?(s.makeup?makeupEnd(s.makeup):undefined):s.expires
 const crossCount=(m:KidsFamilyMakeupState)=>basket.filter(p=>sourceFor(p.id)?.makeup?.sourceMonth===m.sourceMonth&&p.date.slice(0,7)===m.destinationMonth.slice(0,7)).length
 const privateHourMessage='บิล Private นี้มีรอบเรียนในเวลานี้แล้ว กรุณาเลือกรอบอื่นเพื่อไม่ใช้สิทธิ์ซ้ำ'
 const sameHour=(a:{date:string;start:string;end:string;branchId:string},b:{date:string;start:string;end:string;branchId:string})=>a.date===b.date&&a.branchId===b.branchId&&a.start.slice(0,5)===b.start.slice(0,5)&&a.end.slice(0,5)===b.end.slice(0,5)
 const privateHourConflict=(s:Source,p:{id?:string;date:string;start:string;end:string;branchId:string})=>editablePrivate(s)&&(
  Boolean(calendar?.month===p.date.slice(0,7)&&calendar.sessions.some(existing=>existing.bookingId===s.bookingId&&sameHour(p,existing)))||
  basket.some(other=>other.id!==p.id&&sourceFor(other.id)?.bookingId===s.bookingId&&sameHour(p,other)))
 const invalid=(p:Pick)=>{
  const s=byId.get(p.id);if(!s||!eligible(s))return 'สิทธินี้ถูกใช้แล้วหรือไม่พร้อมใช้ กรุณานำออก'
  const members=pickMembers(p)
  if(editablePrivate(s)&&memberError(members))return memberError(members)
  if(!walletDurationMatches(s,p.start,p.end))return 'กรุณาเลือกรอบต่อเนื่อง '+walletSourceQuantity(s)+' ชั่วโมงตามสิทธิเดิม'
  if(!allowedMonth(s,p.date))return 'เงื่อนไขสิทธิเปลี่ยนแล้ว กรุณานำออกหรือเลือกใหม่'
  if(Date.parse(p.date+'T'+p.end.slice(0,5)+':00+07:00')>Date.parse(endAt(s,p.date)||''))return 'รอบที่เลือกเกินวันหมดสิทธิ'
  if(Date.parse(p.date+'T'+p.start.slice(0,5)+':00+07:00')<=Date.now())return 'รอบที่เลือกเริ่มแล้ว'
  if(s.makeup&&p.date.slice(0,7)===s.makeup.destinationMonth.slice(0,7)&&crossCount(s.makeup)>s.makeup.remaining)return 'โควตาครอบครัวเปลี่ยนแล้ว กรุณาลดรอบที่เลือก'
  if(privateHourConflict(s,p))return privateHourMessage
  if(calendar?.month===p.date.slice(0,7)&&calendar.sessions.some(session=>session.date===p.date&&members.includes(session.childId)&&overlaps(p,session)))return 'ผู้เรียนมีเรียนแล้วในเวลานี้ กรุณาเปลี่ยนผู้เรียนหรือเลือกรอบใหม่'
  if(basket.some(other=>other.id!==p.id&&other.date===p.date&&overlaps(p,other)&&pickMembers(other).some(id=>members.includes(id))))return 'ผู้เรียนซ้อนกับรอบที่เลือกไว้ กรุณาแก้ผู้เรียนหรือรอบเรียน'
  return ''
 }
 const templatesFor=(date:string,branchId:string)=>(data?.templates||[]).filter(t=>active&&t.course_types.name===active.source.course&&t.branch_id===branchId&&t.day_of_week===new Date(date+'T12:00:00+07:00').getUTCDay()&&!data?.closures.some(c=>c.branch_id===branchId&&c.closure_date===date))
 const sourceFits=(s:Source,date:string,t:Template)=>!basket.some(p=>p.id===s.id)&&walletDurationMatches(s,t.start_time,t.end_time)&&allowedMonth(s,date)&&Date.parse(date+'T'+t.end_time.slice(0,5)+':00+07:00')<=Date.parse(endAt(s,date)||'')
 const nextSource=(date:string,t:Template)=>active?.sources.find(s=>sourceFits(s,date,t)&&!privateHourConflict(s,{date,start:t.start_time,end:t.end_time,branchId:t.branch_id}))
 const slotReason=(date:string,t:Template)=>{
  if(!active)return 'สิทธิไม่พร้อมใช้';if(!walletDurationMatches(active.source,t.start_time,t.end_time))return 'ใช้กับรอบต่อเนื่อง '+walletSourceQuantity(active.source)+' ชั่วโมง';if(calendar?.month!==month||calendarError)return 'กำลังตรวจรอบเรียนเดิม'
  if(Date.parse(date+'T'+t.start_time.slice(0,5)+':00+07:00')<=Date.now())return 'รอบเริ่มแล้ว'
  const target={start:t.start_time,end:t.end_time},members=activeMembers
  if(editablePrivate(active.source)&&memberError(members))return memberError(members)
  if(calendar.sessions.some(s=>s.date===date&&members.includes(s.childId)&&overlaps(target,s)))return 'มีเรียนแล้วในเวลานี้'
  if(basket.some(p=>p.date===date&&overlaps(p,target)&&pickMembers(p).some(id=>members.includes(id))))return 'ซ้อนกับรอบที่เลือกไว้'
  const s=nextSource(date,t);if(!s)return active.sources.some(candidate=>sourceFits(candidate,date,t))?privateHourMessage:'เลือกครบสิทธิหรืออยู่นอกอายุสิทธิ'
  if(s.makeup&&date.slice(0,7)===s.makeup.destinationMonth.slice(0,7)&&crossCount(s.makeup)>=s.makeup.remaining)return 'เลือกครบโควตาครอบครัวแล้ว'
  return basket.length>=32?'เลือกได้สูงสุด 32 รอบต่อครั้ง':''
 }
 const select=(date:string,t:Template)=>{
  if(!active||busy||unknown)return
  const chosen=pickedFor(active).find(p=>p.date===date&&p.templateId===t.id)
  if(chosen){setBasket(old=>old.filter(p=>p.id!==chosen.id));return}
  if(slotReason(date,t))return;const s=nextSource(date,t)
  if(s)setBasket(old=>[...old,{id:s.id,kind:s.kind,date,start:t.start_time,end:t.end_time,branchId:t.branch_id,templateId:t.id,requestId:crypto.randomUUID(),label:s.names+' · '+s.label,...(editablePrivate(s)?{participants:[...activeMembers]}:{})}])
 }
 const open=async(g:Group)=>{
  if(busy||unknown)return;setBusy(true);setError('');requestedGroup.current=g.key
  try{const d=g.sources.length>=Math.min(g.total,32)?data!:await load(),fresh=d.groups.find(x=>x.key===g.key);if(!fresh)throw Error('สิทธิกลุ่มนี้เปลี่ยนแล้ว กรุณาอ่านสิทธิล่าสุด')
   const s=inventorySource(fresh.source,d);setActiveKey(g.key);setCourse(s.course);setMonth(s.makeup&&kidsNext?s.makeup.destinationMonth.slice(0,7):[getBangkokDateString().slice(0,7),s.originalMonth||''].sort().at(-1)!);setExpanded('');setStage('calendar')
  }catch{setError('ยังอ่านสิทธิกลุ่มนี้ไม่ได้ กรุณาอ่านสิทธิล่าสุดแล้วลองใหม่')}finally{setBusy(false)}
 }
 const changeMonth=(delta:number)=>{const next=new Date(month+'-01T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+delta);setCalendar(null);setMonth(next.toISOString().slice(0,7));setExpanded('')}
 const dates=Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),selected=active?pickedFor(active).filter(p=>p.date===date):[];return{date,selectable:Boolean(selected.length||data?.branches.some(b=>templatesFor(date,b.id).some(t=>!slotReason(date,t)))),selected:selected.length>0,expanded:expanded===date,selectedCount:selected.length,existing:active?(calendar?.sessions||[]).filter(s=>s.date===date&&activeMembers.includes(s.childId)).map(()=>({label:memberNames(activeMembers),color:'bg-green-500'})):[]}})
 const readHistory=useCallback(async(offset=0)=>{
  const serial=++historyGeneration.current;historyInFlight.current=true;setHistoryBusy(true);setHistoryError('')
  try{const d=await checkoutRequest<WalletHistoryPage>('/api/booking-wallet?historyOnly=1&historyFormat=2&month='+historyMonth+'&course='+course+'&offset='+offset)
   if(serial===historyGeneration.current)setHistory(old=>offset&&old?.month===d.month&&old.course===d.course?{...d,rows:[...new Map([...old.rows,...d.rows].map(r=>[r.kind+r.id,r])).values()].sort((a,b)=>b.at.localeCompare(a.at))}:d)
  }catch{if(serial===historyGeneration.current)setHistoryError('ยังอ่านประวัติเดือนนี้ไม่ได้')}
  finally{if(serial===historyGeneration.current){setHistoryBusy(false);historyInFlight.current=false}}
 },[historyMonth,course])
 useEffect(()=>{historyGeneration.current++;historyInFlight.current=false;setHistory(null)},[historyMonth,course])
 useEffect(()=>{if(stage==='sets'&&data&&!historyInFlight.current)void readHistory()},[data,stage,readHistory])
 const changeHistoryMonth=(delta:number)=>{const d=new Date(historyMonth+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);setHistoryMonth(d.toISOString().slice(0,7))}

 const recover=async()=>{if(!request.current)return;setBusy(true);try{const r=await checkoutRequest<{found:boolean}>('/api/booking-checkout?operation=redeem&requestId='+request.current);if(r.found){setBasket([]);request.current='';sessionStorage.removeItem(storageKey);setResult('ใช้สิทธิเรียบร้อยแล้ว');setStage('done')}setUnknown(false);setError('');await refresh()}catch{setError('ยังตรวจผลไม่ได้ กรุณาตรวจคำขอเดิมอีกครั้งเมื่อเชื่อมต่อได้')}finally{setBusy(false)}}
 const review=async()=>{setBusy(true);try{await Promise.all([load(),readCalendar()]);setStage('summary');setError('')}catch{setError('ยังอ่านสิทธิล่าสุดไม่ได้ กรุณาลองอีกครั้ง')}finally{setBusy(false)}}
 const confirm=async()=>{
  if(!basket.length||busy||unknown||basket.some(invalid)||error)return;setBusy(true);setError('');if(requestPicks.current!==JSON.stringify(basket)){request.current=crypto.randomUUID();requestPicks.current=JSON.stringify(basket)}request.current ||=crypto.randomUUID()
  try{sessionStorage.setItem(storageKey,JSON.stringify({request:request.current,picks:basket}));await checkoutRequest('/api/booking-wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:request.current,picks:basket})},18000);setBasket([]);request.current='';sessionStorage.removeItem(storageKey);setResult('ใช้สิทธิครบทั้งชุดเรียบร้อยแล้ว');setStage('done');await refresh()}
  catch(e){setUnknown(true);setError(e instanceof Error?e.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจคำขอเดิม')}
  finally{setBusy(false)}
 }
 const rows=(list:Pick[],remove=false)=>list.slice().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).map(p=>{
  const source=sourceFor(p.id),members=pickMembers(p),changeable=editablePrivate(source)
  return <div key={p.id} className="flex min-w-0 items-start justify-between gap-3 border-t py-3 text-sm" data-testid={'wallet-pick-'+p.id}>
   <div className="min-w-0 flex-1 space-y-2"><p className="font-medium text-[#153c85]">{dateLabel(p.date)} · {p.start.slice(0,5)}–{p.end.slice(0,5)}</p><p className="flex items-center gap-1 text-gray-600"><MapPin className="h-3.5 w-3.5 shrink-0"/>{data?.branches.find(b=>b.id===p.branchId)?.name||'สาขาของรอบที่เลือก'}</p>
    {changeable&&<><p className="font-semibold text-[#153c85]" data-testid="wallet-pick-attendee-count">Private 1 ชั่วโมง · {members.length} คน</p><p className="break-words text-gray-700" data-testid="wallet-pick-attendee-names">{memberNames(members)}</p><BookingChoice title={'ผู้เรียนรอบ '+dateLabel(p.date)+' '+p.start.slice(0,5)} options={memberOptions} selected={members.map(id=>id??'self')} disabled={busy||unknown} description="เลือกผู้เรียนเฉพาะรอบนี้ 1 ชั่วโมงใช้ 1 สิทธิ" onApply={ids=>choosePickMembers(p.id,ids)}/></>}
    {source?.originalDate&&<p className="text-xs text-gray-500">ต้นทาง {dateLabel(source.originalDate)}</p>}{invalid(p)&&<p role="alert" className="text-red-700">{invalid(p)}</p>}
   </div>{remove&&<Button variant="ghost" size="icon" className="shrink-0" aria-label={'นำออก '+p.date+' '+p.start.slice(0,5)} disabled={busy||unknown} onClick={()=>setBasket(old=>old.filter(x=>x.id!==p.id))}><X/></Button>}
  </div>
 })
 const summaryGroups=Array.from(basket.reduce((map,p)=>{const s=sourceFor(p.id),key=s?groupKey(s):p.id,g=map.get(key)||{key,s,picks:[] as Pick[]};g.picks.push(p);map.set(key,g);return map},new Map<string,{key:string;s:Source|undefined;picks:Pick[]}>()).values())
 const shownExpiry=(s:Source)=>kidsNext&&s.makeup?makeupEnd(s.makeup):s.expires
 const firstMonth=active?.source.makeup&&kidsNext?active.source.makeup.destinationMonth.slice(0,7):[getBangkokDateString().slice(0,7),active?.source.originalMonth||''].sort().at(-1)!
 const lastMonth=active?dateOf(shownExpiry(active.source)).slice(0,7):month
 return <div ref={top} className="space-y-5 scroll-mt-20" data-testid="booking-wallet">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-[#153c85]">กระเป๋าวันเรียน</h1><p className="mt-1 text-sm text-gray-500">เลือกหลายวัน ตรวจสรุป แล้วใช้สิทธิในครั้งเดียว</p></div><Button variant="outline" size="sm" disabled={busy||unknown} onClick={()=>void refresh()}><RefreshCw/>อ่านสิทธิล่าสุด</Button></div>
  {stage!=='done'&&<ol className="grid grid-cols-3 gap-2" aria-label="ขั้นตอนใช้สิทธิ">{['เลือกสิทธิ','เลือกวันเรียน','สรุปใช้สิทธิ'].map((s,i)=>{const step=stage==='sets'?0:stage==='calendar'?1:2;return <li key={s} aria-current={i===step?'step':undefined} className={'rounded-xl px-2 py-3 text-center text-xs font-semibold '+(i<=step?'bg-[#2748bf] text-white':'bg-gray-100 text-gray-500')}>{i<step?'✓':i+1} {s}</li>})}</ol>}
  {busy&&<p role="status" className="text-sm">กำลังอ่านหรือบันทึกสิทธิ...</p>}
  {error&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{error}<Button variant="outline" className="mt-3 sm:ml-3 sm:mt-0" disabled={busy} onClick={()=>void(unknown?recover():refresh())}>{unknown?'ตรวจสอบผลเดิม':'อ่านข้อมูลใหม่'}</Button></div>}
  {unknown&&!error&&<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">มีคำขอจากครั้งก่อน กรุณาตรวจผลก่อนใช้สิทธิอีกครั้ง<Button className="mt-2 sm:ml-3" disabled={busy} onClick={()=>void recover()}>ตรวจสอบผลเดิม</Button></div>}
  {stage==='sets'&&<>
   <div className="flex flex-wrap gap-2" role="group" aria-label="ประเภทกระเป๋า">{(Object.keys(names) as Course[]).map(c=><Button key={c} aria-pressed={course===c} variant={course===c?'default':'outline'} disabled={busy} className={course===c?'bg-[#2748bf]':''} onClick={()=>setCourse(c)}>{names[c]}</Button>)}</div>
   {course==='kids_group'&&<><div className="flex flex-wrap gap-2"><Button variant={!kidsNext?'secondary':'outline'} aria-pressed={!kidsNext} onClick={()=>setKidsNext(false)}>ใช้ในเดือนเดิม</Button><Button variant={kidsNext?'secondary':'outline'} aria-pressed={kidsNext} onClick={()=>setKidsNext(true)}>ใช้ข้ามเดือนตามเงื่อนไข</Button></div>{kidsNext&&data?.makeup.map(m=><section key={m.sourceMonth} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#153c85]">วันเรียนที่เก็บจาก {monthLabel(m.sourceMonth.slice(0,7))} → ใช้เรียนใน {monthLabel(m.destinationMonth.slice(0,7))}</p><Button variant="outline" size="sm" className="bg-white text-xs" onClick={()=>setRulesFor({month:m.sourceMonth,tab:'summary'})}><Info/>ดูเงื่อนไข</Button></div><div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-gray-600">วันเรียนที่ยังเก็บไว้</p><p className="mt-1 text-2xl font-bold text-[#153c85]">{m.sources.length} <span className="text-sm font-normal">รายการ</span></p></div><div><p className="text-xs text-gray-600">เลือกใช้ในเดือนปลายทางได้อีก</p><p className="mt-1 text-2xl font-bold text-[#153c85]">{walletSelfUseCount(m)} <span className="text-sm font-normal">ครั้ง รวมทุกคน</span></p></div></div><div className="flex flex-wrap items-center justify-between gap-2"><p>โควตาข้ามเดือน {m.quota} ครั้ง · ใช้แล้ว {m.used} · เหลือ {m.remaining}</p><Button variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-[#153c85] underline" onClick={()=>setRulesFor({month:m.sourceMonth,tab:'table'})}>ซื้อกี่ครั้ง ได้กี่ครั้ง</Button></div><p className="text-xs text-gray-600">โควตาปกติใช้ร่วมกับรายการที่แอดมินดำเนินการให้ · ใช้เรียนได้ถึง {dateLabel(dateOf(makeupEnd(m)))}</p>{!m.eligible&&<div className="border-t border-blue-200 pt-3"><p>{familyMakeupReason(m)}</p>{m.reason==='quota_exhausted'&&<p className="mt-1 text-xs text-gray-600">วันเรียนที่ยังเก็บไว้ ใช้ในเดือนเดิมได้ตามกติกาและอายุสิทธิ</p>}{m.reason==='destination_minimum'?<Link className="mt-2 inline-block font-semibold underline" href="/dashboard/booking">ไปจองคอร์สเรียน</Link>:sources.some(s=>s.course==='kids_group'&&s.normal)&&<Button variant="outline" size="sm" className="mt-2 bg-white" onClick={()=>setKidsNext(false)}>ไปเลือกวันในเดือนเดิม</Button>}</div>}</section>)}</>}
   {!data&&!error&&<p role="status">กำลังอ่านสิทธิ...</p>}{data&&groups.length===0&&<div className="rounded-xl border bg-white p-6">ไม่มีสิทธิที่พร้อมเลือกเพิ่มในกระเป๋านี้</div>}
   <div className="grid gap-4 sm:grid-cols-2">{groups.map(g=><Card key={g.key} data-testid={'wallet-group-'+g.key} className="rounded-xl"><CardContent className="p-5"><p className="font-semibold text-[#153c85]">{g.source.names}</p><p className="mt-2 text-sm">{g.source.label}</p>{g.source.course==='private'&&walletSourceQuantity(g.source)!==1&&<p className="mt-2 text-sm text-blue-700">ใช้ครั้งละ {walletSourceQuantity(g.source)} ชั่วโมงต่อเนื่องตามรอบเดิม</p>}<p className="mt-4 text-xl font-bold text-[#153c85]">{kidsNext&&g.source.course==='kids_group'?'เก็บไว้':'คงเหลือ'} {g.total*walletSourceQuantity(g.source)} {kidsNext&&g.source.course==='kids_group'?'รายการ':unit(g.source)}</p>{pickedFor(g).length>0&&<p className="mt-1 text-sm text-orange-700">เลือกไว้ {pickedFor(g).length*walletSourceQuantity(g.source)} · เลือกเพิ่มได้ {walletGroupBalance(g,pickedFor(g).length)*walletSourceQuantity(g.source)}</p>}{kidsNext&&g.source.makeup&&<p className="mt-2 text-xs text-gray-600">ใช้ข้ามเดือนตามโควตารวมด้านบน</p>}<p className="mt-2 text-sm text-gray-500">{kidsNext?'ใช้ข้ามเดือนได้ถึง':'หมดอายุ'} {dateLabel(dateOf(shownExpiry(g.source)))}</p>{g.source.participants.length>1&&<p className="mt-3 text-xs text-violet-700">{walletSourceQuantity(g.source)} ชั่วโมงต่อรอบ · ผู้เรียนทุกคนไปพร้อมกัน</p>}<Button className="mt-4 w-full bg-[#2748bf] hover:bg-[#153c85]" disabled={busy||unknown||Boolean(kidsNext&&g.source.makeup&&!g.source.makeup.eligible)} onClick={()=>open(g)}>{kidsNext&&g.source.makeup&&!g.source.makeup.eligible?'ยังใช้ข้ามเดือนไม่ได้':pickedFor(g).length?'เลือกเพิ่ม / แก้วัน':'เลือกวันเรียน'}</Button></CardContent></Card>)}</div>
   <section className="rounded-xl border bg-white p-4" aria-label="ประวัติสิทธิรายเดือน">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[#153c85]">ประวัติการเก็บและใช้วันเรียน</h2><p className="mt-1 text-xs text-gray-500">รายการที่เก็บ ใช้สิทธิ หรือหมดอายุในเดือนที่เลือก</p></div><div className="flex items-center gap-3"><Button variant="outline" size="icon" aria-label="ประวัติเดือนก่อน" disabled={historyMonth<='2000-01'} onClick={()=>changeHistoryMonth(-1)}><ArrowLeft/></Button><strong className="text-sm">{monthLabel(historyMonth)}</strong><Button variant="outline" size="icon" aria-label="ประวัติเดือนถัดไป" disabled={historyMonth>=getBangkokDateString().slice(0,7)} onClick={()=>changeHistoryMonth(1)}><ArrowRight/></Button></div></div>
    {historyBusy&&<p role="status" className="mt-4 text-sm text-gray-500">กำลังอ่านประวัติเดือนนี้...</p>}
    {historyError&&<div role="alert" className="mt-4 text-sm text-amber-800">{historyError}<Button variant="outline" size="sm" className="ml-2" onClick={()=>void readHistory()}>ลองอ่านประวัติใหม่</Button></div>}
    {!historyBusy&&!historyError&&history?.rows.length===0&&<p className="mt-4 text-sm text-gray-500">ไม่มีรายการเก็บ ใช้สิทธิ หรือหมดอายุในเดือนนี้</p>}
    {history&&<BookingWalletHistory rows={history.rows} learner={id=>id?(data?.children.find(c=>c.id===id)?.nickname||data?.children.find(c=>c.id===id)?.full_name||'ข้อมูลผู้เรียนไม่ครบ'):data?.userName||'ตัวเอง'}/>}
    {history?.nextOffset!=null&&<Button variant="outline" className="mt-4" disabled={historyBusy} onClick={()=>void readHistory(history.nextOffset!)}>รายการเพิ่มเติมของเดือนนี้</Button>}
   </section>
  </>}
  {stage==='calendar'&&<><Button variant="ghost" className="px-0 text-[#153c85]" onClick={()=>setStage('sets')}><ArrowLeft/>กลับไปเลือกสิทธิ</Button>{!active?<div className="rounded-xl border border-amber-300 bg-amber-50 p-4">สิทธิชุดนี้ถูกใช้แล้วหรือไม่พร้อมใช้ กรุณากลับไปเลือกสิทธิใหม่</div>:<>
   <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="font-semibold text-[#153c85]">{active.source.label}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>{kidsNext&&active.source.makeup?'เก็บไว้':'มีสิทธิ'} {active.total*walletSourceQuantity(active.source)} {unit(active.source)}</span><strong className="text-[#2748bf]">เลือกแล้ว {pickedFor(active).length*walletSourceQuantity(active.source)} {unit(active.source)}</strong><span>เลือกเพิ่มได้ {active.source.makeup&&kidsNext?Math.min(walletGroupBalance(active,pickedFor(active).length),Math.max(0,active.source.makeup.remaining-crossCount(active.source.makeup))):walletGroupBalance(active,pickedFor(active).length)*walletSourceQuantity(active.source)} {unit(active.source)}</span><span>ใช้ได้ถึง {dateLabel(dateOf(shownExpiry(active.source)))}</span></div>{active.source.makeup&&kidsNext&&<p className="mt-2 text-sm">โควตาครอบครัวเลือกเพิ่มได้ {Math.max(0,active.source.makeup.remaining-crossCount(active.source.makeup))} ครั้ง</p>}</div>
   {active.source.course==='kids_group'?<BookingLearnerTabs learners={groups.map(g=>({id:g.key,name:groups.filter(x=>x.source.names===g.source.names).length>1?g.source.names+' · ถึง '+dateLabel(dateOf(shownExpiry(g.source))):g.source.names,count:pickedFor(g).length}))} activeId={active.key} disabled={busy||unknown} onChange={id=>{const g=groups.find(x=>x.key===id);if(g)open(g)}}/>:editablePrivate(active.source)?<section className="min-w-0 space-y-2" data-testid="wallet-private-default-members"><BookingChoice title="ผู้เรียนสำหรับรอบใหม่" options={memberOptions} selected={activeMembers.map(id=>id??'self')} disabled={busy||unknown} description="เลือกผู้เรียนสำหรับรอบที่จะเลือกเพิ่ม 1 ชั่วโมงใช้ 1 สิทธิ" onApply={choosePrivateDefault}/><p className="text-xs text-gray-600">รายชื่อนี้ใช้กับรอบที่เลือกเพิ่ม รอบที่เลือกไว้แก้ผู้เรียนแยกได้ด้านล่าง</p></section>:active.source.participants.length>1?<div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm"><p className="flex items-center gap-2 font-medium text-violet-900"><Users/>เรียนพร้อมกันทั้งครอบครัว</p><p className="mt-2">{active.source.names}</p><p className="mt-1 text-violet-700">หนึ่งรอบ {walletSourceQuantity(active.source)} ชั่วโมง · ผู้เรียนทุกคนไปพร้อมกัน</p></div>:<p className="text-sm text-gray-600">กำลังเลือกวันเรียนของ: <strong className="text-[#153c85]">{active.source.names}</strong></p>}
   <BookingCalendarHeading title={names[active.source.course]} month={monthLabel(month)} onPrevious={()=>changeMonth(-1)} onNext={()=>changeMonth(1)} previousDisabled={busy||unknown||month<=firstMonth} nextDisabled={busy||unknown||month>=lastMonth}/>
   {calendarError&&<p role="alert" className="text-sm text-red-700">{calendarError}</p>}
   <BookingCalendar days={dates} onDay={date=>{if(!busy&&!unknown)setExpanded(expanded===date?'':date)}}><p className="mt-3 text-xs leading-relaxed text-gray-500">วันที่สีจางไม่มีรอบที่ใช้สิทธิได้ · สีเขียวมีเรียนเดิม · สีน้ำเงินคือวันที่เลือกไว้</p>{calendar?.month!==month&&<p role="status" className="mt-3 text-sm">กำลังตรวจรอบเรียนเดิม...</p>}{!expanded&&<p className="mt-4 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">จิ้มวันที่เพื่อดูรอบเรียน แล้วเลือกต่อได้หลายวัน</p>}{expanded&&<section className="mt-5 space-y-4 rounded-lg border bg-gray-50 p-4"><h3 className="font-semibold text-[#153c85]">{dateLabel(expanded)} · เลือกรอบเรียน</h3>{data?.branches.map(b=><div key={b.id}><p className="mb-2 flex items-center gap-1 text-sm text-gray-600"><MapPin className="h-4 w-4"/>{b.name}</p>{templatesFor(expanded,b.id).length===0?<p className="text-xs text-gray-400">{data.closures.some(c=>c.branch_id===b.id&&c.closure_date===expanded)?'สาขาปิดวันนี้':'ไม่มีรอบเรียน'}</p>:<div className="flex flex-wrap gap-2">{templatesFor(expanded,b.id).map(t=>{const selected=pickedFor(active).some(p=>p.date===expanded&&p.templateId===t.id),reason=selected?'':slotReason(expanded,t);return <Button key={t.id} data-testid={'wallet-slot-'+expanded+'-'+t.branch_id+'-'+t.start_time.slice(0,5)} variant={selected?'default':'outline'} aria-label={b.name+' '+t.start_time.slice(0,5)+'–'+t.end_time.slice(0,5)} aria-pressed={selected} className={'h-auto min-h-11 flex-col gap-0.5 whitespace-normal px-4 py-2 '+(selected?'bg-[#2748bf] text-white':'')} disabled={busy||unknown||Boolean(reason)} onClick={()=>select(expanded,t)}><span className="flex items-center gap-1">{selected?<Check/>:<Clock/>}{t.start_time.slice(0,5)}–{t.end_time.slice(0,5)}</span>{reason&&<span className="text-[10px] font-normal">{reason}</span>}</Button>})}</div>}</div>)}</section>}</BookingCalendar>
   {pickedFor(active).length>0&&<div className="rounded-xl border bg-white p-4"><h3 className="mb-2 font-semibold text-[#153c85]">{editablePrivate(active.source)?'วันที่เลือกไว้':('วันที่เลือกไว้ของ '+active.source.names)} ({pickedFor(active).length})</h3>{rows(pickedFor(active),true)}</div>}
  </>}</>}
  {stage==='summary'&&<><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#153c85]">สรุปใช้สิทธิ {basket.length} รอบ</h2><span className="rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800">ไม่ต้องชำระเพิ่ม</span></div>{summaryGroups.map(g=><Card key={g.key} className="rounded-xl"><CardContent className="p-5"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-[#153c85]">{editablePrivate(g.s)?'Private · ผู้เรียนตามแต่ละรอบ':g.s?.names||g.picks[0].label}</p><p className="mt-1 text-sm">{g.s?.label}</p></div><Button variant="outline" size="sm" disabled={busy||unknown||!grouping.some(x=>x.key===g.key)} onClick={()=>open(grouping.find(x=>x.key===g.key)!)}>แก้วัน</Button></div><div className="mt-4">{rows(g.picks,true)}</div>{g.s&&<div className="mt-2 flex flex-wrap justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm"><strong className="text-[#153c85]">ใช้ {g.picks.length*walletSourceQuantity(g.s)} {unit(g.s)} · วันเก็บหลังยืนยันเหลือ {walletGroupBalance({total:grouping.find(x=>x.key===g.key)?.total||0},g.picks.length)*walletSourceQuantity(g.s)} {unit(g.s)}</strong><span>ใช้ได้ถึง {dateLabel(dateOf(endAt(g.s,g.picks[0].date)||g.s.expires))}</span></div>}{g.s&&g.s.course==='private'&&g.picks.some(p=>pickMembers(p).length>1)&&<p className="mt-3 text-xs text-violet-700">ผู้เรียนทุกคนไปพร้อมกัน · นับสิทธิตามชั่วโมง</p>}</CardContent></Card>)}{data?.makeup.filter(m=>crossCount(m)>0).map(m=><p key={m.sourceMonth} className="text-sm text-[#153c85]">ใช้โควตาข้ามเดือนรวม {crossCount(m)} ครั้ง · หลังยืนยันเหลือ {Math.max(0,m.remaining-crossCount(m))} ครั้ง รวมทุกคน</p>)}<p className="text-sm text-gray-600">ยืนยันทั้งชุดครั้งเดียว หากรอบใดใช้ไม่ได้ ระบบจะให้แก้ก่อนและยังไม่ตัดสิทธิทั้งชุด</p><div className="flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" className="min-h-11" disabled={busy||unknown} onClick={()=>active?setStage('calendar'):setStage('sets')}><ArrowLeft/>กลับไปเลือกวัน</Button><Button className="min-h-11 flex-1 bg-orange-500 hover:bg-orange-600" disabled={busy||unknown||!basket.length||Boolean(error)||basket.some(invalid)} data-testid="wallet-confirm-use" onClick={()=>void confirm()}>ยืนยันใช้สิทธิทั้งชุด</Button></div></>}
  {stage==='done'&&<section data-testid="wallet-use-success" className="rounded-2xl border border-green-200 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-green-600"/><h2 className="mt-4 text-xl font-bold text-[#153c85]">{result}</h2><p className="mt-2 text-sm text-gray-600">ดูสิทธิคงเหลือล่าสุดได้ในกระเป๋า</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={()=>setStage('sets')}>กลับกระเป๋า</Button><Button asChild className="bg-[#2748bf]"><Link href="/dashboard/schedule">ดูตารางเรียน<ArrowRight/></Link></Button></div></section>}
  {stage!=='summary'&&stage!=='done'&&basket.length>0&&<section className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white p-4 shadow-lg"><div><strong className="text-[#153c85]">เลือกแล้ว {basket.length} รอบ</strong><p className="mt-1 text-xs text-gray-500">{summaryGroups.length} ชุดสิทธิ · ยังไม่ตัดสิทธิ</p></div><Button className="min-h-11 bg-orange-500 hover:bg-orange-600" disabled={busy||unknown} data-testid="wallet-review-use" onClick={()=>void review()}>ดูสรุปใช้สิทธิ<ArrowRight/></Button></section>}
  {rulesFor&&data?.rules&&data.makeup.find(m=>m.sourceMonth===rulesFor.month)&&<BookingWalletRules key={rulesFor.month+rulesFor.tab} state={data.makeup.find(m=>m.sourceMonth===rulesFor.month)!} rules={data.rules} initialTab={rulesFor.tab} onClose={()=>setRulesFor(null)}/>}
 </div>
}
