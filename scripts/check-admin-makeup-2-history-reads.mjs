import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,env,fixtures,run} from '../tests/admin-makeup-2/runtime.mjs'
const dir=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/current-history-local.json')).dir
const output=path.join(dir,'reads-'+Date.now());fs.mkdirSync(output)
const cases=JSON.parse(fs.readFileSync(JSON.parse(fs.readFileSync(dir+'/fixtures-current.json')).file))
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const runtime=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/app-runtime.json'))
assert.equal(runtime.port,3183);assert.equal(runtime.api,env.apiUrl)
const binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/booking-ux-1-local-build.json')))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,env.apiUrl)
const read=s=>JSON.parse(sql(s)),checks=[]
const check=(name,fn)=>{fn();checks.push(name)}
async function cookie(account){
 const values=new Map(),client=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...values].map(([name,value])=>({name,value})),setAll:entries=>entries.forEach(e=>values.set(e.name,e.value))}})
 assert.ifError((await client.auth.signInWithPassword({email:account.email,password:fixtures.password})).error)
 return [...values].map(([k,v])=>k+'='+v).join('; ')
}
const base='http://127.0.0.1:3183'
function url(c,changes={}){const p=new URLSearchParams({parent:c.parent.id,reference:c.reference.ids[0],month:'2026-11',course:c.courseName,kind:'use',page:'1',...changes});if(c.children[0])p.set('child',c.children[0]);return base+'/api/admin/makeup/history?'+p}
try{
 const adminCookie=await cookie(sa)
 for(const c of cases){
  const response=await fetch(url(c),{headers:{cookie:adminCookie}}),data=await response.json()
  fs.writeFileSync(path.join(output,c.kind+'.json'),JSON.stringify({status:response.status,cache:response.headers.get('cache-control'),data},null,2))
  check(c.kind+': authenticated API shows same current balance and December use',()=>{assert.equal(response.status,200);assert.equal(data.balance.walletQuantity,1);assert.ok(data.items.some(e=>e.destination?.date==='2026-12-02'&&e.walletQuantity===1));assert.equal(data.items[0].learner.includes('ไม่ระบุ'),false);assert.match(response.headers.get('cache-control'),/no-store/)})
 }
 const anon=await fetch(url(cases[0])),ordinary=await fetch(url(cases[0]),{headers:{cookie:await cookie(cases[0].parent)}})
 check('anonymous and ordinary User cannot read Admin history API',()=>{assert.ok([401,403].includes(anon.status));assert.ok([401,403].includes(ordinary.status))})
 for(const changes of [{reference:'bad'},{month:'2026-13'},{page:'0'},{course:'other'}]){
  const r=await fetch(url(cases[0],changes),{headers:{cookie:adminCookie}});check('invalid API request '+JSON.stringify(changes),()=>assert.equal(r.status,400))
 }
 const forged=await fetch(url(cases[0],{reference:cases[1].reference.ids[0]}),{headers:{cookie:adminCookie}})
 check('mismatched parent/reference rejected, never shown as zero',()=>assert.equal(forged.status,503))
 const kids=read("SELECT jsonb_build_object('parent',p.id,'reference',x.id) FROM profiles p JOIN bookings b ON b.user_id=p.id JOIN course_types c ON c.id=b.course_type_id JOIN booking_sessions x ON x.booking_id=b.id WHERE p.full_name LIKE 'เด็กกลุ่มประวัติ Local %' AND c.name::text='kids_group' AND NOT x.is_makeup ORDER BY p.created_at DESC LIMIT 1;")
 const kidsCall=`admin_makeup_history_ledger_v3(${q(sa.id)},'2026-11-01',${q(kids.parent)},'kids_group',NULL,'all',1,${q(kids.reference)})`
 const paused=read(`BEGIN;UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;SELECT ${kidsCall};ROLLBACK;`)
 check('Kids history remains available when policy paused, balance unknown rather than zero',()=>{assert.equal(paused.historyScope,'all_months');assert.equal(paused.balance,null)})
 const person=await fixtures.account('user','Local Two-hour Private history')
 const two=fixtures.fixture('private',true,person,'2026-09-30','18:00','20:00')
 sql(`BEGIN;SET LOCAL task10.booking_write='authorized';SET LOCAL task10.payment_write='authorized';UPDATE bookings SET total_sessions=10 WHERE id=${q(two.booking)};UPDATE payments SET verified_at='2026-09-01T09:00:00+07' WHERE booking_id=${q(two.booking)};COMMIT;`)
 const stored=read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_store',${q(two.ids[0])},${q(JSON.stringify({reason:'Local ทดสอบหน่วยสองชั่วโมง',requestId:crypto.randomUUID(),storePolicy:'admin-store-once-v1'}))});`)
 const twoRead=read(`BEGIN READ ONLY;SELECT admin_makeup_history_ledger_v3(${q(sa.id)},'2026-09-01',${q(person.id)},'private',NULL,'all',1,${q(two.ids[0])});COMMIT;`)
 check('two-hour Private family credit is two hours, one source, three participants',()=>{assert.equal(twoRead.balance.walletQuantity,2);assert.equal(twoRead.balance.walletSourceCount,1);assert.equal(twoRead.items[0].participants.length,3);assert.equal(twoRead.balance.sources[0].quantity,2);assert.ok(stored.credit_id)})
 const adult=cases.find(c=>c.kind==='adult_group'),reference=adult.reference.ids[0]
 if(sql(`SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=${q(reference)} AND NOT is_makeup;`)==='0'){
  const target=fixtures.target(adult.reference,false,2)
  read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_reschedule',${q(reference)},${q(JSON.stringify({targetDate:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,templateId:target.template,reason:'Local ทดสอบย้ายวันไม่ใช้กระเป๋า',requestId:crypto.randomUUID()}))});`)
 }
 const moves=read(`BEGIN READ ONLY;SELECT admin_makeup_history_ledger_v3(${q(sa.id)},'2026-11-01',${q(adult.parent.id)},'adult_group',NULL,'use',1,${q(reference)});COMMIT;`)
 check('ordinary move adds a history event without using Wallet or changing balance',()=>{assert.equal(moves.balance.walletQuantity,1);assert.equal(moves.counts.use,5);assert.equal(moves.items.filter(e=>e.walletQuantity===1).length,4);assert.ok(moves.items.some(e=>e.id.startsWith('move:')&&e.walletQuantity===null&&e.destination.date==='2026-11-06'))})
 const result={passed:true,checks,binding,runId:run.runId,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr},null,2));console.error(e.stderr||e);process.exitCode=1}
