import assert from 'node:assert/strict'
import {bookingPaymentRecovery as view} from '../src/lib/booking-payment-recovery.ts'
import {checkoutRequest,readCheckoutResult} from '../src/lib/booking-checkout.ts'
const now=Date.parse('2026-10-26T03:00:00Z'),deadline='2026-10-26T03:30:00Z'
const bill={id:'a',status:'pending_payment',lifecycle:{deadline,due:false,acceptedReceipt:false}}
const received={...bill,lifecycle:{...bill.lifecycle,acceptedReceipt:true}}
const returned={id:'p',booking_id:'a',status:'rejected',notes:'รับสลิปแล้ว\n[Admin payment review: send_back] ภาพไม่ชัด'}
assert.equal(view(bill,[],[],now).kind,'payable')
assert.equal(view(received,[],[],now).kind,'received')
assert.equal(view(received,[returned],[],now).kind,'returned')
assert.equal(view(received,[returned],[],now).reason,'ภาพไม่ชัด')
assert.equal(view(received,[returned],[],now).canSendNew,true)
assert.equal(view(received,[returned],[],Date.parse(deadline)).canSendNew,true)
assert.equal(view(bill,[],[],Date.parse(deadline)).canSendNew,false)
assert.equal(view({...received,status:'paid'},[returned],[],now).kind,'received')
assert.equal(view({...received,status:'verified'},[returned],[],now).kind,'verified')
assert.equal(view({...received,status:'cancelled'},[returned],[],now).kind,'closed')
assert.equal(view({...bill,lifecycle:{...bill.lifecycle,due:true}},[],[],now).kind,'closed')
assert.equal(view(received,[{...returned,id:'new',status:'pending'},returned],[],now).kind,'received')
const batch={id:'batch',status:'rejected',rejection_reason:'ยอดไม่ตรง',progressive_payment_batch_bookings:[{booking_id:'a'}]}
assert.equal(view(received,[],[batch],now).kind,'returned')
assert.equal(view(bill,[],[{...batch,progressive_payment_batch_bookings:[{booking_id:'other'}]}],now).kind,'payable')
assert.equal(view(received,[],[{...batch,id:'new',status:'prepared'},batch],now).kind,'returned')
assert.equal(view(received,[],[{...batch,id:'new',status:'prepared',upload_recorded_at:'2026-10-26T03:01:00Z'},batch],now).kind,'uploaded')
assert.equal(view(received,[],[{...batch,id:'new',status:'submitted'},batch],now).kind,'received')
assert.equal(view(received,[],[],Date.parse('2026-11-01T00:00:00Z')).kind,'received')
let attempts=0
await assert.rejects(readCheckoutResult(async budget=>{attempts++;assert.ok(budget>0&&budget<=6000);throw Error('offline')}),/ยังตรวจผลไม่ได้/)
assert.equal(attempts,3)
attempts=0
assert.equal(await readCheckoutResult(async()=>{if(++attempts===1)throw Error('lost');return 'saved'}),'saved')
assert.equal(attempts,2)
const cancelled=new AbortController();cancelled.abort();attempts=0
await assert.rejects(readCheckoutResult(async()=>{attempts++},cancelled.signal),{name:'AbortError'})
assert.equal(attempts,0)
const originalFetch=globalThis.fetch
try{
 globalThis.fetch=async(_url,init)=>new Promise((_,reject)=>{if(init.signal.aborted)return reject(new DOMException('Aborted','AbortError'));init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})})
 const controller=new AbortController(),request=checkoutRequest('/local-test',{signal:controller.signal},1000)
 controller.abort();await assert.rejects(request,{name:'AbortError'})
 await assert.rejects(checkoutRequest('/local-test',{},5),{name:'AbortError'})
}finally{globalThis.fetch=originalFetch}
console.log(JSON.stringify({passed:26,coverage:'on-time committed receipt preserves correction; no receipt at deadline is blocked; latest rejection; receipt vs upload; unrelated batch; bounded read recovery; caller cancellation; request timeout'}))
