import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,concurrentSql,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9'),base=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const {admin,coach}=base,{account,fixture,target}=fixtures,checks=[],tag='เก็บครั้งเดียว'+randomUUID().slice(0,6)
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log(name)}
const reject=(fn,re,name)=>{assert.throws(fn,re);checks.push(name);console.log(name)}
const date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3);"),month=date.slice(0,7)
const transition=(actor,operation,id,payload)=>JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(actor.id)},${q(operation)},${q(id)},${q(JSON.stringify(payload))}::jsonb);`))
const state=f=>JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(admin.id)},${q(f.parent.id)},${q(month+'-01')});`))
const mk=async(label,n=3,course='kids_group',family=false)=>{const parent=await account('user',tag+label),f=fixture(course,family,parent,date,'16:00','17:00');if(course==='kids_group')sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=${n} WHERE id=${q(f.booking)};COMMIT;`);return f}
const store=(f,actor=admin,version=true)=>{const payload={requestId:randomUUID(),reason:'ผู้เรียนป่วย / ลา'+tag,...(version?{storePolicy:'admin-store-once-v1'}:{})},result=transition(actor,actor===f.parent?'store':'admin_store',f.ids[0],payload);f.credit=result.credit_id;return{payload,result}}
const legacy=f=>{const payload={requestId:randomUUID(),reason:'เดือนนี้ไม่มีวันใช้แล้ว '+tag};const result=JSON.parse(sql(`SELECT admin_makeup_previous_transition_v1(${q(admin.id)},'admin_store',${q(f.ids[0])},${q(JSON.stringify(payload))}::jsonb);`));f.credit=result.credit_id;return payload}
const usePayload=(f,d=target(f,true),requestId=randomUUID())=>({attendingChildId:f.children[0],targetDate:d.date,startTime:d.start,endTime:d.end,branchId:d.branch,templateId:d.template,requestId,reason:'จัดวันตามปกติ'})
const use=(f,p=usePayload(f))=>transition(admin,'makeup',f.ids[0],p)
const full=await mk('เต็ม'),saved=store(full)
check(saved.result.approval?.confirmed&&saved.result.storePolicy==='admin-store-once-v1'&&state(full).eligible&&state(full).remaining===0,'One Store confirms Q0 exact credit without adding quota')
check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(full.ids[0])};`)==='1','Store creates exactly one real credit')
check(JSON.stringify(transition(admin,'admin_store',full.ids[0],saved.payload))===JSON.stringify(saved.result),'Identical Store replay returns durable result')
reject(()=>transition(admin,'admin_store',full.ids[0],{...saved.payload,reason:'เปลี่ยนเหตุผล'}),/IDEMPOTENCY_CONFLICT/,'Store UUID cannot change reason')
const history=JSON.parse(sql(`SELECT admin_makeup_history_v1(${q(admin.id)},${q(month+'-01')},${q(full.parent.id)},'kids_group');`))
check(!history.items.some(e=>e.id.startsWith('approval:'))&&history.items.length===1,'New atomic Store is one history event, with durable separate evidence retained')
check(sql(`SELECT count(*) FROM admin_makeup_credit_decisions WHERE request_id=${q(saved.payload.requestId)};`)==='1','One-click confirmation keeps private decision evidence')
const p=usePayload(full),used=use(full,p)
check(used.useMode==='exception'&&state(full).used===1&&state(full).remaining===0,'Q0 uses exact stored credit once and counts actual usage')
check(use(full,p).data.id===used.data.id,'Completed use replay returns original destination')
reject(()=>use(full,{...p,requestId:randomUUID()}),/CONFLICT|INELIGIBLE/,'New request cannot use same source twice')
const normal=await mk('เหลือ',8);store(normal);const normalUse=use(normal)
check(normalUse.useMode==='normal'&&state(normal).remaining===1&&sql(`SELECT used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(normal.credit)};`)==='normal','Normal quota first closes fallback too')
const old=await mk('เครดิตเก่าจริง');legacy(old)
check(state(old).eligible&&state(old).sources[0].approvalAvailable&&sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(old.credit)};`)==='0','Legacy proven Store is actionable; reads create no grant')
const oldPayload=usePayload(old),bad={...oldPayload,targetDate:date}
reject(()=>use(old,bad),/TARGET_MONTH/,'Invalid destination rejects legacy confirmation and use together')
check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(old.credit)};`)==='0','Failed legacy booking leaves no standalone grant')
check(use(old,oldPayload).useMode==='exception','Legacy exact proof is confirmed and consumed by normal final booking action')
check(sql(`SELECT reason FROM admin_makeup_credit_approvals WHERE credit_id=${q(old.credit)};`).includes('เดือนนี้ไม่มีวันใช้แล้ว'),'Legacy confirmation uses original immutable Store reason')
const parent=await mk('ผู้ปกครอง');store(parent,parent.parent,false)
check(!state(parent).eligible&&!state(parent).sources[0].approvalAvailable,'Parent Store never receives automatic Admin fallback')
reject(()=>use(parent),/INELIGIBLE|REQUIRED/,'Parent credit remains blocked when normal quota is full')
const noProof=await mk('หลักฐานไม่ครบ');legacy(noProof)
sql(`UPDATE activity_logs SET details=details-'reason' WHERE entity_id=${q(noProof.ids[0])} AND action='admin_lesson_assistance';`)
check(!state(noProof).eligible&&!state(noProof).sources[0].approvalAvailable,'Missing immutable proof is not inferred from credit notes')
const stale=await mk('หน้าจอเก่า')
reject(()=>store(stale,admin,false),/STORE_REFRESH_REQUIRED/,'Unversioned new Admin Store fails before mutation')
check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(stale.ids[0])};`)==='0','Stale client creates no credit')
reject(()=>transition(admin,'admin_store',stale.ids[0],{requestId:randomUUID(),reason:'reason',storePolicy:'admin-store-once-v1',approveCredit:false}),/INVALID_REQUEST/,'Client cannot opt out of server-owned Store policy')
const off=await mk('ปิดสิทธิ์',8);sql('UPDATE admin_makeup_credit_control SET enabled=false;')
try{reject(()=>store(off),/APPROVAL_DISABLED/,'Confirmation unavailable rolls back Store even with remaining quota')}finally{sql('UPDATE admin_makeup_credit_control SET enabled=true;')}
check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(off.ids[0])};`)==='0','Atomic confirmation failure leaves no credit or Store audit')
const paused=await mk('หยุดรับ');sql("UPDATE task10_policy_activation SET makeup_enabled=false,state='paused';")
try{reject(()=>store(paused),/PAUSED/,'Paused Kids policy cannot silently downgrade promised Store')}finally{sql("UPDATE task10_policy_activation SET makeup_enabled=true,state='active';")}
const revoke=await mk('ถอนสิทธิ์');store(revoke)
sql(`SELECT admin_makeup_credit_decide_v1(${q(admin.id)},${q(revoke.credit)},'revoke','ยืนยันผิด',${q(randomUUID())},false);`)
check(!state(revoke).eligible&&!state(revoke).sources[0].approvalAvailable,'Revoked credit cannot be automatically reapproved')
reject(()=>use(revoke),/INELIGIBLE|REQUIRED/,'Revoked Q0 credit cannot be used')
const wallet=await mk('ใช้กระเป๋า');store(wallet);const wd=target(wallet,false)
transition(wallet.parent,'redeem',wallet.credit,{targetDate:wd.date,startTime:wd.start,endTime:wd.end,branchId:wd.branch,templateId:wd.template})
check(sql(`SELECT used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(wallet.credit)};`)==='wallet','Parent same-month redemption closes exact fallback')
const reWalletPayload={requestId:randomUUID(),reason:'เก็บซ้ำหลังใช้',storePolicy:'admin-store-once-v1'}
const reWallet=transition(admin,'admin_store',sql(`SELECT redeemed_session_id FROM lesson_wallet_credits WHERE id=${q(wallet.credit)};`),reWalletPayload)
check(!reWallet.approval&&state(wallet).sources.every(s=>!s.approvalAvailable),'Re-wallet preserves credit expiry and never renews fallback')
const race=await mk('แข่งใช้');legacy(race);const rp=usePayload(race)
const outcomes=await Promise.allSettled([concurrentSql(`SELECT lesson_source_transition_v1(${q(admin.id)},'makeup',${q(race.ids[0])},${q(JSON.stringify(rp))}::jsonb);`),concurrentSql(`SELECT lesson_source_transition_v1(${q(admin.id)},'makeup',${q(race.ids[0])},${q(JSON.stringify({...rp,requestId:randomUUID()}))}::jsonb);`)])
check(outcomes.filter(r=>r.status==='fulfilled').length===1&&sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(race.parent.id)};`)==='1','Concurrent legacy grant-and-use produces one winner')
const privateF=await mk('ไพรเวต',1,'private',true),ps=store(privateF)
check(!ps.result.approval&&Number(ps.result.participant_count)===3,'Family Private keeps one whole-unit Store without Kids fallback')
const adult=await mk('ผู้ใหญ่',1,'adult_group'),as=store(adult)
check(!as.result.approval,'Adult Store retains ordinary entitlement without Kids fallback')
// Authorisation is checked at the database entry before source eligibility.
reject(()=>transition(coach,'admin_store',stale.ids[0],{requestId:randomUUID(),reason:'reason',storePolicy:'admin-store-once-v1'}),/UNAUTHORIZED/,'Coach cannot use one-click Admin Store')
for(const role of ['anon','authenticated'])reject(()=>sql(`SET ROLE ${role};SELECT admin_makeup_confirm_stored_source_v9(${q(admin.id)},${q(stale.ids[0])},${q(randomUUID())});`),/permission denied/,'No '+role+' execution of private legacy confirmation')
check(!sql(`SELECT coalesce(jsonb_agg(message)::text,'') FROM notifications WHERE user_id=${q(old.parent.id)};`).includes(tag)&&!sql(`SELECT notes FROM lesson_wallet_credits WHERE id=${q(old.credit)};`).includes(tag),'User Wallet notes and notices contain no internal Store reason')
fs.writeFileSync(path.join(root,'db-'+Date.now()+'.json'),JSON.stringify({passed:true,runId:run.runId,checks,tag,fixtures:{full,normal,old,parent,noProof,stale,off,paused,revoke,wallet,race,privateF,adult}},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:true,checks:checks.length}))
