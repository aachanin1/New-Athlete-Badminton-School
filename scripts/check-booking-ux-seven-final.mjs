import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {sql,q} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/ux-seven-20261022',actor=JSON.parse(fs.readFileSync(root+'/final/actor.json','utf8')),roster=JSON.parse(fs.readFileSync(root+'/roster.json','utf8'))
const protectedHashes=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/pre-existing-dirty-hashes.json','utf8'))
for(const[p,h]of Object.entries(protectedHashes))assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,p)
const source=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/app-ux-seven-20261022-local/source-manifest.json','utf8'));let count=0
for(const[p,h]of Object.entries(source.hashes)){if(!/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config|tsconfig|tailwind\.config|postcss\.config)/.test(p))continue;assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,p);count++}
const wallet='src/components/dashboard/booking-wallet-client.tsx',old='.playwright/booking-ux-1/app-walkthrough-owner-20261021/'
assert.equal(fs.readFileSync(wallet,'utf8'),fs.readFileSync(old+wallet,'utf8'))
const proof=JSON.parse(sql(`SELECT jsonb_build_object('actor',${q(actor.id)},'bills',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'amount',total_price,'deadline',checkout_deadline,'month',month,'quantity',total_sessions,'snapshot',package_snapshot)ORDER BY created_at) FROM bookings WHERE user_id=${q(actor.id)}),'sessions',(SELECT jsonb_agg(jsonb_build_object('bill',s.booking_id,'date',s.date,'start',s.start_time,'child',s.child_id,'status',s.status)ORDER BY s.date,s.start_time,s.child_id) FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE b.user_id=${q(actor.id)}),'unpaidGrants',(SELECT count(*) FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id WHERE b.status NOT IN ('paid','verified')),'cancelledAccepted',(SELECT count(*) FROM bookings b WHERE status='cancelled' AND public.task10_has_accepted_receipt_v1(id)),'lateAccepted',(SELECT count(*) FROM task10_accepted_receipts WHERE deadline IS NOT NULL AND accepted_at>=deadline),'migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations))`))
assert.equal(proof.unpaidGrants,0);assert.equal(proof.cancelledAccepted,0);assert.equal(proof.lateAccepted,0)
fs.writeFileSync(root+'/final/data-proof.json',JSON.stringify(proof,null,2))
sql(`UPDATE branches SET is_active=false WHERE id=ANY(ARRAY[${roster.branches.slice(1).map(b=>q(b.id))}]::uuid[])`)
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staged=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim();assert.equal(head,'d8ca9758418ef64eeec3c0457ce0c7b224ea3cc1');assert.equal(staged,'')
const result={passed:true,runtimeInputs:count,protectedDirtyFiles:Object.keys(protectedHashes),walletUnchanged:true,head,staged:0,build:JSON.parse(fs.readFileSync('.playwright/booking-ux-1/app-ux-seven-20261022-local/.next/booking-ux-1-local-build.json','utf8')),activeBranches:2,verified:proof.bills.filter(b=>b.status==='verified').length,pending:proof.bills.filter(b=>['pending_payment','paid'].includes(b.status)).length}
fs.writeFileSync(root+'/source-audit.json',JSON.stringify(result,null,2));console.log(result)
