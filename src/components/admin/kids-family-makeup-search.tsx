'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {ListPagination} from '@/components/admin/list-pagination'
import {KidsFamilyMakeupPanel} from '@/components/admin/kids-family-makeup-panel'
import type {MakeupContinuation} from '@/components/admin/admin-lesson-manager'
import type {KidsFamilyMakeupCard} from '@/lib/kids-family-makeup'
import type {BranchOption} from '@/lib/admin-makeup-read-model'
interface Family {user_id:string;parent_name:string;branch_ids:string[];branch_names:string[]}
export function KidsFamilyMakeupSearch({month,active,branches,search,branch,course,onSavingChange,continuation,onContinuationHandled}:{
 month:string;active:boolean;branches:BranchOption[];search:string;branch:string;course:string;onSavingChange:(saving:boolean)=>void;continuation:MakeupContinuation|null;onContinuationHandled:()=>void
}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(1),[list,setList]=useState<{items:Family[];total:number}>({items:[],total:0}),[card,setCard]=useState<KidsFamilyMakeupCard|null>(null)
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[locked,setLocked]=useState(false),[epoch,setEpoch]=useState(0)
 const revision=useRef(0),handled=useRef(''),cardController=useRef<AbortController|null>(null),lastSelection=useRef<{parent:string;sourceMonth:string}|null>(null)
 const cards=useMemo(()=>card?[card]:[],[card])
 const open=useCallback(async(parent:string,sourceMonth:string)=>{
  lastSelection.current={parent,sourceMonth};cardController.current?.abort();const control=new AbortController();cardController.current=control;const rev=++revision.current
  setLoading(true);setError('');setCard(null)
  try{const r=await fetch(`/api/admin/makeup/family-card?${new URLSearchParams({parent,month:sourceMonth})}`,{cache:'no-store',signal:control.signal}),data=await r.json();if(!r.ok||!data.state?.sourceMonth)throw Error(data.error||'อ่านสิทธิ์ไม่สำเร็จ');if(revision.current===rev)setCard(data)}catch(e){if(!control.signal.aborted&&revision.current===rev)setError(e instanceof Error?e.message:'อ่านสิทธิ์ไม่สำเร็จ')}finally{if(revision.current===rev&&!control.signal.aborted)setLoading(false)}
 },[])
 useEffect(()=>()=>cardController.current?.abort(),[])
 useEffect(()=>{revision.current++;cardController.current?.abort();lastSelection.current=null;setCard(null);setList({items:[],total:0});setQuery('');setPage(1);setLoading(false);setError('')},[month,branch,course])
 useEffect(()=>{if(!active||!continuation||handled.current===continuation.key)return;handled.current=continuation.key;void open(continuation.parentId,continuation.sourceMonth)},[active,continuation,open,epoch])
 useEffect(()=>{
  if(!active||query.length<2||!['all','kids_group'].includes(course))return
  const control=new AbortController();setLoading(true);setError('');const rev=++revision.current
  const params=new URLSearchParams({month,course:'kids_group',mode:'families',search:query,page:String(page)});if(branch!=='all')params.set('branch',branch)
  void fetch('/api/admin/makeup/lookup?'+params,{cache:'no-store',signal:control.signal}).then(async r=>{const data=await r.json();if(!r.ok||!Array.isArray(data.items))throw Error(data.error||'อ่านครอบครัวไม่สำเร็จ');if(revision.current===rev)setList(data)}).catch(e=>{if(!control.signal.aborted&&revision.current===rev){setList({items:[],total:0});setError(e instanceof Error?e.message:'อ่านครอบครัวไม่สำเร็จ')}}).finally(()=>{if(!control.signal.aborted&&revision.current===rev)setLoading(false)})
  return()=>control.abort()
 },[active,query,page,branch,course,month,epoch])
 if(!['all','kids_group'].includes(course)&&!card)return null
 return <section aria-label="ค้นหาสิทธิ์ครอบครัว" className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[#153c85]">เด็ก — สิทธิ์ร่วมครอบครัว</h2><Button disabled={locked||search.trim().length<2} onClick={()=>{setCard(null);setQuery(search.trim());setPage(1);setEpoch(v=>v+1)}}>ค้นหาครอบครัว</Button></div>
  {!query&&!card&&!loading?<p className="text-sm text-gray-500">พิมพ์ชื่อผู้เรียนหรือผู้ปกครองอย่างน้อย 2 ตัวอักษร แล้วกดค้นหาครอบครัว</p>:null}
  {loading?<p role="status" className="text-sm text-blue-700">กำลังอ่านข้อมูลที่เลือก...</p>:null}
  {error?<p role="alert" className="text-sm text-red-700">{error} <Button variant="outline" onClick={()=>{if(lastSelection.current){void open(lastSelection.current.parent,lastSelection.current.sourceMonth)}else{if(continuation)handled.current='';setEpoch(v=>v+1)}}}>ลองใหม่</Button></p>:null}
  {!loading&&!error&&!card&&query? <Card><CardContent className="p-4"><p className="text-sm text-gray-500">พบ {list.total} ครอบครัว</p>{list.items.map(f=><Button key={f.user_id} variant="ghost" className="mt-2 h-auto w-full justify-between whitespace-normal py-3 text-left" onClick={()=>void open(f.user_id,month)}><span><span className="block font-semibold text-[#153c85]">{f.parent_name}</span><span className="text-xs text-gray-500">{f.branch_names.join(' · ')}</span></span><span>ดูสิทธิ์ →</span></Button>)}{list.total>10?<ListPagination page={page} total={list.total} pageSize={10} pageSizeOptions={[10]} onPageChange={setPage} onPageSizeChange={()=>{}}/>:null}</CardContent></Card>:null}
  {card?<KidsFamilyMakeupPanel cards={cards} scheduleTemplates={[]} branches={branches} search="" branch="all" course="all" status="all" onSavingChange={value=>{setLocked(value);onSavingChange(value)}} continuation={continuation} onContinuationHandled={onContinuationHandled}/>:null}
 </section>
}
