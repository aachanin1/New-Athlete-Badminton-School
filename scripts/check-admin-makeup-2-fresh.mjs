import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
process.env.LESSON_SOURCE_RUN_MANIFEST=path.resolve('.playwright/admin-makeup-2-fresh/run.json')
process.env.TASK10_DISPOSABLE_TARGET=path.resolve('.playwright/admin-makeup-2-fresh/target.json')
const {verifyLessonSourceTarget,completeLessonSourceReset}=await import('./verify-lesson-source-test-target.mjs')
const before=verifyLessonSourceTarget(),root=path.join(before.outputDir,'literal-'+Date.now());fs.mkdirSync(root,{recursive:true})
function query(run,text){verifyLessonSourceTarget();return execFileSync('docker',['exec','-i','supabase_db_'+run.target.project,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim()}
assert.equal(query(before,'SELECT (SELECT count(*) FROM profiles)+(SELECT count(*) FROM bookings);'),'0','Fresh target must be empty before its reset')
const migration='20261102124501_admin_makeup_workspace_v2.sql',bytes=fs.readFileSync(path.join('supabase/migrations',migration));fs.copyFileSync(path.join('supabase/migrations',migration),path.join(before.target.workdir,'supabase/migrations',migration))
const started=Date.now(),log=fs.openSync(path.join(root,'reset.log'),'wx')
try{execFileSync(before.cli,['db','reset','--local','--workdir',before.target.workdir,'--no-seed','--yes'],{stdio:['ignore',log,log],windowsHide:true,timeout:240000})}finally{fs.closeSync(log)}
const after=completeLessonSourceReset(before,started)
assert.equal(query(after,"SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261102124501';"),'1')
assert.equal(query(after,'SELECT enabled FROM admin_makeup_workspace_control;'),'f','Literal migration must start disabled')
const definitionQuery="SELECT coalesce(jsonb_object_agg(nspname||'.'||proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)),'{}') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE nspname='public' AND (proname LIKE 'admin_makeup_%_v2' OR proname IN ('task10_family_makeup_facts_v1','admin_makeup_browse_v1','admin_makeup_history_v1'));"
const fresh=JSON.parse(query(after,definitionQuery))
process.env.LESSON_SOURCE_RUN_MANIFEST=path.resolve('.playwright/admin-makeup-2/run.json');process.env.TASK10_DISPOSABLE_TARGET=path.resolve('.playwright/admin-makeup-2/target.json')
const main=verifyLessonSourceTarget(),live=JSON.parse(query(main,definitionQuery))
assert.deepEqual(live,fresh,'Tested definitions must equal literal fresh migration')
const indexes="SELECT jsonb_object_agg(indexname,indexdef) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'admin_makeup_%';",mainIndexes=JSON.parse(query(main,indexes))
process.env.LESSON_SOURCE_RUN_MANIFEST=path.resolve('.playwright/admin-makeup-2-fresh/run.json');process.env.TASK10_DISPOSABLE_TARGET=path.resolve('.playwright/admin-makeup-2-fresh/target.json');assert.deepEqual(JSON.parse(query(after,indexes)),mainIndexes,'Fresh and tested indexes must match')
fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,checks:['empty owned target only','literal full migration chain installed','new control defaults off','tested main and fresh definitions identical'],migration,sha256:createHash('sha256').update(bytes).digest('hex'),functionCount:Object.keys(fresh).length,runId:after.runId,mainRunId:main.runId,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({root,passed:true,functionCount:Object.keys(fresh).length}))
