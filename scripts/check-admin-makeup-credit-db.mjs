import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,env,sql,q,concurrentSql,holdTransaction,observeLockWait,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),checks=[],tag='เครดิตแปด'+randomUUID().slice(0,8)
const check=(v,name)=>{assert.ok(v,name);checks.push(name);console.log(name)}
const reject=(fn,re,name)=>{assert.throws(fn,re);checks.push(name);console.log(name)}
const baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const {admin,sa,coach}=baseline,{account,fixture,target}=fixtures
const date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3);"),month=date.slice(0,7)
const transition=(actor,op,id,payload={})=>JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(actor.id)},${q(op)},${q(id)},${q(JSON.stringify(payload))}::jsonb);`))
const state=f=>JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(admin.id)},${q(f.parent.id)},${q(month+'-01')});`))
const decideSql=(f,request=randomUUID(),operation='approve',reason='เหตุผลส่วนตัว-'+tag,readOnly=false,actor=admin)=>`SELECT admin_makeup_credit_decide_v1(${q(actor.id)},${q(f.credit)},${q(operation)},${q(reason)},${q(request)},${readOnly});`
const mk=async(name,n=3)=>{const parent=await account('user',tag+name),f=fixture('kids_group',false,parent,date,'16:00','17:00');sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=${n} WHERE id=${q(f.booking)};COMMIT;`);return f}
const store=(f,approve=false,actor=admin,request=randomUUID())=>{const payload={reason:'เหตุผลส่วนตัว-'+tag,requestId:request,...(approve?{approveCredit:true}:{})},result=transition(actor,actor===f.parent?'store':'admin_store',f.ids[0],payload);f.credit=result.credit_id;return {result,payload,request}}
const usePayload=(f,dst=target(f,true),request=randomUUID())=>({attendingChildId:f.children[0],targetDate:dst.date,startTime:dst.start,endTime:dst.end,branchId:dst.branch,templateId:dst.template,requestId:request,reason:'จัดวันชดเชยปกติ'})
const initial=await mk('พร้อมเก็บ'),s0=store(initial,true)
check(s0.result.approval?.confirmed&&state(initial).quota===0&&state(initial).eligible,'Q0: explicit atomic Store+approval creates one usable source without increasing Q')
check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE id=${q(initial.credit)};`)==='1','One stored credit only')
const replay=transition(admin,'admin_store',initial.ids[0],s0.payload)
check(replay.approval.approvalId===s0.result.approval.approvalId,'Atomic Store+approval exact replay retains decision')
reject(()=>transition(admin,'admin_store',initial.ids[0],{...s0.payload,approveCredit:false}),/IDEMPOTENCY_CONFLICT/,'Same Store request cannot change approval choice')
const dst=target(initial,true),payload=usePayload(initial,dst),consumed=transition(admin,'makeup',initial.ids[0],payload)
check(consumed.useMode==='exception'&&consumed.remaining===0&&state(initial).used===1&&state(initial).exceptionUsed===1,'Q0 approved use counts actual usage and never returns negative remaining')
check(JSON.stringify(transition(admin,'makeup',initial.ids[0],payload))===JSON.stringify(consumed),'Consumed exceptional request replays before stale-source checks')
reject(()=>transition(admin,'makeup',initial.ids[0],{...payload,requestId:randomUUID()}),/CONFLICT|INELIGIBLE/,'A new request cannot consume the source twice')
check(sql(`SELECT status||':'||used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(initial.credit)};`)==='consumed:exception','Fallback durably closed after exceptional use')
const ordinary=await mk('โควตาเหลือ',8);store(ordinary,true);const ordinaryResult=transition(admin,'makeup',ordinary.ids[0],usePayload(ordinary))
check(ordinaryResult.useMode==='normal'&&ordinaryResult.remaining===1&&state(ordinary).exceptionUsed===0,'Approved credit consumes normal quota first')
check(sql(`SELECT used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(ordinary.credit)};`)==='normal','Normal use closes approval without leaving another right')
const later=await mk('อนุมัติภายหลัง'),laterStore=store(later)
check(!state(later).eligible&&state(later).sources[0].approvalAvailable,'Ordinary Admin Store is not automatically approved but offers exact approval')
const decisionRequest=randomUUID(),decision=JSON.parse(sql(decideSql(later,decisionRequest)))
check(decision.confirmed&&JSON.parse(sql(decideSql(later,decisionRequest,'approve','เหตุผลส่วนตัว-'+tag,true))).approvalId===decision.approvalId,'Later approval has stable readback')
reject(()=>sql(decideSql(later,decisionRequest,'approve','เปลี่ยนเหตุผล')),/IDEMPOTENCY_CONFLICT/,'Approval UUID cannot be reused with different reason')
check(JSON.parse(sql(decideSql(later,randomUUID(),'approve','ตรวจคำขอเดิม',true))).confirmed===false,'Missing decision readback performs no write')
const revoke=JSON.parse(sql(decideSql(later,randomUUID(),'revoke','อนุมัติผิดเครดิต')))
check(revoke.status==='revoked'&&!state(later).eligible,'Revocation closes unspent approval')
reject(()=>sql(decideSql(later)),/APPROVAL_CONFLICT/,'Revoked source cannot be reapproved')
const parentOnly=await mk('ผู้ปกครองเก็บ');store(parentOnly,false,parentOnly.parent)
reject(()=>sql(decideSql(parentOnly)),/APPROVAL_INELIGIBLE/,'Parent-stored source cannot gain an Admin Store exception')
reject(()=>sql(decideSql(parentOnly,randomUUID(),'approve','ทดสอบ',false,parentOnly.parent)),/UNAUTHORIZED/,'Parent cannot approve own source')
reject(()=>sql(decideSql(parentOnly,randomUUID(),'approve','ทดสอบ',false,coach)),/UNAUTHORIZED/,'Coach cannot approve credit')
const wallet=await mk('ใช้กระเป๋า'),walletStore=store(wallet,true),walletDst=target(wallet,false,1)
transition(wallet.parent,'redeem',wallet.credit,{targetDate:walletDst.date,startTime:walletDst.start,endTime:walletDst.end,branchId:walletDst.branch,templateId:walletDst.template})
check(sql(`SELECT status||':'||used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(wallet.credit)};`)==='consumed:wallet','Parent same-month redemption closes approved fallback atomically')
const paused=await mk('หยุดระบบ');store(paused,true);sql("UPDATE task10_policy_activation SET makeup_enabled=false,state='paused';")
try{reject(()=>transition(admin,'makeup',paused.ids[0],usePayload(paused)),/PAUSED/,'Policy pause blocks exceptional use');check(!state(paused).eligible,'Paused approved source remains ineligible')}finally{sql("UPDATE task10_policy_activation SET makeup_enabled=true,state='active';")}
const race=await mk('แข่งอนุมัติ');store(race);const raceRequests=[randomUUID(),randomUUID()]
const outcomes=await Promise.allSettled(raceRequests.map(id=>concurrentSql(decideSql(race,id))))
check(outcomes.filter(r=>r.status==='fulfilled').length===1&&sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(race.credit)};`)==='1','Concurrent approvals produce one durable winner')
const history=JSON.parse(sql(`SELECT admin_makeup_history_v1(${q(admin.id)},${q(month+'-01')},${q(initial.parent.id)},'kids_group');`))
check(history.items.some(e=>e.id.startsWith('approval:')&&e.reason==='เหตุผลส่วนตัว-'+tag),'Internal reason is present only in authorized Admin history evidence')
const notifications=sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('title',title,'message',message)),'[]') FROM notifications WHERE user_id=${q(initial.parent.id)};`)
check(notifications.includes('ได้รับวันชดเชยแล้ว')&&!notifications.includes(tag)&&!/กรณีพิเศษ|เกินโควตา/.test(notifications),'User completion notification contains ordinary result and no approval reason')
check(sql(`SELECT notes FROM lesson_wallet_credits WHERE id=${q(initial.credit)};`).includes('Stored atomically')&&!sql(`SELECT notes FROM lesson_wallet_credits WHERE id=${q(initial.credit)};`).includes(tag),'Internal reason never copied into User-readable Wallet notes')
for(const role of ['anon','authenticated']){
 reject(()=>sql(`SET ROLE ${role};SELECT * FROM admin_makeup_credit_approvals;`),/permission denied/,'No '+role+' direct approval table access')
 reject(()=>sql(`SET ROLE ${role};SELECT * FROM admin_makeup_credit_decisions;`),/permission denied/,'No '+role+' direct reason/audit access')
 reject(()=>sql(`SET ROLE ${role};SELECT admin_makeup_credit_decide_v1(${q(admin.id)},${q(initial.credit)},'approve','reason',${q(randomUUID())},true);`),/permission denied/,'No '+role+' decision RPC execution')
}
const fixturesOut={tag,month,admin,sa,coach,initial,s0,payload,consumed,ordinary,later,laterStore,parentOnly,wallet,walletStore,paused,race}
fs.writeFileSync(path.join(root,'credit-fixture.json'),JSON.stringify(fixturesOut,null,2))
fs.writeFileSync(path.join(root,'db-'+Date.now()+'.json'),JSON.stringify({passed:true,runId:run.runId,checks,fixtures:tag},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:true,checks:checks.length}))
