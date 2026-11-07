import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { run,sql } from './runtime.mjs'
import { fixture,historical,activate,body,session,create,evidence,snapshot } from './helpers.mjs'
const beforeDefinitions=sql("SELECT jsonb_build_object('guard',pg_get_functiondef('public.progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)'::regprocedure),'grants',(SELECT to_jsonb(proacl) FROM pg_proc WHERE oid='public.progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)'::regprocedure));")
const past=historical(),future=historical({count:2,status:'scheduled',attending:fixture.children[1],targetDate:fixture.dates.future})
activate()
const original=snapshot([past.booking,future.booking]),input=body([session(fixture.dates.future,fixture.children[0],'10:00')])
let error
try{create(input)}catch(e){error=String(e.stderr||e)}
assert.match(error||'',/PROGRESSIVE_BOOKING_CONFLICT/)
assert.deepEqual(snapshot([past.booking,future.booking]),original)
assert.equal(sql(`SELECT count(*) FROM booking_ux_requests WHERE actor_id='${fixture.parent.id}';`),'0')
const file=evidence('baseline',{expectedFailure:'PROGRESSIVE_BOOKING_CONFLICT',error,original,past,future,rollback:true})
fs.writeFileSync(path.join(run.evidenceRoot,'baseline-state.json'),JSON.stringify({past,future,original,input,beforeDefinitions:JSON.parse(beforeDefinitions),file},null,2),{flag:'wx'})
console.log(JSON.stringify({baselineReproduced:true,rollback:true,evidence:file}))
