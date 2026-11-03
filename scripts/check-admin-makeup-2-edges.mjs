import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/admin-makeup-2/runtime.mjs'
const root=path.join(run.outputDir,'edges-'+Date.now());fs.mkdirSync(root,{recursive:true});const checks=[]
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json')),parent=await fixtures.account('user','AM2 Edges '+Date.now()),sameName=await fixtures.account('user','AM2 Edges '+Date.now())
sql(`UPDATE profiles SET full_name=(SELECT full_name FROM profiles WHERE id=${q(parent.id)}) WHERE id=${q(sameName.id)};`)
const f=fixtures.fixture('adult_group',false,parent),t=fixtures.target(f,false,18),month=f.date.slice(0,7)+'-01',read=s=>JSON.parse(sql(s))
const statement=(target=t,request=randomUUID(),reference=f.ids[0])=>`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(reference)},${q(month)},NULL,${q(target.template)},${q(target.date)},${q(request)},'AM2 edge test');`
const reject=(s,re,label)=>{assert.throws(()=>sql(s),e=>re.test(e.stderr||e.message));checks.push(label)}
try{
 reject(statement(t,randomUUID(),randomUUID()),/SOURCE_CONFLICT/,'no fabricated purchase reference')
 for(const status of ['pending_payment','cancelled'])reject(`BEGIN;SET LOCAL task10.booking_write='authorized';SET LOCAL task10.payment_write='authorized';UPDATE bookings SET status=${q(status)} WHERE id=${q(f.booking)};${statement()}ROLLBACK;`,/SOURCE_CONFLICT/,'no '+status+' purchase reference')
 const privateTemplate=fixtures.fixture('private',false,sameName),wrong=fixtures.target(privateTemplate,false,18)
 reject(statement(wrong),/INVALID_TEMPLATE/,'cannot use another course without its purchase reference')
 const closure=randomUUID();sql(`INSERT INTO branch_date_closures(id,branch_id,closure_date,reason,created_by,updated_by) VALUES(${q(closure)},${q(t.branch)},${q(t.date)},'AM2 edge closure',${q(sa.id)},${q(sa.id)});`)
 reject(statement(),/CLOSED/,'closed branch round rejected')
 sql(`UPDATE branch_date_closures SET is_active=false WHERE id=${q(closure)};`)
 const past=sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-1;"),pastTemplate=randomUUID();sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(pastTemplate)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(past)}),'10:00','11:00',true);`)
 reject(statement({...t,template:pastTemplate,date:past}),/TARGET_STARTED/,'started round rejected')
 fixtures.fixture('private',false,parent,t.date,'10:30','11:30')
 reject(statement(),/LEARNER_OVERLAP/,'partial overlap across course and branch rejected')
 const adjacentTemplate=randomUUID();sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(adjacentTemplate)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(t.date)}),'11:30','12:30',true);`)
 const adjacent={...t,template:adjacentTemplate},request=randomUUID(),created=read(statement(adjacent,request));assert.equal(created.success,true);checks.push('adjacent periods remain available')
 const g=fixtures.fixture('adult_group',false,sameName),sameTarget={...t,template:t.template};assert.equal(read(`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(g.ids[0])},${q(month)},NULL,${q(sameTarget.template)},${q(sameTarget.date)},${q(randomUUID())},'AM2 same display name');`).success,true);checks.push('same display name with another learner ID is not blocked')
 const before=read(`SELECT admin_makeup_context_v2(${q(sa.id)},${q(f.ids[0])},${q(month)});`);sql('UPDATE admin_makeup_workspace_control SET enabled=false;')
 try{assert.deepEqual(read(statement(adjacent,request)),created);const after=read(`SELECT admin_makeup_context_v2(${q(sa.id)},${q(f.ids[0])},${q(month)});`);assert.equal(after.additionalAvailable,false);assert.deepEqual(after.destinations,before.destinations);checks.push('control-off preserves committed grant reads and exact replay');reject(statement(fixtures.target(f,false,20)),/MAKEUP_PAUSED/,'control-off rejects only new grants')}finally{sql('UPDATE admin_makeup_workspace_control SET enabled=true;')}
 assert.equal(Number(sql(`SELECT count(*) FROM attendance WHERE booking_session_id=ANY(ARRAY[${created.sessionIds.map(q).join(',')}]::uuid[]);`)),0);checks.push('grant does not fabricate attendance or teaching evidence')
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,checks,runId:run.runId,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.stack},null,2));console.error(root);throw e}
