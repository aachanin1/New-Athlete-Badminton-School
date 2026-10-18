'use client'
import Link from 'next/link'
import {useCallback,useEffect,useRef,useState} from 'react'
import {CalendarOff,Plus} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import {ListPagination} from '@/components/admin/list-pagination'
import {ADMIN_COURSES} from '@/components/admin/course-colors'
import {formatThaiDateWithWeekday,getBangkokDateKey} from '@/lib/date-format'
import type {BranchDateClosure} from '@/lib/branch-date-closures'
import type {CourseTypeName} from '@/types/database'

interface Impact{id:string;date:string;start:string;end:string;status:string;bookingStatus:string;learner:string;course:CourseTypeName;isMakeup:boolean;identityValid:boolean}
interface Change{branchId:string;date:string;closed:boolean;reason:string;requestId:string}
type Closure=BranchDateClosure&{impact_count:number;branch_name:string}
interface Summary{scope:string;closures:BranchDateClosure[];total:number}
export function BranchDateClosureManager({branches,active,onSavingChange}:{branches:Array<{id:string;name:string}>;active:boolean;onSavingChange:(value:boolean)=>void}){
 const today=getBangkokDateKey(new Date())!
 const [month,setMonth]=useState(today.slice(0,7)),[filterBranch,setFilterBranch]=useState('all')
 const [list,setList]=useState<{scope:string;items:Closure[]}|null>(null),[loading,setLoading]=useState(false),[listError,setListError]=useState('')
 const [dialog,setDialog]=useState<'add'|'edit'|'reopen'|null>(null),[branch,setBranch]=useState(branches[0]?.id||''),[date,setDate]=useState(today),[reason,setReason]=useState('')
 const [summary,setSummary]=useState<Summary|null>(null),[summaryLoading,setSummaryLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[epoch,setEpoch]=useState(0)
 const [impactRow,setImpactRow]=useState<Closure|null>(null),[impactPage,setImpactPage]=useState(1),[impact,setImpact]=useState<{scope:string;items:Impact[];total:number}|null>(null),[impactError,setImpactError]=useState('')
 const impactScope=impactRow?`${impactRow.branch_id}|${impactRow.closure_date}|${impactPage}`:'',currentImpact=impact?.scope===impactScope?impact:null
 const pending=useRef<Change|null>(null),inFlight=useRef(false),listRevision=useRef(0),dayRevision=useRef(0)
 const locked=saving||uncertain,listScope=month+'|'+filterBranch,dayScope=branch+'|'+date
 const current=summary?.scope===dayScope?summary.closures.find(x=>x.branch_id===branch&&x.closure_date===date&&x.is_active):null
 const readReady=summary?.scope===dayScope&&!summaryLoading&&!error
 const loadList=useCallback(async(signal?:AbortSignal)=>{
  const rev=++listRevision.current;setLoading(true);setListError('')
  try{const q=new URLSearchParams({mode:'overview',month});if(filterBranch!=='all')q.set('branch',filterBranch)
   const r=await fetch('/api/admin/branch-closures?'+q,{cache:'no-store',signal}),data=await r.json();if(!r.ok||!Array.isArray(data.closures))throw Error(data.error||'อ่านวันปิดสาขาไม่สำเร็จ')
   if(!signal?.aborted&&rev===listRevision.current)setList({scope:listScope,items:data.closures});return true
  }catch(e){if(!signal?.aborted&&rev===listRevision.current)setListError(e instanceof Error?e.message:'อ่านวันปิดสาขาไม่สำเร็จ');return false}
  finally{if(!signal?.aborted&&rev===listRevision.current)setLoading(false)}
 },[month,filterBranch,listScope])
 const loadSummary=useCallback(async(signal?:AbortSignal)=>{
  const rev=++dayRevision.current;setSummaryLoading(true);setError('');setSummary(null)
  try{const r=await fetch('/api/admin/branch-closures?'+new URLSearchParams({mode:'summary',branch,date}),{cache:'no-store',signal}),data=await r.json();if(!r.ok||!Array.isArray(data.closures)||typeof data.total!=='number')throw Error(data.error||'อ่านสถานะและจำนวนรายการเดิมไม่สำเร็จ')
   if(!signal?.aborted&&rev===dayRevision.current)setSummary({...data,scope:dayScope});return true
  }catch(e){if(!signal?.aborted&&rev===dayRevision.current)setError(e instanceof Error?e.message:'อ่านข้อมูลไม่สำเร็จ');return false}
  finally{if(!signal?.aborted&&rev===dayRevision.current)setSummaryLoading(false)}
 },[branch,date,dayScope])
 useEffect(()=>{if(!active)return;const c=new AbortController();void loadList(c.signal);return()=>c.abort()},[active,loadList,epoch])
 useEffect(()=>{if(!dialog||!branch||!date)return;const c=new AbortController();void loadSummary(c.signal);return()=>c.abort()},[dialog,loadSummary,branch,date])
 useEffect(()=>{
  setImpact(null);setImpactError('');if(!active||!impactRow)return;const c=new AbortController()
  void fetch('/api/admin/branch-closures?'+new URLSearchParams({mode:'impact',branch:impactRow.branch_id,date:impactRow.closure_date,page:String(impactPage)}),{cache:'no-store',signal:c.signal}).then(async r=>{const data=await r.json();if(!r.ok||!Array.isArray(data.impact))throw Error(data.error||'อ่านรายการจองเดิมไม่สำเร็จ');if(!c.signal.aborted){setImpact({scope:impactScope,items:data.impact,total:data.total});setList(list=>list?{...list,items:list.items.map(row=>row.id===impactRow.id?{...row,impact_count:data.total}:row)}:list)}}).catch(e=>{if(!c.signal.aborted)setImpactError(e instanceof Error?e.message:'อ่านรายการจองเดิมไม่สำเร็จ')})
  return()=>c.abort()
 },[active,impactRow,impactPage,impactScope,epoch])
 function open(kind:'add'|'edit'|'reopen',row?:Closure){
  if(locked)return;setError('');setMessage('');setSummary(null)
  setBranch(row?.branch_id||(filterBranch!=='all'?filterBranch:branches[0]?.id||''));setDate(row?.closure_date||today)
  setReason(kind==='reopen'?'เปิดรับจองตามรอบประจำ':kind==='edit'?row?.reason||'':'');setDialog(kind)
 }
 async function commit(){
  if(inFlight.current||!dialog)return
  if(!pending.current){if(!readReady||!reason.trim())return;pending.current={branchId:branch,date,closed:dialog!=='reopen',reason:reason.trim(),requestId:crypto.randomUUID()}}
  inFlight.current=true;setSaving(true);setError('');onSavingChange(true);let resolved=false
  try{const r=await fetch('/api/admin/branch-closures',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.current)}),data=await r.json()
   if(!r.ok||data.success!==true){if(r.status>=400&&r.status<500&&data.code&&data.code!=='BRANCH_CLOSURE_UNAVAILABLE')resolved=true;throw Error(data.error||'ยังยืนยันผลไม่ได้')}
   const reads=await Promise.all([loadList(),loadSummary()]);if(reads.some(v=>!v))throw Error('บันทึกแล้วแต่ยังอ่านสถานะล่าสุดไม่ได้ กรุณาตรวจสอบคำขอเดิม')
   resolved=true;setDialog(null);setReason('');setMessage(dialog==='reopen'?'ยกเลิกวันปิดแล้ว · เปิดรับจองตามรอบประจำที่เปิดใช้งาน':'ประกาศปิดเฉพาะวันที่แล้ว · รายการจองเดิมยังอยู่ให้จัดการต่อ');setImpactRow(null);setEpoch(v=>v+1)
  }catch(e){setError(e instanceof Error?e.message:'ยังยืนยันผลไม่ได้')}
  finally{inFlight.current=false;setSaving(false);setUncertain(!resolved);if(resolved){pending.current=null;onSavingChange(false)}}
 }
 const items=list?.scope===listScope?list.items:[],branchName=branches.find(b=>b.id===branch)?.name
 return <section aria-label="วันปิดสาขาเฉพาะวันที่" className="space-y-4">
  <div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap items-end gap-3"><label className="space-y-2 text-sm"><span>เดือนที่แสดง</span><Input type="month" aria-label="เดือนของวันปิดสาขา" value={month} disabled={locked} min="1000-01" max="9998-12" onChange={e=>{if(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(e.target.value)){setMonth(e.target.value);setImpactRow(null)}}}/></label><label className="space-y-2 text-sm"><span>สาขา</span><Select value={filterBranch} disabled={locked} onValueChange={v=>{setFilterBranch(v);setImpactRow(null)}}><SelectTrigger className="w-44" aria-label="กรองสาขาที่ปิด"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">ทุกสาขา</SelectItem>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></label></div><Button disabled={locked} onClick={()=>open('add')} className="bg-[#2748bf] hover:bg-[#153c85]"><Plus className="mr-2 h-4 w-4"/>เพิ่มวันปิดสาขา</Button></div>
  {message?<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>:null}
  <div className="flex items-center justify-between"><h2 className="font-semibold text-[#153c85]">วันปิดที่ประกาศไว้</h2><span className="text-sm text-gray-500">{list?.scope===listScope&&!loading&&!listError?items.length+' รายการ':'—'}</span></div>
  {loading?<p role="status" className="text-sm text-blue-700">กำลังอ่านวันปิดสาขา...</p>:null}
  {listError?<p role="alert" className="text-red-700">{listError} <Button variant="outline" onClick={()=>void loadList()}>ลองอ่านใหม่</Button></p>:null}
  {!loading&&!listError&&list?.scope===listScope&&!items.length?<Card><CardContent className="py-10 text-center text-gray-500"><CalendarOff className="mx-auto mb-3 h-6 w-6"/>ยังไม่มีวันปิดสาขาในเดือนนี้</CardContent></Card>:null}
  {!loading&&!listError?items.map(row=><Card key={row.id}><CardContent className="p-4 sm:p-5"><div className="flex items-start gap-4"><div className="w-14 shrink-0 rounded-lg bg-orange-50 py-2 text-center text-orange-700"><span className="text-xs">{formatThaiDateWithWeekday(row.closure_date).split(' ')[0]}</span><p className="text-2xl font-bold">{Number(row.closure_date.slice(-2))}</p></div><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-[#153c85]">{row.branch_name||branches.find(b=>b.id===row.branch_id)?.name||"สาขาที่ปิดใช้งาน"}</h3><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">ปิดรับจอง · ทุกคอร์ส</Badge></div><p className="text-sm">{formatThaiDateWithWeekday(row.closure_date)}</p><p className="break-words text-sm text-gray-500">{row.reason}</p></div></div><div className="mt-4 flex flex-wrap gap-2 sm:ml-[72px]"><Button variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal" disabled={locked} onClick={()=>{setImpactRow(impactRow?.id===row.id?null:row);setImpactPage(1)}}>ดูรายการจองเดิม {row.impact_count} รายการ</Button><Button variant="outline" disabled={locked||row.closure_date<today} onClick={()=>open('edit',row)}>แก้เหตุผล</Button><Button variant="outline" disabled={locked||row.closure_date<today} onClick={()=>open('reopen',row)}>ยกเลิกวันปิด</Button></div>
   {impactRow?.id===row.id?<div className="mt-4 space-y-3 border-t pt-3 sm:ml-[72px]"><p className="text-sm text-gray-600">รายการเดิมยังอยู่ · เลือกจัดการทีละรายการ</p>{impactError?<p role="alert" className="text-red-700">{impactError} <Button variant="outline" onClick={()=>setEpoch(v=>v+1)}>ลองใหม่</Button></p>:!currentImpact?<p role="status">กำลังอ่านรายการจองเดิม...</p>:<>{currentImpact.items.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium text-[#153c85]">{item.learner}</p><p>{item.start.slice(0,5)}–{item.end.slice(0,5)} <Badge variant="outline" className={ADMIN_COURSES[item.course]?.className}>{ADMIN_COURSES[item.course]?.label||item.course}</Badge></p>{item.bookingStatus!=='verified'?<p className="text-xs text-gray-500">ยังไม่ยืนยันชำระ</p>:null}</div><Button variant="outline" size="sm" asChild><Link href={`/admin/makeup?month=${item.date.slice(0,7)}&${item.bookingStatus==='verified'&&item.status==='scheduled'&&!item.isMakeup&&item.identityValid?'tab=manage&':''}session=${item.id}`}>{item.bookingStatus==='verified'&&item.status==='scheduled'&&!item.isMakeup&&item.identityValid?'จัดการวันเรียน':'ดูรายการเดิม'}</Link></Button></div>)}{currentImpact.total>20?<ListPagination page={impactPage} pageSize={20} pageSizeOptions={[20]} total={currentImpact.total} onPageChange={setImpactPage} onPageSizeChange={()=>{}}/>:null}</>}</div>:null}
  </CardContent></Card>):null}
  <p className="text-xs text-gray-500">วันปิดมีผลเฉพาะวันที่ประกาศ · เปิดรับจองวันอื่นตามรอบเรียนประจำ</p>
  <Dialog open={dialog!==null} onOpenChange={value=>{if(!value&&!locked)setDialog(null)}}><DialogContent onEscapeKeyDown={e=>{if(locked)e.preventDefault()}} onInteractOutside={e=>{if(locked)e.preventDefault()}}><DialogHeader><DialogTitle>{dialog==='reopen'?'ยกเลิกวันปิดสาขา':dialog==='edit'?'แก้เหตุผลวันปิด':'เพิ่มวันปิดสาขา'}</DialogTitle><DialogDescription>เลือกสาขาและวันที่หยุดทำการเฉพาะวัน</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>สาขา</Label><Select value={branch} disabled={locked||dialog!=='add'} onValueChange={setBranch}><SelectTrigger aria-label="สาขาที่ประกาศปิด"><SelectValue/></SelectTrigger><SelectContent>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="branch-closure-date">วันที่</Label><Input id="branch-closure-date" type="date" value={date} min={today} disabled={locked||dialog!=='add'} onChange={e=>setDate(e.target.value)}/></div></div>
   {summaryLoading?<p role="status">กำลังอ่านสถานะและจำนวนรายการจองเดิม...</p>:readReady?<div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><p>{branchName} · {formatThaiDateWithWeekday(date)}</p><p>{dialog==='reopen'?'เปิดรับจองตามรอบประจำของวันที่เลือก':'ปิดรับจองทุกคอร์สเฉพาะวันนี้'}</p><p>รายการจองเดิม {summary!.total} รายการยังอยู่ให้ Admin จัดการ</p>{current&&dialog==='add'?<p>วันที่นี้ประกาศปิดไว้แล้ว การบันทึกจะปรับเหตุผล</p>:null}</div>:null}
   <Label htmlFor="branch-closure-reason">เหตุผล *</Label><Textarea id="branch-closure-reason" value={reason} disabled={locked} maxLength={1000} onChange={e=>setReason(e.target.value)} placeholder="เช่น สาขาหยุดทำการ 1 วัน"/>
   {error?<p role="alert" className="text-red-700">{error} {!uncertain?<Button variant="outline" onClick={()=>void loadSummary()}>ลองอ่านใหม่</Button>:null}</p>:null}{uncertain?<p role="status" className="text-sm text-amber-800">ยังยืนยันผลไม่ได้ ตรวจซ้ำด้วยคำขอเดิมเพื่อป้องกันรายการซ้ำ</p>:null}</div><DialogFooter><Button variant="outline" disabled={locked} onClick={()=>setDialog(null)}>ยกเลิก</Button><Button className="bg-[#f57e3b] hover:bg-[#e06d2e]" disabled={saving||!uncertain&&(!readReady||!reason.trim())} onClick={()=>void commit()}>{saving?'กำลังบันทึก...':uncertain?'ตรวจสอบคำขอเดิม':dialog==='reopen'?'ยืนยันยกเลิกวันปิด':dialog==='edit'?'บันทึกเหตุผล':'ยืนยันปิดเฉพาะวันนี้'}</Button></DialogFooter></DialogContent></Dialog>
 </section>
}
