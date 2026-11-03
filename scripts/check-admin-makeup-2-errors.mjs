import assert from 'node:assert/strict'
import {callMakeupWorkspace} from '../src/lib/admin-makeup-workspace-rpc.ts'
import {Task10Error} from '../src/lib/task10-policy.ts'
const checks=[]
for(const [code,status,text]of [['LESSON_WALLET_TARGET_CONFLICT',409,'ซ้ำหรือซ้อน'],['LESSON_SOURCE_PRIVATE_DURATION',409,'ระยะเวลา'],['LESSON_WALLET_ENTITLEMENT_EXPIRED',409,'หมดอายุ'],['LESSON_SOURCE_RETRY',503,'คำขอเดิม'],['TASK10_UNAUTHORIZED',403,'ไม่มีสิทธิ์'],['TASK10_LEARNER_OVERLAP',409,'ซ้ำหรือซ้อน']]){
 let calls=0;await assert.rejects(callMakeupWorkspace({rpc:async()=>{calls++;return{data:null,error:{code:'P0001',message:code}}}},'admin_makeup_use_v2'),e=>e instanceof Task10Error&&e.code===code&&e.status===status&&e.message.includes(text));assert.equal(calls,1);checks.push(code)
}
assert.deepEqual(await callMakeupWorkspace({rpc:async()=>({data:{success:true},error:null})},'admin_makeup_use_v2'),{success:true});checks.push('success result retained')
await assert.rejects(callMakeupWorkspace({rpc:async()=>({data:null,error:{message:'network unavailable'}})},'admin_makeup_use_v2'),e=>e.status===503);checks.push('unknown remains uncertain')
console.log(JSON.stringify({passed:checks.length,checks}))
