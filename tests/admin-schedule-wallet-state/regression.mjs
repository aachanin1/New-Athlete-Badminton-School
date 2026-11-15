import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
registerHooks({resolve(s,c,next){return s.startsWith('@/')?{url:pathToFileURL(path.resolve('src',s.slice(2)+'.ts')).href,shortCircuit:true}:next(s,c)}})
const {projectScheduleWalletCredits,readScheduleWalletUses:read}=await import('../../src/lib/admin-schedule-wallet-read.ts')
const project=process.env.SCHEDULE_LEGACY_BASELINE==='1'?credits=>credits:projectScheduleWalletCredits
const {buildAdminScheduleMonthSummary:summary,buildAdminScheduleDayDetail:detail,buildAdminScheduleSearchCandidateResult:search}=await import('../../src/lib/admin-schedules-model.ts')
let passed=0
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const credit=(id,parent='parent')=>({id:'credit-'+id,original_session_id:id,user_id:parent,status:'active'})
const use=(id,extra={})=>({id:'use-'+id,parent_id:'parent',credit_id:'credit-'+id,source_session_id:id,source_root_id:id,...extra})
const origins=[credit('shina'),credit('shino'),credit('unused')]
const used=[use('shina'),use('shino')]
const session=(id,status='walleted')=>({id,date:'2026-11-14',start_time:'13:00',end_time:'15:00',status,is_makeup:status!=='walleted',child_id:id,schedule_slot_id:'slot',branch_id:'branch',branches:{name:'test'},children:{full_name:id,nickname:id},bookings:{user_id:'parent',course_type_id:'kids',status:'verified',course_types:{name:'kids_group'},profiles:{full_name:'Parent'}}})
const sessions=[...origins.map(c=>session(c.original_session_id)),session('destination-shina','completed'),session('destination-shino','completed')]
function totals(credits){return summary({sessions,walletCredits:credits,groups:[]}).totalsByFilter['all:all']}
await check('baseline reproduces spent origins falsely counted as three waiting credits',()=>assert.equal(totals(origins).walletedCount,3))
await check('same-day sibling uses remove two origins and retain destinations plus genuine unused credit',()=>{
 const cs=project(origins,used);assert.equal(totals(cs).walletedCount,1);assert.equal(totals(cs).sessionCount,3)
 const d=detail({sessions,walletCredits:cs,groups:[],slotSessions:[],attendanceRows:[],studentLevels:[],levels:[],teachingPrograms:[]})
 assert.deepEqual(d.sessions.map(s=>s.id).sort(),['destination-shina','destination-shino','unused'])
 const s=search({sessions,walletCredits:cs,startDate:'2026-11-01',endDate:'2026-11-30',limit:200})
 assert.ok(s)
})
await check('each exact evidence key works without date or attending-child assumptions',()=>{
 for(const field of ['credit_id','source_session_id','source_root_id']){
 const u=use('other',{credit_id:null,source_session_id:'else',source_root_id:'else',[field]:field==='credit_id'?'credit-shina':'shina'})
 assert.equal(project([credit('shina')],[u])[0].status,'redeemed')
 }
})
await check('another parent and re-wallet descendant stay visible; statuses and input are immutable',()=>{
 const cs=[credit('shina','other'),credit('rewallet'),{...credit('redeemed'),status:'redeemed'},{...credit('expired'),status:'expired'}],before=JSON.stringify(cs)
 const result=project(cs,used);assert.deepEqual(result,cs);assert.equal(JSON.stringify(cs),before)
})
await check('credit and session IDs are matched in their own evidence fields',()=>{
 assert.equal(project([credit('shina')],[use('other',{credit_id:'shina'})])[0].status,'active')
 assert.equal(project([credit('shina')],[use('other',{source_session_id:'credit-shina',source_root_id:'else'})])[0].status,'active')
})
function fake(pages,error=false){
 const calls=[];return{calls,from(table){assert.equal(table,'task10_family_makeup_uses');let offset;const q={select(v){calls.push({columns:v});return q},in(k,v){assert.equal(k,'parent_id');assert.ok(v.every(x=>x==='parent'));return q},or(v){assert.ok(v.includes('source_root_id.in.'));return q},order(k){assert.equal(k,'id');return q},range(start,end){offset=start;assert.equal(end-start,999);calls.push({offset});return Promise.resolve(error?{error:{message:'unavailable'}}:{data:pages(start,calls)})}};return q}}
}
await check('empty selection makes zero privileged reads',async()=>assert.deepEqual(await read({from(){throw Error('unexpected')}},[]),[]))
await check('ledger failure rejects rather than reporting available credits',async()=>await assert.rejects(read(fake(()=>[],true),origins),/makeup-use query failed/))
await check('reads complete pages and bounded ID chunks',async()=>{
 const db=fake(start=>start===0?Array.from({length:1000},(_,i)=>use('filler-'+i)):used)
 const result=await read(db,origins);assert.equal(result.filter(x=>x.status==='redeemed').length,2);assert.deepEqual(db.calls.filter(c=>'offset'in c).map(c=>c.offset),[0,1000])
 const many=Array.from({length:205},(_,i)=>credit('c'+i)),chunked=fake(()=>[]);await read(chunked,many);assert.equal(chunked.calls.filter(c=>'offset'in c).length,6)
})
console.log(JSON.stringify({passed,customerWrites:0,fixture:'synthetic in-memory; source model and read boundary'}))
