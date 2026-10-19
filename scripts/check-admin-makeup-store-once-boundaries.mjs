import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,concurrentSql,holdTransaction,observeLockWait,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9'),base=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),checks=[],tag='ขอบเขตเก็บเดียว'+randomUUID().slice(0,5)
const {admin,sa,coach}=base,{account,fixture,target}=fixtures
const check=(v,name)=>{assert.ok(v,name);checks.push(name);console.log(name)}
const reject=(fn,re,name)=>{assert.throws(fn,re);checks.push(name);console.log(name)}
const date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3);"),month=date.slice(0,7)
const state=f=>JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(admin.id)},${q(f.parent.id)},${q(month+'-01')});`))
const mk=async(name,n=3)=>{const parent=await account('user',tag+name),f=fixture('kids_group',false,parent,date,'16:00','17:00');sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=${n} WHERE id=${q(f.booking)};COMMIT;`);return f}
const store=(f,approve=true)=>{const result=JSON.parse(sql(`SELECT ${approve?'lesson_source_transition_v1':'admin_makeup_previous_transition_v1'}(${q(admin.id)},'admin_store',${q(f.ids[0])},${q(JSON.stringify({requestId:randomUUID(),reason:'อนุมัติต้นทางจริง',...(approve?{storePolicy:'admin-store-once-v1'}:{})}))}::jsonb);`));f.credit=result.credit_id;return result}
const request=(f,dst=target(f,true))=>({attendingChildId:f.children[0],targetDate:dst.date,startTime:dst.start,endTime:dst.end,branchId:dst.branch,templateId:dst.template,requestId:randomUUID(),reason:'ตรวจขอบเขตการใช้'})
const useSql=(f,p)=>`SELECT lesson_source_transition_v1(${q(admin.id)},'makeup',${q(f.ids[0])},${q(JSON.stringify(p))}::jsonb);`
const revokeSql=f=>`SELECT admin_makeup_credit_decide_v1(${q(admin.id)},${q(f.credit)},'revoke','เพิกถอนก่อนใช้',${q(randomUUID())},false);`
// Verify explicit financial invariants without relying on UI success alone.
const financialBefore=sql("SELECT jsonb_build_object('payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM payments x),'couponUsage',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM coupon_usages x),'pricing',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM pricing_tiers x))::text;")
const race=await mk('สองผู้ใช้');store(race);const rp=request(race)
const outcomes=await Promise.allSettled([concurrentSql(useSql(race,rp)),concurrentSql(useSql(race,{...rp,requestId:randomUUID()}))])
check(outcomes.filter(r=>r.status==='fulfilled').length===1&&sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(race.parent.id)};`)==='1','Two concurrent uses of one source have one winner and one use row')
const same=await mk('คำขอเดียวกัน');store(same);const sp=request(same),sameResults=await Promise.all([concurrentSql(useSql(same,sp)),concurrentSql(useSql(same,sp))])
check(JSON.parse(sameResults[0]).data.id===JSON.parse(sameResults[1]).data.id&&sql(`SELECT count(*) FROM notifications WHERE user_id=${q(same.parent.id)} AND title='ได้รับวันชดเชยแล้ว';`)==='1','Concurrent identical replay produces one destination and one User notice')
const revokeFirst=await mk('เพิกถอนชนะ');store(revokeFirst);const revokePayload=request(revokeFirst)
const revoker=await holdTransaction(revokeSql(revokeFirst),'credit-revoke-first')
const blockedUse=concurrentSql("SET application_name='credit-use-after-revoke';"+useSql(revokeFirst,revokePayload));void blockedUse.catch(()=>{})
await observeLockWait('credit-use-after-revoke');revoker.release();await revoker.done
await assert.rejects(blockedUse,/CONFLICT|INELIGIBLE|REQUIRED/);checks.push('Held revoke blocks concurrent consume; consume fails after committed revocation')
const useFirst=await mk('ใช้ชนะ');store(useFirst);const usePayload=request(useFirst)
const consumer=await holdTransaction(useSql(useFirst,usePayload),'credit-use-first')
const blockedRevoke=concurrentSql("SET application_name='credit-revoke-after-use';"+revokeSql(useFirst));void blockedRevoke.catch(()=>{})
await observeLockWait('credit-revoke-after-use');consumer.release();await consumer.done
await assert.rejects(blockedRevoke,/APPROVAL_CONFLICT/);checks.push('Held consume blocks concurrent revoke; consumed grant cannot be revoked')
const redeemFirst=await mk('กระเป๋าชนะ');store(redeemFirst);const redeemDst=target(redeemFirst,false,1),redeemPayload=request(redeemFirst)
const redeem=await holdTransaction(`SELECT lesson_source_transition_v1(${q(redeemFirst.parent.id)},'redeem',${q(redeemFirst.credit)},${q(JSON.stringify({targetDate:redeemDst.date,startTime:redeemDst.start,endTime:redeemDst.end,branchId:redeemDst.branch,templateId:redeemDst.template}))}::jsonb);`,'credit-wallet-first')
const blockedMakeup=concurrentSql("SET application_name='credit-makeup-after-wallet';"+useSql(redeemFirst,redeemPayload));void blockedMakeup.catch(()=>{})
await observeLockWait('credit-makeup-after-wallet');redeem.release();await redeem.done
await assert.rejects(blockedMakeup,/LESSON_SOURCE_ALREADY_USED|TASK10_SOURCE_CONFLICT|TASK10_MAKEUP_INELIGIBLE/);check(sql(`SELECT used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(redeemFirst.credit)};`)==='wallet','Parent redemption and Admin consume serialize on the existing family lock')
const redeemedSession=sql(`SELECT redeemed_session_id FROM lesson_wallet_credits WHERE id=${q(redeemFirst.credit)};`)
const rewallet=JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(redeemFirst.parent.id)},'store',${q(redeemedSession)},'{}'::jsonb);`))
reject(()=>sql(`SELECT admin_makeup_credit_decide_v1(${q(admin.id)},${q(rewallet.credit_id)},'approve','ห้ามฟื้นการอนุมัติ',${q(randomUUID())},false);`),/APPROVAL_CONFLICT/,'Re-wallet descendant cannot revive a closed source approval')
const fresh=await mk('ยอดล่าสุด');store(fresh)
sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=8 WHERE id=${q(fresh.booking)};COMMIT;`)
check(JSON.parse(sql(useSql(fresh,request(fresh)))).useMode==='normal','Latest quota wins after approval; a later verified quantity uses ordinary quota first')
const identity=await mk('ตัวตน');store(identity);const identityPayload=request(identity),other=await mk('ครอบครัวอื่น')
reject(()=>sql(useSql(identity,{...identityPayload,attendingChildId:other.children[0]})),/CHILD_NOT_IN_FAMILY/,'Approval cannot change the attending child to another family')
const started={...identityPayload,targetDate:date,startTime:'00:00',endTime:'01:00'}
reject(()=>sql(useSql(identity,started)),/TARGET_MONTH/,'Approval cannot widen the allowed destination month')
sql(`SELECT branch_date_closure_set_v1(${q(sa.id)},${q(identityPayload.branchId)},${q(identityPayload.targetDate)},true,'ปิดทดสอบ',${q(randomUUID())});`)
reject(()=>sql(useSql(identity,identityPayload)),/BRANCH_DATE_CLOSED/,'Branch date closure still blocks exceptional use')
sql(`SELECT branch_date_closure_set_v1(${q(sa.id)},${q(identityPayload.branchId)},${q(identityPayload.targetDate)},false,'เปิดหลังทดสอบ',${q(randomUUID())});`)
const menuBefore=sql("SELECT value FROM system_settings WHERE key='admin_menu_permissions';")
sql("UPDATE system_settings SET value='{\"adminAllowedMenuKeys\":[]}' WHERE key='admin_menu_permissions';")
try{reject(()=>sql(useSql(identity,identityPayload)),/UNAUTHORIZED/,'Removing Makeup permission blocks a previously approved consume')}finally{sql(`UPDATE system_settings SET value=${q(menuBefore)}::jsonb WHERE key='admin_menu_permissions';`)}
const clock=sql("SELECT pg_get_functiondef('public.task10_clock_v1()'::regprocedure);")
const expiry=state(identity).expiresAt
try{
 sql(`CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=public,pg_temp AS $$ SELECT ${q(expiry)}::timestamptz $$;`)
 check(state(identity).reason==='expired'&&!state(identity).eligible,'Exact Bangkok end-of-next-month boundary blocks approved source')
 reject(()=>sql(useSql(identity,identityPayload)),/INELIGIBLE|TARGET_STARTED/,'Expired approval cannot consume or extend a source')
}finally{sql(clock)}
check(sql("SELECT pg_get_functiondef('public.task10_clock_v1()'::regprocedure);")===clock,'Clock restored exactly after isolated boundary test')
const ageing=await mk('กระเป๋าหมดเดือนแต่ต้นทางยังใช้ได้');store(ageing,false)
const storedExpiry=sql(`SELECT expires_at FROM lesson_wallet_credits WHERE id=${q(ageing.credit)};`),ageTarget=target(ageing,true)
const nextStart=sql(`SELECT (${q(month+'-01')}::date+interval '1 month') AT TIME ZONE 'Asia/Bangkok';`)
try{
 sql(`CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=public,pg_temp AS $$ SELECT ${q(nextStart)}::timestamptz $$;
 BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE lesson_wallet_credits SET status='expired',expired_at=${q(nextStart)} WHERE id=${q(ageing.credit)};COMMIT;`)
 const approval=JSON.parse(sql(`SELECT admin_makeup_credit_decide_v1(${q(admin.id)},${q(ageing.credit)},'approve','ยืนยันต้นทางที่ยังอยู่ในอายุชดเชย',${q(randomUUID())},false);`))
 check(approval.confirmed&&state(ageing).eligible,'Normally expired Wallet still supports explicit Admin approval within its separate next-month source validity')
 const used=JSON.parse(sql(useSql(ageing,request(ageing,ageTarget))))
 check(used.useMode==='exception'&&state(ageing).remaining===0,'Admin can consume that genuinely valid next-month source once with Q0')
 check(sql(`SELECT expires_at FROM lesson_wallet_credits WHERE id=${q(ageing.credit)};`)===storedExpiry&&sql(`SELECT status FROM lesson_wallet_credits WHERE id=${q(ageing.credit)};`)==='expired','Exceptional use neither revives nor extends the ordinary Wallet credit')
}finally{sql(clock)}
check(sql("SELECT pg_get_functiondef('public.task10_clock_v1()'::regprocedure);")===clock,'Clock restored exactly after ordinary-expiry separation test')
const atomic=await mk('หยุดตอนเก็บ');sql("UPDATE task10_policy_activation SET makeup_enabled=false,state='paused';")
try{
 reject(()=>store(atomic),/MAKEUP_PAUSED/,'Store+approval rejection rolls the complete transaction back')
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(atomic.ids[0])};`)==='0'&&sql(`SELECT status FROM booking_sessions WHERE id=${q(atomic.ids[0])};`)==='scheduled','Rejected atomic request leaves original lesson and wallet unchanged')
}finally{sql("UPDATE task10_policy_activation SET makeup_enabled=true,state='active';")}
for(const role of ['anon','authenticated'])for(const table of ['admin_makeup_store_requests','admin_makeup_credit_intents'])reject(()=>sql(`SET ROLE ${role};SELECT * FROM ${table};`),/permission denied/,role+' cannot read private '+table)
const after=sql("SELECT jsonb_build_object('payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM payments x),'couponUsage',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM coupon_usages x),'pricing',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM pricing_tiers x))::text;")
check(financialBefore===after,'Approval/use/revoke and races leave Payments, coupon use and pricing content unchanged')
fs.writeFileSync(path.join(root,'boundaries-'+Date.now()+'.json'),JSON.stringify({passed:true,checks,runId:run.runId,clockRestored:true,financialBefore,financialAfter:after},null,2),{flag:'wx'});console.log(JSON.stringify({passed:true,checks:checks.length}))
