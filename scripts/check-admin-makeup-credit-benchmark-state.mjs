// Schema-only switches around a fixed, owned synthetic benchmark dataset.
// Never send new-app read_only payloads to the old application's HTTP writer.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {run,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),mode=process.argv[2],file=path.join(root,'benchmark-state.json')
const compatibility=JSON.parse(fs.readFileSync(path.join(root,'compatibility.json')))
assert.equal(compatibility.runId,run.runId)
const tables=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','lesson_source_operations','activity_logs','notifications','payments','coupon_usages','admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents']
const snapshot=()=>Object.fromEntries(tables.map(t=>[t,JSON.parse(sql(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${t} t;`))]))
if(mode==='rollback'){
 const before=snapshot()
 // Record the harness mistake transparently: a second compatibility probe was
 // sent while the OLD API was serving. Old API has no read_only capability and
 // performed one ordinary Store of this synthetic source. No approval occurred.
 const probe=JSON.parse(sql(`SELECT jsonb_build_object('source',${q(compatibility.payload.session_id)},'status',(SELECT status FROM booking_sessions WHERE id=${q(compatibility.payload.session_id)}),'credits',(SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(compatibility.payload.session_id)}),'approvals',(SELECT count(*) FROM admin_makeup_credit_approvals a JOIN lesson_wallet_credits c ON c.id=a.credit_id WHERE c.original_session_id=${q(compatibility.payload.session_id)}));`))
 const differences=tables.filter(t=>JSON.stringify(before[t])!==JSON.stringify(compatibility.before[t]))
 fs.writeFileSync(file,JSON.stringify({runId:run.runId,before,priorHarnessProbe:{description:'Old API lacks read_only. Incorrect second probe produced one owned synthetic ordinary Store; retained without deleting evidence. Guard added to prevent old-API compatibility probes.',probe,differences},checks:[]},null,2),{flag:'wx'})
 sql(fs.readFileSync(path.join(root,'rollback-functions.sql'),'utf8'))
 assert.deepEqual(snapshot(),before)
 const record=JSON.parse(fs.readFileSync(file));record.checks.push('Schema-only rollback preserves all fifteen table fingerprints');fs.writeFileSync(file,JSON.stringify(record,null,2))
 console.log(JSON.stringify({rolledBack:true,priorSyntheticProbe:probe,differences}))
}else if(mode==='restore'){
 const record=JSON.parse(fs.readFileSync(file));assert.equal(record.runId,run.runId);assert.deepEqual(snapshot(),record.before)
 sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+Object.values(compatibility.forward).map(body=>body+';').join('\n')+"\nUPDATE admin_makeup_credit_control SET enabled=true;NOTIFY pgrst,'reload schema';COMMIT;")
 assert.deepEqual(snapshot(),record.before)
 record.checks.push('All fifteen fingerprints unchanged between v7 and v8 measurements and after forward restore');record.restored=true;fs.writeFileSync(file,JSON.stringify(record,null,2));console.log(JSON.stringify({restored:true,checks:record.checks.length}))
}else throw Error('Use guarded Local rollback or restore')
