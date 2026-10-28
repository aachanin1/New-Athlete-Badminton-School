import assert from 'node:assert/strict'
import {classifyBookingSlip} from '../src/lib/booking-slip-verification.ts'
import {SLIP_CHECK_MARKER,storedSlipCheck,slipResultMessage} from '../src/lib/booking-slip-result.ts'
import {bookingPaymentRecovery} from '../src/lib/booking-payment-recovery.ts'
import {resolveProgressiveSlipVerification,isSharedSlipOKTestMode} from '../src/lib/progressive-slipok.ts'
const passed=[]
for(const code of [1005,1006,1007,1008,1011,1012,1013,1014]){
 const x=classifyBookingSlip({success:false,code},5500);assert.equal(x.decision,'rejected');assert.ok(x.message);passed.push('correction-'+code)
}
for(const code of [1000,1001,1002,1003,1004,1009,1010,500,'UNKNOWN']){
 const x=classifyBookingSlip({success:false,code},5500);assert.equal(x.decision,'under_review');assert.ok(x.message);passed.push('unresolved-'+code)
}
assert.equal(classifyBookingSlip({success:false,timeout:true},5500).code,'SLIPOK_TIMEOUT');passed.push('timeout-never-approved')
const data={transRef:'synthetic',amount:5500,date:'2026-10-27'}
assert.equal(classifyBookingSlip({success:true,data},5500).decision,'approved');passed.push('matching-amount')
assert.equal(classifyBookingSlip({success:true,data:{...data,amount:100}},5500).decision,'rejected');passed.push('amount-mismatch')
assert.equal(classifyBookingSlip({success:true},5500).decision,'under_review');passed.push('missing-data')
assert.equal(classifyBookingSlip({success:false,code:1012,data},5500).decision,'rejected');passed.push('provider-duplicate-data-not-an-approval')
const stored={decision:'under_review',code:'SLIPOK_TIMEOUT',message:slipResultMessage('SLIPOK_TIMEOUT'),receiptRequestId:'receipt'}
assert.deepEqual(storedSlipCheck(SLIP_CHECK_MARKER+JSON.stringify(stored)),stored);assert.equal(storedSlipCheck(SLIP_CHECK_MARKER+'broken'),null);passed.push('stored-readable-outcome')
const b={id:'bill',status:'paid',lifecycle:{due:false,acceptedReceipt:true,deadline:'2026-10-27T00:00:00Z'}}
const p={id:'payment',booking_id:b.id,status:'pending',notes:SLIP_CHECK_MARKER+JSON.stringify(stored),receipts:[{request_id:'receipt'}]}
assert.equal(bookingPaymentRecovery(b,[p],[],Date.parse('2026-10-28')).canRecheck,true);passed.push('same-receipt-recheck-after-deadline')
for(const status of ['cancelled','verified'])assert.equal(bookingPaymentRecovery({...b,status},[p],[],Date.now()).canRecheck,false);passed.push('terminal-bills-not-recheckable')
let networks=0
const test=await resolveProgressiveSlipVerification({attemptId:'synthetic',totalAmount:5500,providerMode:'test',loadSlip:async()=>{throw Error('Test mode must not load bank proof')}},{verifyLive:async()=>{networks++;throw Error('No network allowed')}})
assert.equal(test.decision,'approved');assert.equal(test.resultCode,'TEST_APPROVED');assert.equal(networks,0);assert.equal(isSharedSlipOKTestMode('true'),true);passed.push('test-true-never-uses-live-provider')
console.log(JSON.stringify({passed:passed.length,checks:passed}))
