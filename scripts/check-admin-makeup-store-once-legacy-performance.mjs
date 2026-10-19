// Matched PostgreSQL probes. Every schema/Store/grant/use probe rolls back;
// v8's final use begins after its separate approval, a conservative comparison.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9'),record=JSON.parse(fs.readFileSync(root+'/compatibility.json')),base=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),defs=JSON.parse(fs.readFileSync(root+'/baseline-functions.json'))
const label=process.argv[2]||'initial';assert.match(label,/^[a-z0-9-]+$/)
const source=record.payload.session_id,actor=base.admin.id
const s=JSON.parse(sql(`SELECT row_to_json(x) FROM (SELECT s.id,s.child_id,s.branch_id,b.id AS booking,b.user_id,b.course_type_id,date_trunc('month',s.date)::date AS month,(date_trunc('month',s.date)+interval '1 month 10 days')::date AS target FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE s.id=${q(source)}) x;`))
const names=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1'],old=Object.entries(defs).filter(([k])=>names.includes(k.split('(')[0])).map(([,body])=>body+';').join('\n')
const samples={before:{read:[],use:[]},after:{read:[],use:[]}}
for(const mode of ['before','after'])for(const kind of ['read','use'])for(let i=0;i<20;i++){
 const request=randomUUID(),template=randomUUID(),reason='เหตุผลเก็บที่มีหลักฐานจริง'
 const rollbackSchema=mode==='before'?old+"\nUPDATE admin_makeup_credit_control SET store_once_enabled=false,writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));":''
 const seed=`DO $seed$ DECLARE v jsonb;BEGIN
  v:=public.admin_makeup_previous_transition_v1(${q(actor)},'admin_store',${q(source)},${q(JSON.stringify({requestId:randomUUID(),reason}))}::jsonb);
  ${kind==='use'&&mode==='before'?`PERFORM public.admin_makeup_credit_decide_v1(${q(actor)},(v->>'credit_id')::uuid,'approve',${q(reason)},${q(randomUUID())},false);`:''}
  ${kind==='use'?`INSERT INTO public.schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(s.branch_id)},${q(s.course_type_id)},extract(dow FROM date ${q(s.target)}),'20:15','21:15',true);`:''}
 END $seed$;`
 const payload={requestId:request,reason:'ยืนยันจัดวันตามปกติ',attendingChildId:s.child_id,branchId:s.branch_id,templateId:template,targetDate:s.target,startTime:'20:15',endTime:'21:15'}
 const query=kind==='read'?`SELECT public.task10_family_makeup_state_v1(${q(actor)},${q(s.user_id)},${q(s.month)});`:`SELECT public.lesson_source_transition_v1(${q(actor)},'makeup',${q(source)},${q(JSON.stringify(payload))}::jsonb);`
 const result=JSON.parse(sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+rollbackSchema+'\n'+seed+'\nEXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) '+query+'ROLLBACK;'))
 samples[mode][kind].push({ms:result[0]['Execution Time'],plan:i===0?result:undefined})
}
const percentile=(rows,p)=>rows.map(r=>r.ms).sort((a,b)=>a-b)[Math.ceil(rows.length*p)-1]
const summary=Object.fromEntries(['read','use'].map(kind=>{const before=percentile(samples.before[kind],.95),after=percentile(samples.after[kind],.95),delta=after-before,gate=Math.max(50,before*.1);assert.ok(delta<=gate,kind+' legacy performance');return[kind,{beforeP95:before,afterP95:after,deltaP95:delta,gateMs:gate,passed:true}]}))
for(const [table,value]of Object.entries(record.before))assert.deepEqual(JSON.parse(sql(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`)),value)
fs.writeFileSync(root+(label==='initial'?'/legacy-performance.json':'/legacy-performance-'+label+'.json'),JSON.stringify({passed:true,label,runId:run.runId,source,samples,summary,sampleCount:20,scope:'Same exact source and snapshot; transaction-local v8 definitions roll back; v8 use pre-approved, v9 final use includes legacy confirmation; SQL timings only; all fifteen fingerprints preserved'},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:true,summary}))
