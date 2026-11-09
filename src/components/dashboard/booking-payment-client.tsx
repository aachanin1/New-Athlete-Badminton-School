'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import { CheckCircle2, Clock, Loader2, Upload } from 'lucide-react'
import dynamic from 'next/dynamic'
import { BookingSlipPicker } from './booking-slip-picker'
import { BookingOrderReferences } from './booking-order-references'
import { BookingBillSummary } from './booking-bill-summary'
import { bookingHistoryHref } from '@/lib/booking-reference'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkoutRequest, readCheckoutResult, paymentTimeLeft, BOOKING_STAGES } from '@/lib/booking-checkout'
import { bookingPaymentRecovery, type RecoveryBatch, type RecoveryPayment } from '@/lib/booking-payment-recovery'
import type { BookingPaymentLifecycle } from '@/lib/booking-payment-lifecycle'
import { PaymentTransferInstructions } from '@/components/payments/payment-transfer-card'
import type { PaymentBranch, PaymentTransferSettings } from '@/lib/payment-settings'
import { resolveBookingTransferAccounts } from '@/lib/payment-settings'
import { PACKAGE_DATE_ERROR } from '@/lib/booking-package-validity'

export interface Bill {
  id: string; status: string; total_price: number; total_sessions: number; branch_id: string; pricing_scope_id: string | null
  checkout_version?: number; package_snapshot?: import('@/lib/booking-purchase').BookingPurchaseTerms | null
  package_expiry?: string | null; package_expiry_estimated?: boolean; package_dates_valid?: boolean
  package_participants?:Array<string|null>|null
  coupon_code?:string|null;coupon_gross?:number;coupon_discount?:number;coupon_state?:'reserved'|'consumed'|'released'|null
  course_type_id:string;month:number;year:number;child_id:string|null
  lifecycle: BookingPaymentLifecycle; branches: {name:string} | null; children: {full_name:string;nickname:string|null} | null
  course_types: {name:string} | null
}
export interface Session {id:string;booking_id:string;branch_id:string;child_id:string|null;date:string;start_time:string;end_time:string;status:string;children:{full_name:string;nickname:string|null}|null}
const BookingSetEditor=dynamic(()=>import('./booking-set-editor').then(m=>m.BookingSetEditor),{loading:()=> <p role="status">กำลังเปิดวันเรียนทั้งชุด…</p>})
interface Batch extends RecoveryBatch {total_amount?:number}
export interface PaymentState {
  bookings: Bill[];sessions: Session[]; payments: RecoveryPayment[]
  scopes:Array<{id:string;revision:number}>;batches:Batch[];transferSettings:PaymentTransferSettings;branches:PaymentBranch[];serverNow:string
  learners:Array<{id:string;full_name:string;nickname:string|null}>;userName:string
}

const courseName:Record<string,string>={kids_group:'กลุ่มเด็ก',adult_group:'กลุ่มผู้ใหญ่',private:'Private'}

