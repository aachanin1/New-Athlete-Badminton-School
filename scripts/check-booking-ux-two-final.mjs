import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {sql,q} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/ux-two-20261022',app='.playwright/booking-ux-1/app-ux-two-20261022-r2',old='.playwright/booking-ux-1/app-ux-four-20261022-final',fixture=JSON.parse(fs.readFileSync(root+'/fixture.json'))
const manifest=JSON.parse(fs.readFileSync(app+'/source-manifest.json')),previous=JSON.parse(fs.readFileSync(old+'/source-manifest.json')),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),changed=[],added=[]
let inputs=0
for(const[p,h]of Object.entries(manifest.hashes)){if(!/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config|tsconfig|tailwind\.config|postcss\.config)/.test(p))continue;assert.equal(hash(p),h,p);inputs++;if(!previous.hashes[p])added.push(p);else if(previous.hashes[p]!==h)changed.push(p)}
assert.deepEqual(changed.sort(),['src/components/dashboard/booking-set-editor.tsx','src/components/dashboard/booking-payment-client.tsx'].sort())
assert.deepEqual(added.sort(),['src/components/dashboard/booking-bill-summary.tsx','src/lib/booking-summary.ts'].sort())
for(const[p,h]of Object.entries(JSON.parse(fs.readFileSync('.playwright/booking-ux-1/pre-existing-dirty-hashes.json'))))assert.equal(hash(p),h,p)
const ids=[...fixture.ids,...fixture.many],bills=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('id',id,'checkout_deadline',checkout_deadline,'total_price',total_price,'child_id',child_id,'package_snapshot',package_snapshot,'package_participants',package_participants) ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`))
assert.deepEqual(bills,fixture.before)
const sessions=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('bill',booking_id,'date',date,'branch',branch_id,'child',child_id,'start',start_time,'status',status) ORDER BY booking_id,date,start_time) FROM booking_sessions WHERE booking_id=ANY(ARRAY[${ids.map(q)}]::uuid[])`))
assert.equal(sessions.filter(s=>fixture.ids.includes(s.bill)).length,3);assert.equal(sessions.filter(s=>fixture.many.includes(s.bill)).length,20)
assert.ok(sessions.some(s=>s.bill===fixture.ids[0]&&s.date==='2026-10-29'));assert.ok(sessions.some(s=>s.bill===fixture.ids[1]&&s.date==='2026-10-30'&&s.start==='10:00:00'&&s.branch===JSON.parse(fs.readFileSync(root+'/actor.json')).branches[0]))
assert.ok(sessions.some(s=>s.bill===fixture.many[0]&&s.date==='2026-11-21'));assert.ok(sessions.some(s=>s.bill===fixture.many[1]&&s.date==='2026-11-22'));assert.ok(!sessions.some(s=>fixture.many.includes(s.bill)&&['2026-11-01','2026-11-11'].includes(s.date)))
const safety=JSON.parse(sql(`SELECT jsonb_build_object('unpaidGrants',(SELECT count(*) FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id WHERE b.status NOT IN('paid','verified')),'cancelledAccepted',(SELECT count(*) FROM bookings WHERE status='cancelled' AND public.task10_has_accepted_receipt_v1(id)),'lateAccepted',(SELECT count(*) FROM task10_accepted_receipts WHERE deadline IS NOT NULL AND accepted_at>=deadline),'migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations))`))
assert.deepEqual(safety,{unpaidGrants:0,cancelledAccepted:0,lateAccepted:0,migrations:71})
assert.equal(execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim(),'');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'d8ca9758418ef64eeec3c0457ce0c7b224ea3cc1')
fs.writeFileSync(root+'/final-audit.json',JSON.stringify({passed:true,inputs,changed,added,bills,sessions,safety,build:JSON.parse(fs.readFileSync(app+'/.next/booking-ux-1-local-build.json')),at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,inputs,changed,added,safety}))
