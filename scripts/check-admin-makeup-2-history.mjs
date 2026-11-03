// Owned disposable only. Historical dates are synthetic, never copied customer records.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {sql,q,fixtures,run} from '../tests/admin-makeup-2/runtime.mjs'

const parentDir=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/current-history-local.json')).dir
const output=path.join(parentDir,'db-'+Date.now());fs.mkdirSync(output)
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const read=s=>JSON.parse(sql(s)),checks=[],cases=[]
const check=(label,fn)=>{fn();checks.push(label)}
function clone(f,date,start=f.start,end=f.end){
 const template=randomUUID(),slot=randomUUID(),ids=f.children.map(()=>randomUUID())
 sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';
 INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(date)}),${q(start)},${q(end)},true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(f.branch)},${q(f.course)},${q(date)},${q(start)},${q(end)},'open');
 ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(f.booking)},${q(slot)},${q(date)},${q(start)},${q(end)},${q(f.branch)},${q(f.children[i])},'scheduled',false);`).join('')}COMMIT;`)
 return {...f,date,start,end,template,slot,ids}
}
const month='2026-11-01'
function ledger(c,kind='all',page=1){return read(`BEGIN READ ONLY;SELECT admin_makeup_history_ledger_v3(${q(sa.id)},${q(month)},${q(c.parent.id)},${q(c.courseName)},${q(c.children[0])},${q(kind)},${page},${q(c.reference.ids[0])});COMMIT;`)}
function fingerprint(){
 const tables=['bookings','payments','booking_sessions','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','admin_makeup_grants_v2','admin_makeup_requests_v2','activity_logs','attendance','system_settings']
 return read('SELECT jsonb_build_object('+tables.map(t=>`${q(t)},(SELECT md5(coalesce(string_agg(to_jsonb(r)::text,'' ORDER BY to_jsonb(r)::text),'')) FROM public.${t} r)`).join(',')+');')
}
try{
 for(const kind of ['private_child','private_family','adult_group']){
  const course=kind==='adult_group'?kind:'private',parent=await fixtures.account('user','ประวัติ Local '+kind+' '+Date.now())
  const original=fixtures.fixture(course,kind==='private_family',parent,'2026-09-30','09:00','10:00')
  if(kind==='private_child'){
   const child=randomUUID();sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(parent.id)},'อลิซ (ตัวอย่าง Local)','อลิซ');UPDATE booking_sessions SET child_id=${q(child)} WHERE id=${q(original.ids[0])};COMMIT;`);original.children=[child]
  }
  sql(`BEGIN;SET LOCAL task10.booking_write='authorized';SET LOCAL task10.payment_write='authorized';
   INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from,valid_to)
    SELECT ${q(original.course)},10,10,500,5000,'2026-09-01','2026-09-30' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(original.course)} AND min_sessions=10 AND valid_from<='2026-09-01' AND (valid_to IS NULL OR valid_to>='2026-09-30'));
   UPDATE bookings SET total_sessions=10 WHERE id=${q(original.booking)};UPDATE payments SET verified_at='2026-09-01T09:00:00+07' WHERE booking_id=${q(original.booking)};COMMIT;`)
  const units=[original,...[['10:00','11:00'],['11:00','12:00'],['12:00','13:00'],['14:00','15:00']].map(([start,end])=>clone(original,original.date,start,end))]
  const reference=clone(original,'2026-11-04','16:00','17:00')
  const c={kind,...original,reference,units,stored:[],used:[]};cases.push(c)
  for(const unit of units)c.stored.push(read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_store',${q(unit.ids[0])},${q(JSON.stringify({reason:'ทดสอบประวัติ Local เท่านั้น',requestId:randomUUID(),storePolicy:'admin-store-once-v1'}))});`))
  const template=reference.template
  for(const [i,date] of ['2026-11-11','2026-11-18','2026-11-25','2026-12-02'].entries()){
   if(i===3)check(kind+': before latest use balance is two units',()=>assert.equal(ledger(c).balance.walletQuantity,2))
   const credit=c.stored[i===3?4:i].credit_id
   const sourceId=sql(`SELECT original_session_id FROM lesson_wallet_credits WHERE id=${q(credit)};`)
   c.used.push(read(`SELECT admin_makeup_use_v2(${q(sa.id)},${q(reference.ids[0])},${q(month)},${q(sourceId)},${q(randomUUID())},${q(JSON.stringify({targetDate:date,startTime:'16:00',endTime:'17:00',branchId:c.branch,templateId:template,reason:'ทดสอบประวัติข้ามเดือน Local'}))});`))
  }
  const before=fingerprint(),result=ledger(c),used=ledger(c,'use'),stored=ledger(c,'wallet')
  let old
  try{old=read(`SELECT admin_makeup_history_v1(${q(sa.id)},${q(month)},${q(parent.id)},${q(course)},${q(c.children[0])},'use',1);`)}catch(e){if(kind!=='private_family'||!e.stderr?.includes('TASK10_AMBIGUOUS_SOURCE'))throw e;old={error:'TASK10_AMBIGUOUS_SOURCE'}}
  fs.writeFileSync(path.join(output,kind+'.json'),JSON.stringify({before,result,used,stored,old},null,2))
  check(kind+': original month-scope gap or family ambiguity reproduced',()=>assert.ok(old.error==='TASK10_AMBIGUOUS_SOURCE'||!old.items.some(e=>e.destination?.date==='2026-12-02')))
  check(kind+': separate remaining quantity is one, including family',()=>{assert.equal(result.balance.walletQuantity,1);assert.equal(result.balance.walletSourceCount,1);assert.equal(result.balance.sources[0].startTime.slice(0,5),'12:00')})
  check(kind+': all months contain four Wallet uses including December',()=>{assert.equal(used.total,4);assert.equal(used.items[0].destination.date,'2026-12-02');assert.equal(used.items[0].source.date,'2026-09-30');assert.equal(used.items[0].walletQuantity,1);assert.equal(result.counts.wallet,5);assert.equal(stored.items.filter(e=>e.destination).length,4)})
  check(kind+': used and stored are events, never subtracted to derive balance',()=>{assert.equal(result.historyScope,'all_months');assert.equal(result.total,9);assert.equal(result.counts.use,4);assert.equal(result.balance.walletQuantity,1)})
  check(kind+': history reads preserve full-row business/money hashes',()=>assert.deepEqual(fingerprint(),before))
  if(kind==='private_family'){
   check('Private family Wallet hour counts once for three people',()=>{assert.equal(used.items[0].participants.length,3);assert.equal(result.balance.unit,'ชั่วโมง');assert.equal(used.items[0].walletQuantity,1)})
   const other=clone({...original,children:[original.children[1]]},'2026-11-05','08:00','09:00')
   const otherResult=ledger({...c,children:other.children,reference:other})
   check('Private exact roster isolates all history and remaining balance',()=>{assert.equal(otherResult.total,0);assert.equal(otherResult.balance.walletQuantity,0)})
  }
 }
 fs.writeFileSync(path.join(output,'fixtures.private.json'),JSON.stringify(cases,null,2))
 fs.writeFileSync(path.join(parentDir,'fixtures-current.json'),JSON.stringify({file:path.join(output,'fixtures.private.json')},null,2))
 const demo=cases[0]
 // Create >20 independent events in another account, never pad the Owner's review example.
 const parent=await fixtures.account('user','แบ่งหน้าประวัติ Local '+Date.now())
 const base=fixtures.fixture('adult_group',false,parent,'2026-11-03','04:00','05:00')
 for(let i=1;i<=23;i++)clone(base,`2026-10-${String(i).padStart(2,'0')}`)
 sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';UPDATE booking_sessions SET cancelled_at=clock_timestamp() WHERE booking_id=${q(base.booking)} AND id<>${q(base.ids[0])};COMMIT;`)
 const paginated={...base,reference:base},before=fingerprint(),page1=ledger(paginated,'use',1),page2=ledger(paginated,'use',2),empty=ledger(paginated,'wallet',1)
 check('23 cross-month events paginate 20+3 without duplicates',()=>{assert.equal(page1.total,23);assert.equal(page1.items.length,20);assert.equal(page2.items.length,3);assert.equal(new Set([...page1.items,...page2.items].map(e=>e.id)).size,23);assert.equal(empty.total,0);assert.equal(empty.items.length,0)})
 check('pagination/filter reads preserve data',()=>assert.deepEqual(fingerprint(),before))
 const kidsParent=await fixtures.account('user','เด็กกลุ่มประวัติ Local '+Date.now()),kids=fixtures.fixture('kids_group',false,kidsParent,'2026-11-04','07:00','08:00')
 const kidsState=read(`SELECT task10_family_makeup_state_v1(${q(sa.id)},${q(kidsParent.id)},${q(month)});`),kidsResult=ledger({...kids,reference:kids,children:[null]})
 check('Kids monthly quota/rules unchanged and distinct from all-month history',()=>{assert.deepEqual(kidsResult.summary,kidsState);assert.equal(kidsResult.historyScope,'all_months');assert.equal(kidsResult.balance.walletQuantity,0)})
 check('unprivileged roles cannot execute privileged read RPC',()=>assert.deepEqual(read("SELECT jsonb_build_object('anon',has_function_privilege('anon','public.admin_makeup_history_ledger_v3(uuid,date,uuid,text,uuid,text,integer,uuid)','execute'),'user',has_function_privilege('authenticated','public.admin_makeup_history_ledger_v3(uuid,date,uuid,text,uuid,text,integer,uuid)','execute'));"),{anon:false,user:false}))
 const beforeFunctions=JSON.parse(fs.readFileSync(path.join(parentDir,'functions-before.json')))
 const afterFunctions=read("SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('definition',md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n')),'acl',p.proacl::text,'securityDefiner',p.prosecdef)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';")
  check('all existing functions and ACLs unchanged; two Admin-only readers added',()=>{for(const [key,value]of Object.entries(beforeFunctions))assert.deepEqual(afterFunctions[key],value,key);assert.equal(Object.keys(afterFunctions).length,Object.keys(beforeFunctions).length+2)})
 const result={passed:true,checks,runId:run.runId,output,reviewParent:demo.parent.id,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,cases,error:e.stack,stderr:e.stderr},null,2));console.error(output);console.error(e.stderr||e);process.exitCode=1}
