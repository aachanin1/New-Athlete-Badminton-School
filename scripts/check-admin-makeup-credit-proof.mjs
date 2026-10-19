import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),checks=[],base=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const migration=fs.readFileSync('supabase/migrations/20261019065814_admin_makeup_credit_approval_v1.sql','utf8')
const proof=migration.match(/CREATE FUNCTION public\.admin_makeup_credit_store_proof_v1[\s\S]*?\n\$\$;/)?.[0]
assert.ok(proof);sql(proof.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))
const check=(v,name)=>{assert.ok(v,name);checks.push(name);console.log(name)}
const date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3);"),month=date.slice(0,7)
const parent=await fixtures.account('user','ตรวจหลักฐานเครดิตแปด'),f=fixtures.fixture('kids_group',false,parent,date,'16:00','17:00')
const stored=JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(parent.id)},'store',${q(f.ids[0])},'{}'::jsonb);`))
const fake={operation:'store',reason:'ข้อความเลียนแบบ',policyActor:'admin',requestId:randomUUID(),result:{credit_id:stored.credit_id},targetDate:null,startTime:null,endTime:null,branchId:null,templateId:null}
sql(`INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES(${q(parent.id)},'admin_lesson_assistance','booking_session',${q(f.ids[0])},${q(JSON.stringify(fake))}::jsonb);`)
// A later role change must not turn the Parent's past Store into an Admin Store.
sql(`UPDATE profiles SET role='admin' WHERE id=${q(parent.id)};`)
const state=JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(base.admin.id)},${q(parent.id)},${q(month+'-01')});`))
check(state.sources[0].approvalAvailable===false,'Forged assistance text plus later role promotion cannot prove Admin Store')
assert.throws(()=>sql(`SELECT admin_makeup_credit_decide_v1(${q(base.admin.id)},${q(stored.credit_id)},'approve','ห้ามผ่าน',${q(randomUUID())},false);`),/APPROVAL_INELIGIBLE/);checks.push('Approval rejects the forged past-actor evidence')
sql(`UPDATE profiles SET role='user' WHERE id=${q(parent.id)};`)
const former=await fixtures.account('admin','ผู้เก็บเปลี่ยนบทบาท'),owner=await fixtures.account('user','เครดิตเก็บโดยAdminจริง'),g=fixtures.fixture('kids_group',false,owner,date,'16:00','17:00')
const genuine=JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(former.id)},'admin_store',${q(g.ids[0])},${q(JSON.stringify({requestId:randomUUID(),reason:'Admin เก็บจริง'}))}::jsonb);`))
sql(`UPDATE profiles SET role='coach' WHERE id=${q(former.id)};`)
const approved=JSON.parse(sql(`SELECT admin_makeup_credit_decide_v1(${q(base.admin.id)},${q(genuine.credit_id)},'approve','หลักฐานจริงแม้ผู้เก็บเปลี่ยนบทบาท',${q(randomUUID())},false);`))
check(approved.confirmed,'Genuine Admin Store remains provable after the original actor changes role')
check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(stored.credit_id)};`)==='0','Rejected forged proof leaves no grant')
fs.writeFileSync(path.join(root,'proof-'+Date.now()+'.json'),JSON.stringify({passed:true,checks,runId:run.runId},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length}))