export function BookingPaymentClient({ bookingId,bulkIds,initialEditing=false }: {bookingId?:string;bulkIds?:string[];initialEditing?:boolean}) {
  const bulkKey=bulkIds?.join(','),bulkLegacy=Boolean(bulkKey)
  const paymentView=Boolean(bookingId||bulkLegacy)
  const router=useRouter(),mutation=useRef(false)
  const [editing,setEditing]=useState(initialEditing)
  useEffect(()=>setEditing(initialEditing),[initialEditing,bookingId,bulkKey])
  const cancelRequest=useRef<{id:string;input:unknown}|null>(null)
  const [cancelPending,setCancelPending]=useState(false)
  const cancelStorageKey='nabs:set-cancel-v1:'+(bookingId||bulkKey||'list')
  const [data,setData]=useState<PaymentState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [batch,setBatch]=useState<Batch|null>(null),[file,setFile]=useState<File|null>(null),[now,setNow]=useState(Date.now())
  const [message,setMessage]=useState(''),[unknown,setUnknown]=useState(false),[ready,setReady]=useState(false)
  const [confirmCancel,setConfirmCancel]=useState(false)
  const clockOffset=useRef(0),generation=useRef(0),readRef=useRef(false)
  const lifetime=useRef<AbortController|null>(null)
  const requestKey=useRef(''),submitKey=useRef(''),attemptKey=useRef('')
  const seenIntent=useRef('')
  const seenStatus=useRef('')
  const load=useCallback(async (budget=6000) => {
    const expectedGeneration=generation.current,started=Date.now()
    const signal=lifetime.current?.signal
    const result=await checkoutRequest<PaymentState>('/api/booking-checkout'+(bookingId?'?bookingId='+encodeURIComponent(bookingId):bulkKey?'?legacyIds='+encodeURIComponent(bulkKey):''),{signal},budget)
    if(expectedGeneration!==generation.current)return result
    const scope=result.bookings[0]?.pricing_scope_id,existing=result.batches.find(b=>b.pricing_scope_id===scope&&['prepared','submitted','under_review'].includes(b.status))
    if(scope&&!existing&&result.bookings.some(b=>bookingPaymentRecovery(b,result.payments,result.batches,Date.parse(result.serverNow)).canSendNew)){
      let saved:{request?:string}|null=null;try{saved=JSON.parse(sessionStorage.getItem('nabs:payment-v1:'+scope)||'null')}catch{}
      if(saved?.request){const prior=await checkoutRequest<{found:boolean;batch?:{status:string;pricing_scope_id:string}}>('/api/booking-checkout?prepareRequestId='+encodeURIComponent(saved.request),{signal},Math.max(1,Math.min(3000,budget-(Date.now()-started))));if(prior.found&&prior.batch?.pricing_scope_id===scope&&['cancelled','rejected','approved'].includes(prior.batch.status))sessionStorage.removeItem('nabs:payment-v1:'+scope)}
    }
    if(expectedGeneration!==generation.current)return result
    const intent=JSON.stringify(result.bookings.map(b=>[b.id,b.total_price]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))
    if(seenIntent.current&&seenIntent.current!==intent&&result.bookings.some(b=>b.status==='pending_payment')){setFile(null);setMessage('ยอดหรือรายการเปลี่ยนไป กรุณาตรวจสรุปและเลือกรูปสลิปสำหรับยอดล่าสุด')}
    seenIntent.current=intent
    const statusKey=JSON.stringify(result.bookings.map(b=>[b.id,b.status,b.lifecycle?.acceptedReceipt,b.lifecycle?.due,bookingPaymentRecovery(b,result.payments,result.batches,Date.parse(result.serverNow)).kind]))
    if(seenStatus.current&&seenStatus.current!==statusKey)router.refresh()
    seenStatus.current=statusKey
    clockOffset.current=Date.parse(result.serverNow)-Date.now();setNow(Date.now()+clockOffset.current);setData(result)
    setBatch(existing||null)
    const savedCancel=sessionStorage.getItem(cancelStorageKey)
    if(savedCancel){cancelRequest.current=JSON.parse(savedCancel);setCancelPending(true);const prior=await checkoutRequest<{found:boolean}>('/api/booking-checkout?operation=set&requestId='+cancelRequest.current!.id,{signal},Math.max(1,Math.min(3000,budget-(Date.now()-started))));if(prior.found){sessionStorage.removeItem(cancelStorageKey);cancelRequest.current=null;setCancelPending(false)}else{setUnknown(true);setError('มีคำขอยกเลิกที่ยังไม่ทราบผล กดตรวจสอบผลเดิมก่อนดำเนินการต่อ')}}
    return result
  },[bookingId,bulkKey,cancelStorageKey,router])
  const keys=useCallback((scope:string)=>{
    const key='nabs:payment-v1:'+scope
    let saved:{request:string;submit:string;attempt:string}|null=null
    try{saved=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
    if(!saved){saved={request:crypto.randomUUID(),submit:crypto.randomUUID(),attempt:crypto.randomUUID()};try{sessionStorage.setItem(key,JSON.stringify(saved))}catch{}}
    requestKey.current=saved.request;submitKey.current=saved.submit;attemptKey.current=saved.attempt
  },[])
  const prepare=useCallback(async (state:PaymentState,budget=12000,createBatch=false)=>{
    const first=state.bookings[0],scope=first?.pricing_scope_id
    const recovery=first&&bookingPaymentRecovery(first,state.payments,state.batches,Date.parse(state.serverNow))
    if(!scope||first.status!=='pending_payment'||first.lifecycle?.due||recovery?.kind==='received'){setReady(true);return}
    const active=state.batches.find(b=>b.pricing_scope_id===scope&&['prepared','submitted','under_review'].includes(b.status))
    if(active){keys(active.id||scope);setBatch(active);setReady(true);return active}
    if(!createBatch){setReady(true);return}
    keys(scope)
    const prepared=await checkoutRequest<{batch:Batch}>('/api/progressive-payments/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pricingScopeId:scope,bookingIds:state.bookings.map(b=>b.id),expectedScopeRevision:state.scopes.find(s=>s.id===scope)?.revision,idempotencyKey:requestKey.current}),signal:lifetime.current?.signal},budget)
    setBatch(prepared.batch);setReady(true)
    keys(prepared.batch.batchId||prepared.batch.id||scope)
    return prepared.batch
  },[keys])
  useEffect(()=>{
    lifetime.current=new AbortController()
    const controller=lifetime.current
    cancelRequest.current=null;setCancelPending(false);mutation.current=false;readRef.current=false
    const current=++generation.current;setBusy(true);setData(null);setError('');setReady(false);setBatch(null);setFile(null);setMessage('');setUnknown(false);setConfirmCancel(false);seenIntent.current=''
    void load().then(async state=>{if(current!==generation.current)return;if(paymentView)await prepare(state)})
      .catch(()=>{if(current===generation.current){setError('ยังอ่านรายการชำระไม่สำเร็จ กรุณาตรวจสอบผลเดิม');setUnknown(true)}})
      .finally(()=>{if(current===generation.current)setBusy(false)})
    return()=>{controller.abort();generation.current=current+1}
  },[paymentView,load,prepare])
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+clockOffset.current),1000);return()=>clearInterval(timer)},[paymentView])
  const readback=useCallback(async()=>{
    if(readRef.current||mutation.current)return
    const current=generation.current,signal=lifetime.current?.signal
    readRef.current=true;setBusy(true);setError('');setMessage('กำลังตรวจผลรายการเดิม กรุณารอสักครู่')
    try{
      const end=Date.now()+20000
      const state=await readCheckoutResult(load,signal)
      if(current!==generation.current||signal?.aborted)return
      setUnknown(Boolean(cancelRequest.current));if(paymentView)await prepare(state,Math.max(1,end-Date.now()))
      return state
    }catch(e){if(current===generation.current&&!signal?.aborted){setUnknown(true);setError(e instanceof Error?e.message:'ยังตรวจผลไม่ได้')}}
    finally{if(current===generation.current){setBusy(false);readRef.current=false}}
  },[load,prepare,paymentView])
  useEffect(()=>{
    const focus=()=>{if(document.visibilityState==='visible'&&!readRef.current)void readback()}
    document.addEventListener('visibilitychange',focus);return()=>document.removeEventListener('visibilitychange',focus)
  },[readback])
  const bills=data?.bookings||[],first=bills[0]
  const deadlines=bills.map(b=>b.lifecycle?.deadline).filter((d):d is string=>Boolean(d)).sort()
  const deadline=deadlines[0],expired=bills.some(b=>b.lifecycle?.due||b.status==='cancelled')
  const expiredByDeadline=bills.some(b=>b.lifecycle?.due||b.lifecycle?.cancellationReason==='no_accepted_receipt_before_deadline')
  const elapsed=Boolean(deadline&&Date.parse(deadline)<=now)
  const verified=bills.length>0&&bills.every(b=>b.status==='verified')
  const recoveryByBill=useMemo(()=>new Map((data?.bookings||[]).map(b=>[b.id,bookingPaymentRecovery(b,data?.payments||[],data?.batches||[],0)])),[data])
  const recovery=(b:Bill)=>{
    const state=recoveryByBill.get(b.id)!,elapsed=Boolean(b.lifecycle?.deadline&&Date.parse(b.lifecycle.deadline)<=now)
    return {...state,elapsed,canSendNew:(!elapsed||b.lifecycle?.acceptedReceipt)&&(state.kind==='payable'||state.kind==='returned')}
  }
  const returned=bills.some(b=>recovery(b).kind==='returned')
  const uploaded=bills.length>0&&bills.every(b=>recovery(b).kind==='uploaded')
  const received=bills.some(b=>['received','uploaded'].includes(recovery(b).kind))
  const canSubmit=bills.length>0&&bills.every(b=>recovery(b).canSendNew)
  const recheckable=bills.length>0&&bills.every(b=>recovery(b).canRecheck)
    &&(Boolean(first?.pricing_scope_id)||new Set(bills.map(b=>recovery(b).receiptRequestId)).size===1)
  const checkMessages=[...new Set(bills.map(b=>recovery(b).checkMessage).filter(Boolean))]
  const openBills=bills.filter(b=>recovery(b).kind!=='closed'&&recovery(b).kind!=='verified')
  const mixedClosed=expired&&openBills.length>0
  const returnedReasons=[...new Set(bills.map(b=>recovery(b).reason).filter(Boolean))]
  const invalidPackageDates=bills.some(b=>b.package_dates_valid===false)
  const paymentGroups=[...new Set(bills.map(b=>b.pricing_scope_id||b.id))].map(key=>bills.filter(b=>(b.pricing_scope_id||b.id)===key))
  const total=bills.reduce((sum,b)=>sum+Number(b.total_price),0),batchId=batch?.batchId||batch?.id
  const sessionsMap=Object.fromEntries(bills.map(b=>[b.id,(data?.sessions||[]).filter(s=>s.booking_id===b.id)]))
  const receivers=data?resolveBookingTransferAccounts(data.transferSettings,data.branches,bills.map(b=>b.id),bills,sessionsMap):null
  const receiverReady=Boolean(receivers&&receivers.cards.length>0&&receivers.issues.length===0)
  const expiryRead=useRef('')
  useEffect(()=>{if(elapsed&&deadline&&expiryRead.current!==deadline&&!busy&&!verified&&!received){expiryRead.current=deadline;void readback()}},[elapsed,deadline,busy,verified,received,readback])
  const send=async()=>{
    if((!uploaded&&!file)||busy||!ready||unknown||expired||verified||(!uploaded&&(!canSubmit||received||!receiverReady||invalidPackageDates)))return
    const current=generation.current,signal=lifetime.current?.signal
    let failure=''
    mutation.current=true;setBusy(true);setError('');setMessage('กำลังส่งสลิปและตรวจสอบ กรุณารอสักครู่')
    try{
      if(first.pricing_scope_id){
        const prepared=batchId?null:await prepare(data!,12000,true)
        const payableId=batchId||prepared?.batchId||prepared?.id
        if(!payableId)throw Error('ยังเตรียมรายการไม่สำเร็จ กรุณาตรวจสอบผลเดิม')
        if(!uploaded){const upload=new FormData();upload.set('batchId',payableId);upload.set('file',file!)
        setMessage('กำลังอัปโหลดสลิป…')
        await checkoutRequest('/api/progressive-payments/upload',{method:'POST',body:upload,signal})}
        keys(payableId)
        setMessage('อัปโหลดแล้ว กำลังตรวจสอบการชำระเงิน…')
        await checkoutRequest('/api/progressive-payments/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batchId:payableId,submitKey:submitKey.current,attemptKey:attemptKey.current}),signal})
      }else{
        const retry=bills.map(b=>recovery(b).retryKey).filter(Boolean).sort().join(',')
        keys(bills.map(b=>b.id).sort().join(',')+(retry?':after:'+retry:''))
        const form=new FormData();form.set('file',file!);form.set('bookingIds',JSON.stringify(bills.map(b=>b.id)));form.set('expectedAmount',String(total));form.set('requestId',requestKey.current)
        await checkoutRequest('/api/verify-slip',{method:'POST',body:form,signal},18000)
      }
      await load();if(current===generation.current){setFile(null);setMessage('ระบบรับคำขอแล้ว กรุณาดูผลยืนยันด้านบน');router.refresh()}
    }catch(e){if(current===generation.current&&!signal?.aborted){failure=e instanceof Error?e.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิมก่อนส่งซ้ำ';setUnknown(true)}}
    finally{if(current===generation.current){mutation.current=false;setBusy(false)}}
    if(failure){const state=await readback();if(state&&current===generation.current&&state.bookings.every(b=>bookingPaymentRecovery(b,state.payments,state.batches,Date.parse(state.serverNow)).canSendNew))setError(failure)}
  }
  const retryVerification=async()=>{
    if(busy||unknown||!recheckable)return
    const current=generation.current,signal=lifetime.current?.signal
    const fresh=await readback()
    if(!fresh||current!==generation.current||signal?.aborted||!fresh.bookings.every(b=>bookingPaymentRecovery(b,fresh.payments,fresh.batches,Date.parse(fresh.serverNow)).canRecheck))return
    const target=fresh.bookings[0],scope=target.pricing_scope_id
    const active=fresh.batches.find(b=>b.pricing_scope_id===scope&&['submitted','under_review'].includes(b.status))
    const receipt=bookingPaymentRecovery(target,fresh.payments,fresh.batches,Date.parse(fresh.serverNow)).receiptRequestId
    const storageKey='nabs:slip-recheck-v1:'+(active?.id||receipt)
    let key=sessionStorage.getItem(storageKey);if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,key)}
    mutation.current=true;setBusy(true);setError('');setMessage('กำลังตรวจสลิปเดิมอีกครั้ง กรุณารอสักครู่')
    let failed=false
    try{
      if(scope&&active){keys(active.id||scope);await checkoutRequest('/api/progressive-payments/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batchId:active.id,submitKey:submitKey.current,attemptKey:key}),signal},18000)}
      else if(receipt){const form=new FormData();form.set('retry','true');form.set('checkId',key);form.set('requestId',receipt);form.set('bookingIds',JSON.stringify(fresh.bookings.map(b=>b.id)));form.set('expectedAmount',String(fresh.bookings.reduce((n,b)=>n+Number(b.total_price),0)));await checkoutRequest('/api/verify-slip',{method:'POST',body:form,signal},18000)}
      else throw Error('ยังอ่านสลิปเดิมไม่ครบ กรุณาตรวจผลเดิมอีกครั้ง')
      if(current!==generation.current)return
      sessionStorage.removeItem(storageKey);await load();setMessage('ตรวจคำขอแล้ว กรุณาดูผลล่าสุดด้านบน');router.refresh()
    }catch(e){if(current===generation.current&&!signal?.aborted){failed=true;setUnknown(true);setError(e instanceof Error?e.message:'ยังตรวจผลไม่ได้ กรุณาตรวจผลเดิมก่อนลองอีกครั้ง')}}
    finally{if(current===generation.current){mutation.current=false;setBusy(false)}}
    if(failed)await readback()
  }
  const editorUrl='/api/booking-checkout'+(bookingId?'?bookingId='+encodeURIComponent(bookingId):'?legacyIds='+encodeURIComponent(bulkKey||''))
  const cancelSet=async()=>{
    if(busy||elapsed||received)return
    const current=generation.current
    let failed=false
    mutation.current=true;setBusy(true);setError('')
    try{
      if(!cancelRequest.current){const d=await checkoutRequest<PaymentState&{editor:{token:string}}>(editorUrl+'&editor=1',{signal:lifetime.current?.signal});if(current!==generation.current)return;cancelRequest.current={id:crypto.randomUUID(),input:{action:'cancel',token:d.editor.token,bookingIds:d.bookings.map(b=>b.id)}};setCancelPending(true);sessionStorage.setItem(cancelStorageKey,JSON.stringify(cancelRequest.current))}
      const response=await fetch('/api/booking-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set',requestId:cancelRequest.current.id,input:cancelRequest.current.input}),signal:AbortSignal.any([AbortSignal.timeout(15000),...(lifetime.current?[lifetime.current.signal]:[])])})
      const result=await response.json()
      if(current!==generation.current)return
      if(!response.ok){if(result.definitive&&!result.requiresReadback){sessionStorage.removeItem(cancelStorageKey);cancelRequest.current=null;setCancelPending(false)}throw Error(result.error||'ยังยืนยันผลการยกเลิกไม่ได้')}
      sessionStorage.removeItem(cancelStorageKey);cancelRequest.current=null;setCancelPending(false)
      await load();setConfirmCancel(false);router.refresh()
    }catch(e){if(current===generation.current){failed=true;setUnknown(true);setError(e instanceof Error?e.message:'ยังยืนยันผลการยกเลิกไม่ได้ กรุณาตรวจผลเดิมก่อน')}}
    finally{if(current===generation.current){mutation.current=false;setBusy(false)}}
    if(failed)await readback()
  }
  const canEdit=bills.length>0&&bills.every(b=>b.status==='pending_payment'&&!b.lifecycle?.due&&!b.lifecycle?.acceptedReceipt)&&!expired&&!verified&&!received&&!returned&&!elapsed
  const closeEditor=()=>{setEditing(false);if(initialEditing&&bookingId)router.replace('/dashboard/booking?payment='+encodeURIComponent(bookingId))}
  if(editing&&data&&canEdit)return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-[#153c85]">แก้ไขวันเรียน / คูปอง</h1><p className="text-gray-500 text-sm mt-1">เลือกวันเรียนและตรวจยอด แล้วบันทึกกลับไปชำระเงิน</p></div><BookingSetEditor url={editorUrl} onBack={closeEditor} onDone={async()=>{setFile(null);const latest=await readback();if(!latest)throw Error('บันทึกแล้ว แต่ยังอ่านยอดล่าสุดไม่สำเร็จ กรุณาตรวจผลคำขอเดิม');closeEditor();router.refresh()}}/></div>
  return <div className="mx-auto max-w-3xl space-y-5" data-testid="booking-payment">
    {paymentView?<ol className="grid grid-cols-3 gap-2" aria-label="ขั้นตอนการจอง">{BOOKING_STAGES.map((s,i)=><li key={s} className={'rounded-xl px-2 py-3 text-center text-xs font-semibold '+(i===2?'bg-[#153c85] text-white':'bg-blue-50 text-blue-800')}>{i<2?'✓':3} {s}</li>)}</ol>:<h1 className="text-2xl font-bold text-[#153c85]">ชำระเงินที่ค้าง</h1>}
    {error&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{error}<Button variant="outline" className="mt-3 block" disabled={busy} onClick={()=>void readback()}>ตรวจสอบผลเดิม</Button>{cancelPending&&!expired&&!received&&<Button variant="outline" className="mt-3 block" disabled={busy||elapsed} onClick={()=>void cancelSet()}>ลองยกเลิกคำขอเดิมอีกครั้ง</Button>}</div>}
    {busy&&<p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>{message||'กำลังอ่านข้อมูลรายการ...'}</p>}
    {paymentView&&data&&!first&&<p className="rounded-xl border bg-white p-5">ไม่มีรายการพร้อมชำระรวม <Link className="underline" href="/dashboard/payments">กลับรายการชำระเงิน</Link></p>}{!paymentView&&data&&<>{bills.filter(b=>!b.pricing_scope_id&&b.status==='pending_payment'&&!b.lifecycle?.due&&!b.lifecycle?.acceptedReceipt).length>1&&<Link className="block rounded-xl bg-[#153c85] p-4 text-center font-semibold text-white" href={'/dashboard/payments?legacy='+bills.filter(b=>!b.pricing_scope_id&&b.status==='pending_payment'&&!b.lifecycle?.due&&!b.lifecycle?.acceptedReceipt).map(b=>b.id).join(',')}>ชำระรวมรายการผู้ใหญ่ / Private ที่พร้อมชำระ</Link>}{bills.length===0?<div className="rounded-xl border bg-white p-6">ไม่มีรายการรอชำระเงิน<Link className="mt-4 block font-semibold text-orange-600" href="/dashboard/booking">จองวันเรียน →</Link></div>:paymentGroups.map(group=>{const b=group[0],amount=group.reduce((n,x)=>n+Number(x.total_price),0),received=group.some(x=>['received','uploaded'].includes(recovery(x).kind)),returned=group.some(x=>recovery(x).kind==='returned'),due=group.some(x=>recovery(x).kind==='closed'),deadline=group.map(x=>x.lifecycle?.deadline).filter((v):v is string=>Boolean(v)).sort()[0];return <article className="rounded-xl border bg-white p-5" key={b.pricing_scope_id||b.id}><BookingOrderReferences ids={group.map(x=>x.id)} visibleIds={bills.map(x=>x.id)} /><p className="mt-3 font-semibold">{[...new Set(group.map(x=>courseName[x.course_types?.name||'']))].join(' · ')}</p><p className="mt-1 text-sm">{[...new Set(group.flatMap(x=>x.package_participants?.length?x.package_participants.map(id=>{const learner=data?.learners.find(l=>l.id===id);return learner?formatLearnerDisplayName({fullName:learner.full_name,nickname:learner.nickname}):data?.userName||'ตัวเอง'}):x.children?[formatLearnerDisplayName({fullName:x.children.full_name,nickname:x.children.nickname})]:[data?.userName||'ตัวเอง']))].join(', ')}</p><p className="mt-1 text-sm text-gray-600">{[...new Set(group.flatMap(x=>{const rows=(sessionsMap[x.id]||[]).filter(s=>!['cancelled','walleted','rescheduled'].includes(s.status));return rows.length?rows.map(s=>data?.branches.find(branch=>branch.id===s.branch_id)?.name||'ไม่มีข้อมูลชื่อสาขา'):[x.branches?.name||'ไม่มีข้อมูลชื่อสาขา']}))].join(' · ')}</p><p className={"mt-2 "+(!due&&!received?"text-xl font-bold text-red-700":"text-sm text-gray-600")}>{due?'หมดเวลาชำระ':returned?'กรุณาแก้สลิป — ส่งใหม่ในรายการเดิมได้':received?'รับสลิปแล้ว — ดูสถานะล่าสุด':deadline?'เหลือ '+paymentTimeLeft(deadline,now):'รอชำระเงิน'}</p><strong className="mt-2 block">฿{amount.toLocaleString()}</strong><Link className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[#153c85] px-5 py-3 font-semibold text-white" href={'/dashboard/booking?payment='+b.id}>{due?'ดูรายการหมดเวลา':returned?'แก้สลิป':received?'ดูสถานะสลิป':'ชำระเงินต่อ'}</Link></article>})}</>}
    {paymentView&&first&&<>
      {verified?<section className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center" role="status"><CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600"/><h1 className="text-2xl font-bold text-green-900">{total===0?'ยืนยันการจองแล้ว':'ชำระเงินสำเร็จ'}</h1><p className="mt-2">{total===0?'ยอดสุทธิ 0 บาท ไม่ต้องแนบสลิป':'ระบบยืนยันการชำระเงินเรียบร้อยแล้ว'}</p><Link prefetch={false} className="mt-4 block font-semibold underline" href={bookingHistoryHref(bills.map(b=>b.id))}>ดูประวัติรายการนี้</Link><Link className="mt-5 inline-block rounded-xl bg-[#153c85] px-6 py-3 font-semibold text-white" href={first.package_snapshot&&!data?.sessions.length?'/dashboard/lesson-wallet':'/dashboard/schedule'}>{first.package_snapshot&&!data?.sessions.length?'เลือกวันจากกระเป๋า':'ดูตารางเรียน'}</Link></section>:
        expired?<section className="rounded-xl border border-rose-200 bg-rose-50 p-5"><h1 className="text-xl font-bold">{mixedClosed?'บางรายการในชุดนี้ปิดแล้ว':expiredByDeadline?'รายการหมดเวลาแล้ว':'รายการยกเลิกแล้ว'}</h1><p className="mt-2 text-sm">{mixedClosed?'รายการอื่นยังมีสถานะและกำหนดเวลาเดิม กรุณาเปิดยอดล่าสุดก่อนทำต่อ':'หากยังไม่ได้โอน เริ่มจองใหม่และเลือกวันเรียนใหม่ได้ ข้อมูลผู้เรียนที่บันทึกไว้ยังอยู่'}</p>{mixedClosed?<Link className="mt-4 inline-block rounded-lg bg-[#153c85] px-5 py-3 font-semibold text-white" href={bulkLegacy?'/dashboard/payments?legacy='+openBills.map(b=>b.id).join(','):'/dashboard/payments'}>ตรวจรายการที่ยังเปิดอยู่</Link>:<Link className="mt-4 inline-block rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white" href="/dashboard/booking">ยังไม่ได้โอน — เริ่มจองใหม่</Link>}</section>:
        received?<section role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h1 className="text-xl font-bold">{uploaded?'บันทึกสลิปแล้ว ดำเนินการตรวจต่อได้':'รับสลิปแล้ว ยังตรวจยืนยันไม่สำเร็จ'}</h1><p className="mt-2 text-sm">{uploaded?'ดำเนินการต่อด้วยสลิปเดิมได้ ไม่ต้องเลือกรูปใหม่หรือโอนซ้ำ':checkMessages.join(' · ')}</p>{recheckable&&<Button className="mt-4 mr-3 min-h-12" disabled={busy||unknown} onClick={()=>void retryVerification()}>ลองตรวจสลิปเดิมอีกครั้ง</Button>}{uploaded&&<Button className="mt-4 mr-3" disabled={busy||unknown||!ready} onClick={()=>void send()}>ดำเนินการตรวจสลิปเดิมต่อ</Button>}<Button className="mt-4" variant="outline" disabled={busy} onClick={()=>void readback()}>ตรวจสอบผลเดิม</Button></section>:
        returned?<section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5" data-testid="payment-returned"><h1 className="text-xl font-bold">กรุณาแก้สลิป</h1>{returnedReasons.map(reason=><p key={reason} className="mt-2 whitespace-pre-wrap break-words">เหตุผล: {reason}</p>)}<p className="mt-2 text-sm">{canSubmit?'เลือกรูปสลิปของการโอนรายการเดิมที่ถูกต้อง แล้วส่งตรวจอีกครั้งได้ด้านล่าง':'ยังรับสลิปใหม่ไม่ได้ กรุณาตรวจผลรายการเดิมก่อน'} กรุณาอย่าโอนซ้ำ</p></section>:null}
      <section className="space-y-4 rounded-2xl border bg-white p-5" data-testid="payment-order-total">
        <div className="space-y-2"><h2 className="text-xl font-bold text-[#153c85]">{verified?'รายการที่ยืนยันแล้ว':expired?'สถานะชุดรายการเดิม':returned?'รายการที่ต้องแก้หลักฐาน':'สรุปและชำระเงิน'}</h2><BookingOrderReferences ids={bills.map(b=>b.id)} /></div>
        {data && <div className="space-y-4" data-testid="payment-booking-summary">{bills.map(b => <BookingBillSummary key={b.id} bill={b} sessions={sessionsMap[b.id] || []} data={data} showPrice={bills.length > 1} />)}</div>}
        {expired ? <div className="space-y-3 text-sm">{bills.map(b=><div key={b.id}><BookingOrderReferences ids={[b.id]} visibleIds={bills.map(x=>x.id)}/><p>{recovery(b).kind==='closed'?'ปิดแล้ว':recovery(b).kind==='verified'?'ยืนยันแล้ว':'ยังเปิดอยู่ — ตรวจยอดล่าสุดก่อนทำต่อ'} · ฿{Number(b.total_price).toLocaleString()}</p></div>)}</div> : <div className="space-y-2 border-t pt-4">
          {bills.some(b => Number(b.coupon_discount) > 0) && <><p className="flex justify-between gap-2 text-sm text-gray-600"><span>ราคาก่อนส่วนลด{bills.length > 1?'ทั้งชุด':''}</span><span>฿{bills.reduce((n,b)=>n+Number(b.coupon_gross ?? b.total_price),0).toLocaleString()}</span></p><p className="flex justify-between gap-2 text-sm text-green-700"><span>ส่วนลดคูปอง</span><span>−฿{bills.reduce((n,b)=>n+Number(b.coupon_discount || 0),0).toLocaleString()}</span></p></>}
          <p className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold"><span>{verified?'ชำระแล้ว':returned?'ยอดรายการเดิม':received?'ยอดส่งตรวจสอบ':unknown?'ยอดรายการที่กำลังตรวจผล':'ยอดสุทธิที่ต้องชำระ'}</span><span className="text-3xl text-[#2748bf]" data-testid="payment-net-total">฿{total.toLocaleString()}</span></p>
        </div>}
        {canEdit&&<Button variant="outline" className="min-h-11 w-full border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" disabled={busy||unknown||elapsed} onClick={()=>{setFile(null);setEditing(true)}}><Pencil className="mr-2 h-4 w-4"/>แก้ไขวันเรียน / คูปอง{bills.length>1?'ทั้งชุด':''}</Button>}
        <Link className="block text-center text-sm text-blue-700 underline" href="/dashboard/payments">เลือกรายการค้างอื่น</Link>
      </section>
      {!expired&&!verified&&!received&&invalidPackageDates&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm" data-testid="payment-package-expiry-error">{PACKAGE_DATE_ERROR} กด “แก้ไขวันเรียน” ก่อนชำระเงิน</p>}

      {!expired&&!verified&&!received&&!invalidPackageDates&&!unknown&&canSubmit&&<section className="space-y-5 rounded-2xl border bg-white p-5">
        {returned?<p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">ระบบรับสลิปครั้งแรกทันเวลาแล้ว แก้สลิปในรายการเดิมได้ โดยไม่ต้องเริ่มจองหรือโอนใหม่</p>:<div className="flex items-center justify-between gap-3 rounded-xl bg-orange-50 p-4"><p className="font-semibold">โอนและส่งสลิปภายใน</p><p className="flex items-center gap-2 text-2xl font-bold text-orange-700" data-testid="payment-countdown"><Clock className="h-5 w-5"/>{paymentTimeLeft(deadline,now)||'กำหนดตามรายการเดิม'}</p></div>}
        <h2 className="font-bold">{returned?'1. ตรวจยอดรายการเดิม':'1. โอนเงิน'} ฿{total.toLocaleString()}</h2>
        {data&&!returned&&<PaymentTransferInstructions key={first.id} settings={data.transferSettings} branches={data.branches} payBookingIds={bills.map(b=>b.id)} bookings={bills} bookingSessionsMap={sessionsMap} submitted={busy||unknown} compact/>}
        {returned&&<p className="text-sm font-semibold text-amber-900">ใช้หลักฐานการโอนรายการเดิม กรุณาอย่าโอนซ้ำ</p>}
        <BookingSlipPicker file={file} onFile={f=>{setFile(f);setError('')}} disabled={busy||unknown||!ready||!canSubmit}/>
        {!busy&&(!ready||unknown||!canSubmit||!receiverReady||!file)&&<p className="text-sm text-amber-900" role="status">{unknown?'ยังไม่ทราบผลคำขอเดิม กรุณากดตรวจสอบผลเดิม':!canSubmit?'ยังรับสลิปใหม่ไม่ได้ กรุณาตรวจผลเดิม':!ready?'กำลังเตรียมข้อมูลชำระเงิน':!receiverReady?(receivers?.issues.join(' · ')||'ยังอ่านบัญชีรับเงินไม่ครบ'):'เลือกรูปสลิปก่อน แล้วจึงกดส่งสลิปด้านล่าง'}</p>}
        <Button className="h-auto min-h-12 w-full whitespace-normal bg-orange-500 py-3 text-base hover:bg-orange-600" onClick={()=>void send()} disabled={!file||busy||unknown||!ready||!canSubmit||!receiverReady}><Upload className="mr-2 h-5 w-5"/>{returned?'ส่งตรวจสลิปอีกครั้ง':'3. ส่งสลิปยืนยันการชำระเงิน'} ฿{total.toLocaleString()}</Button>
        <p className="text-sm text-gray-600">{returned?'ออกจากหน้านี้แล้วกลับมาแก้สลิปในรายการเดิมต่อได้':'เผลอออกจากหน้านี้ กลับได้จากเมนู “ชำระเงินที่ค้าง” ด้วยเวลาที่เหลือเดิม'}</p>
        {!returned&&<div className="border-t pt-5"><Button variant="outline" className="min-h-11 border-red-300 bg-red-50 text-red-700 hover:bg-red-100" disabled={busy||unknown||elapsed} onClick={()=>setConfirmCancel(true)}><Trash2 className="mr-2 h-4 w-4"/>{bills.length>1?'ยกเลิกชุดนี้ทั้งหมด':'ยกเลิกรายการนี้'}</Button></div>}
        <Dialog open={confirmCancel} onOpenChange={v=>{if(!busy)setConfirmCancel(v)}}><DialogContent className="max-h-[85dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>ยืนยันยกเลิก{bills.length>1?'ทั้งชุด':'รายการนี้'}?</DialogTitle><DialogDescription>วันเรียนด้านล่างจะถูกยกเลิก หากโอนแล้วให้กลับไปส่งสลิปหรือติดต่อเจ้าหน้าที่</DialogDescription></DialogHeader>{unknown&&<div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{error||'ยังยืนยันผลไม่ได้ ตรวจคำขอเดิมก่อนยกเลิกซ้ำ'}<Button variant="outline" className="mt-3 block" disabled={busy} onClick={()=>void readback()}>ตรวจสอบผลเดิม</Button></div>}<div className="space-y-2 text-sm">{bills.map(b=><div key={b.id}><p className="font-semibold">{courseName[b.course_types?.name||'']} · ฿{Number(b.total_price).toLocaleString()}</p>{sessionsMap[b.id]?.map(s=><p key={s.id}>{s.children?.nickname||s.children?.full_name||data?.userName} · {s.date} {s.start_time.slice(0,5)}</p>)}</div>)}</div><p className="font-bold">รวม ฿{total.toLocaleString()}</p><Button variant="destructive" className="min-h-12" disabled={busy||unknown} onClick={()=>void cancelSet()}>ยืนยันยกเลิก{bills.length>1?'ทั้งชุด':'รายการ'}</Button><Button variant="outline" disabled={busy} onClick={()=>setConfirmCancel(false)}>กลับไปชำระ</Button></DialogContent></Dialog>
      </section>}
      {!verified&&!returned&&!received&&<p className="rounded-xl bg-gray-100 p-4 text-sm">กรุณาใช้สลิปของรายการเดิมและอย่าโอนซ้ำ ระบบจะแสดงผลล่าสุดในหน้านี้</p>}
    </>}
  </div>
}
