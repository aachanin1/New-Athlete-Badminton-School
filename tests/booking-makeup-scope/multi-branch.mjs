import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q} from './runtime.mjs'
import {fixture as f,body,session,snapshot,evidence} from './helpers.mjs'
const b=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-state.json'))),checks=[]
try{
 const before=snapshot([b.past.booking,b.future.booking]),branch=randomUUID(),key=randomUUID(),date=sql(`SELECT (date ${q(f.dates.future)}+7)::date`),input=body([session(date,f.children[0],'10:00')])
 sql(`BEGIN;SET LOCAL session_replication_role=replica;
 INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาปลายทางจำลอง',${q('scope-second-'+branch)});
 UPDATE booking_sessions SET branch_id=${q(branch)} WHERE id=${q(b.past.destinations[0])};
 SET LOCAL session_replication_role=origin;
 DO $branch$ DECLARE r jsonb;BEGIN
 IF NOT progressive_proven_makeup_destination_v1(${q(b.past.destinations[0])}) THEN RAISE EXCEPTION 'OTHER_BRANCH_PROOF_REJECTED';END IF;
 r:=booking_ux_create_v1(${q(f.parent.id)},${q(key)},${q(JSON.stringify(input))}::jsonb);
 IF r->>'status'<>'pending_payment' OR (r->>'totalPrice')::numeric<>625 THEN RAISE EXCEPTION 'OTHER_BRANCH_PURCHASE_INVALID';END IF;
 END $branch$;ROLLBACK;`)
 checks.push('Official Makeup destination in another branch retains valid source proof','New purchase in original branch passes normal guards at correct family tier')
 assert.deepEqual(snapshot([b.past.booking,b.future.booking]),before)
 assert.equal(sql(`SELECT count(*) FROM booking_ux_requests WHERE request_id=${q(key)}`),'0')
 checks.push('Cross-branch fixture and purchase roll back without altering original history')
 const file=evidence('multi-branch-pass',{checks});console.log(JSON.stringify({passed:checks.length,evidence:file}))
}catch(error){evidence('multi-branch-failed',{checks,error:String(error),stderr:String(error.stderr||'')});throw error}
