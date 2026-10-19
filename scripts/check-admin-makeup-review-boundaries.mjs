import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const base='http://127.0.0.1:3145',root=path.join(run.outputDir,'boundaries-'+Date.now());fs.mkdirSync(root)
const checks=[],check=(v,n)=>{assert.ok(v,n);checks.push(n)},owned=await adminBrowser(base),admin=await adminBrowser(base,f.admin)
const original=sql("SELECT value::text FROM system_settings WHERE key='admin_menu_permissions'")
let menuChanged=false
try{
 const queue=extra=>base+'/api/admin/makeup/queue?'+new URLSearchParams({month:f.month,...extra})
 check((await admin.context.request.get(queue({}))).status()===200,'Admin with the Makeup menu can read Review')
 sql(`UPDATE system_settings SET value='{"adminAllowedMenuKeys":[]}'::jsonb WHERE key='admin_menu_permissions'`);menuChanged=true
 check((await admin.context.request.get(queue({}))).status()===403,'Admin without the Makeup menu cannot read Review')
 check((await admin.context.request.post(base+'/api/admin/makeup/review-request',{data:{anchor:f.rounds[0].ids[0],group:'fixture',members:f.rounds[0].ids,action:'request_coach_review',requestId:randomUUID()}})).status()===403,'Admin without the Makeup menu cannot request review')
 sql(`UPDATE system_settings SET value=${q(original)}::jsonb WHERE key='admin_menu_permissions'`);menuChanged=false
 for(const params of [{scope:'bad'},{session:'bad'},{date:'2026-02-30'},{status:'actionable'},{pageSize:'100'},{month:'2026-13'},{course:'bad'}])check((await owned.context.request.get(queue(params))).status()===400,'Malformed Review filter rejected: '+Object.keys(params)[0])
 const checkpoint=path.join(run.evidenceRoot,'boundaries-fixture.json');let stress
 if(fs.existsSync(checkpoint))stress=JSON.parse(fs.readFileSync(checkpoint))
 else{
 const label='ขอบเขต 1205 '+randomUUID().slice(0,6),round=fixtures.fixture('kids_group',false,f.parent,f.past,'17:00','18:00'),group=randomUUID()
 const rows=Array.from({length:1205},(_,i)=>({id:i?randomUUID():round.ids[0],child:i?randomUUID():round.children[0],name:`ผู้เรียน ${label} ${String(i+1).padStart(4,'0')}`}))
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 UPDATE branches SET name=${q(label)} WHERE id=${q(round.branch)};
 UPDATE children SET full_name=${q(rows[0].name)},nickname=${q(rows[0].name)} WHERE id=${q(rows[0].child)};
 INSERT INTO children(id,parent_id,full_name,nickname) VALUES ${rows.slice(1).map(r=>`(${q(r.child)},${q(f.parent.id)},${q(r.name)},${q(r.name)})`).join(',')};
 INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES ${rows.slice(1).map(r=>`(${q(r.id)},${q(round.booking)},${q(round.slot)},${q(f.past)},'17:00','18:00',${q(round.branch)},${q(r.child)},'scheduled',false)`).join(',')};
 INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(round.slot)},${q(f.coach.id)},${q(label)},${q(f.sa.id)});
 INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES ${rows.map(r=>`(${q(group)},${q(r.id)},${q(r.child)},'child')`).join(',')};COMMIT;`)
 stress={round,group,label,rows};fs.writeFileSync(checkpoint,JSON.stringify(stress,null,2),{flag:'wx'})
 }
 const {round,group,label,rows}=stress
 const response=await owned.context.request.get(queue({search:rows[0].name}));check(response.status()===200,'Single HTTP read accepts the over-one-thousand member round')
 const current=await response.json();check(current.total===1&&current.sessionTotal===1205&&current.groups[0].count===1205&&current.sessions.length===1205&&new Set(current.sessions.map(r=>r.id)).size===1205,'Single-name search returns all 1205 distinct members and exact counters')
 const baseline=await adminBrowser('http://127.0.0.1:3144')
 try{
  const old=await baseline.context.request.get('http://127.0.0.1:3144/api/admin/makeup/queue?'+new URLSearchParams({month:f.month,search:rows[0].name,group:current.groups[0].key}));check(old.status()===200,'Original v9 reader handles the same populated boundary fixture')
  const previous=await old.json(),byId=new Map(current.sessions.map(r=>[r.id,r]));for(const member of previous.sessions)assert.deepEqual(byId.get(member.id),member,member.id)
  checks.push(`Every field of the ${previous.sessions.length} members returned by the original reader matches`)
  fs.writeFileSync(path.join(root,'baseline-boundary.json'),JSON.stringify({total:previous.total,sessionTotal:previous.sessionTotal,returned:previous.sessions.length,currentReturned:current.sessions.length,diagnosis:'Original embedded group-member query has a 1000-row relation cap; new relational RPC must be checked against authoritative DB membership rather than preserve that omission'},null,2))
 }finally{await baseline.browser.close()}
 const authoritative=JSON.parse(sql(`SELECT jsonb_agg(booking_session_id ORDER BY booking_session_id) FROM coach_assignment_group_students WHERE group_id=${q(group)}`));assert.deepEqual([...current.sessions.map(r=>r.id)].sort(),authoritative);checks.push('All 1205 new-reader identities equal authoritative DB group membership, including members omitted by the original reader')
 const scope=await owned.context.request.get(queue({scope:round.ids[0]}));const scoped=await scope.json();check(scope.status()===200&&scoped.sessions.length===1205&&scoped.scopeSessionIds.length===1205,'Affected-scope reconciliation also returns all 1205 members')
 const output={runId:run.runId,root,checks,fixture:{...round,group,label,rows},scope:'Synthetic owned Local only; stress fixture added after paired timing runs, no send or business action on this round'}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(output,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'boundaries-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({passed:checks.length,root}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks},null,2));throw error}
finally{if(menuChanged)sql(`UPDATE system_settings SET value=${q(original)}::jsonb WHERE key='admin_menu_permissions'`);await admin.browser.close();await owned.browser.close()}
