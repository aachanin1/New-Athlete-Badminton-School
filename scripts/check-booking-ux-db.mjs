import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,db} from '../tests/booking-ux/runtime.mjs'
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json','utf8')),checks=[]
const rpc=(n,a)=>{const r=sql(`SELECT public.${n}(${a})`);return JSON.parse(r)}
sql('UPDATE booking_ux_control SET enabled=true WHERE singleton')
const current=JSON.parse(sql("SELECT jsonb_build_object('month',extract(month FROM now()),'year',extract(year FROM now()))"))
try{
 let revision=Number(sql("SELECT revision FROM booking_ux_packages WHERE id='adult-10'"))
 if(sql("SELECT validity_months FROM booking_ux_packages WHERE id='adult-10'")!=='10'){rpc('booking_ux_set_duration_v1',`${q(f.sa.id)},'adult-10',10,${revision}`);revision++}
 const body={courseTypeId:f.courses.adult_group,branchId:f.branch,packageId:'adult-10',packageRevision:revision,participants:[null],learnerType:'self',childId:null,month:Number(current.month),year:Number(current.year),totalSessions:10,totalAmount:5500,expectedTotalPrice:5500,sessions:[]}
 const id=randomUUID(),created=rpc('booking_ux_create_v1',`${q(f.parent.id)},${q(id)},${q(JSON.stringify(body))}::jsonb`)
 assert.equal(created.totalPrice,5500);assert.equal(created.status,'pending_payment');checks.push('zero-round Adult package creates one bill at full price')
 const again=rpc('booking_ux_create_v1',`${q(f.parent.id)},${q(id)},${q(JSON.stringify(body))}::jsonb`);assert.equal(again.bookingId,created.bookingId);assert.equal(again.idempotentReplay,true);checks.push('create replay preserves booking and deadline')
 assert.equal(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(created.bookingId)}`),'0');checks.push('no package units before confirmed payment')
 const before=JSON.parse(sql(`SELECT jsonb_build_object('months',package_snapshot->>'validity_months','seconds',extract(epoch FROM checkout_deadline-created_at)) FROM bookings WHERE id=${q(created.bookingId)}`));assert.equal(before.months,'10');assert.ok(Number(before.seconds)>1798&&Number(before.seconds)<1802);checks.push('bill snapshots duration and server thirty-minute deadline')
 rpc('booking_ux_set_duration_v1',`${q(f.sa.id)},'adult-10',6,${revision}`)
 const second=rpc('booking_ux_create_v1',`${q(f.parent.id)},${q(randomUUID())},${q(JSON.stringify({...body,packageRevision:revision+1}))}::jsonb`)
 assert.equal(sql(`SELECT package_snapshot->>'validity_months' FROM bookings WHERE id=${q(created.bookingId)}`),'10');assert.equal(sql(`SELECT package_snapshot->>'validity_months' FROM bookings WHERE id=${q(second.bookingId)}`),'6');checks.push('duration edit applies to new bills; prior unpaid bill remains ten months')
 const receipt=randomUUID()
 const slipPath=f.parent.id+'/'+receipt+'/slip.png'
 await db.storage.createBucket('payment-slips',{public:true})
 const upload=await db.storage.from('payment-slips').upload(slipPath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),{contentType:'image/png'});assert.ifError(upload.error)
 rpc('task10_accept_legacy_slip_v1',`${q(f.parent.id)},ARRAY[${q(created.bookingId)}]::uuid[],${q(slipPath)},'http://127.0.0.1:62201/storage/v1/object/public/payment-slips/${slipPath}',${q('a'.repeat(64))},5500,${q(receipt)}`)
 rpc('task10_finalize_legacy_slip_v1',`${q(f.parent.id)},${q(receipt)},true,'Owned Local synthetic accepted receipt'`)
 assert.equal(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(created.bookingId)}`),'10');checks.push('confirmed package payment grants ten source-backed units without fake sessions')
 rpc('task10_finalize_legacy_slip_v1',`${q(f.parent.id)},${q(receipt)},true,'Owned Local synthetic accepted receipt'`)
 assert.equal(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(created.bookingId)}`),'10');checks.push('payment replay grants no additional units')
 fs.writeFileSync(run.evidenceRoot+'/db-smoke-state.json',JSON.stringify({created,second},null,2))
 console.log(JSON.stringify({passed:checks.length,checks}))
}catch(e){fs.writeFileSync(run.evidenceRoot+'/db-smoke-failure-'+Date.now()+'.json',JSON.stringify({checks,error:String(e),stderr:e.stderr},null,2));throw e}
finally{fs.writeFileSync(run.evidenceRoot+'/db-smoke-result-'+Date.now()+'.json',JSON.stringify({checks},null,2))}
