import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q} from './runtime.mjs'
import {fixture as f,read,rpc,evidence} from './helpers.mjs'
// Cancel only the exact synthetic purchases registered by the prior completed
// run before repeating the now-final dependency definitions. Retain all output.
const files=fs.readdirSync(run.outputDir).filter(n=>n.startsWith('db-pass-')).sort()
const prior=JSON.parse(fs.readFileSync(path.join(run.outputDir,files.at(-1))))
assert.equal(prior.runId,run.runId)
const ids=[prior.created.bookingId,prior.distantPurchase.bookingId,prior.concurrentBill],cancelled=[]
for(const id of ids){
 const row=read(`SELECT jsonb_build_object('owner',b.user_id,'status',b.status,'revision',s.revision) FROM bookings b JOIN booking_pricing_scopes s ON s.id=b.pricing_scope_id WHERE b.id=${q(id)}`)
 assert.equal(row.owner,f.parent.id)
 if(row.status==='pending_payment'){rpc('cancel_progressive_pending_booking_v1',`${q(f.parent.id)},${q(id)},${q(randomUUID())},${row.revision}`);cancelled.push(id)}
}
evidence('db-rerun-fixture-preparation',{cancelled,priorFile:files.at(-1)})
await import('./db.mjs')
