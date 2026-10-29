import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'

const root='.playwright/booking-ux-2/preservation-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const json=s=>JSON.parse(sql(s)),rpc=(n,...a)=>json(`SELECT ${n}(${a.map(v=>typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)).join(',')})`)
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const baseline=JSON.parse(fs.readFileSync('.playwright/booking-ux-2/baseline.json'))
const clock=sql("SELECT pg_get_functiondef('task10_clock_v1()'::regprocedure)")
try{
 const actor=await fixtures.account('user','ประวัติคูปอง UX2'),id=randomUUID(),code='OLDUX2'+randomUUID().slice(0,8).toUpperCase()
 sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,created_by) VALUES(${q(id)},${q(code)},'fixed',500,0,${q(f.sa.id)})`)
 const p=json("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='adult-10'"),d=sql("SELECT ((now() AT TIME ZONE 'Asia/Bangkok')::date+4)::text")
 const input={packageId:'adult-10',packageRevision:p.revision,courseTypeId:f.courses.adult_group,branchId:f.branch,participants:[null],learnerType:'self',childId:null,month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:10,totalAmount:5500,expectedTotalPrice:5000,sessions:[],coupon:{id,code}}
 const currentWriter=sql("SELECT pg_get_functiondef('task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure)"),oldWriter=fs.readFileSync('.playwright/booking-ux-2/task10_write_legacy_booking_v1-before.sql','utf8')
 // Source-backed old-writer fixture: definition is restored in this transaction;
 // no other connection can observe the temporary old writer.
 const old=json(`BEGIN;${oldWriter};SELECT booking_ux_create_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb);${currentWriter};COMMIT;`)
 check(sql(`SELECT count(*) FROM coupon_usages WHERE booking_id=${q(old.bookingId)}`)==='1'&&sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE booking_id=${q(old.bookingId)}`)==='0','Historical pending coupon fixture has original usage evidence and no new reservation')
 const template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.adult_group)} AND day_of_week=extract(dow FROM date ${q(d)}) AND start_time='10:00' AND is_active LIMIT 1`),session={date:d,startTime:'10:00',endTime:'11:00',childId:null,branchId:f.branch,scheduleTemplateId:template}
 const command={action:'edit',bookingIds:[old.bookingId],token:sql(`SELECT booking_ux_set_token_v1(${q(actor.id)},ARRAY[${q(old.bookingId)}]::uuid[])`),edits:[{id:old.bookingId,sessions:[session]}]},before=sql(`SELECT to_jsonb(b) FROM bookings b WHERE id=${q(old.bookingId)}`),usage=sql(`SELECT to_jsonb(u) FROM coupon_usages u WHERE booking_id=${q(old.bookingId)}`)
 const preview=rpc('booking_ux_edit_set_v1',actor.id,randomUUID(),command,true)
 check(preview.total===5000&&preview.bills[0].coupon_discount===500&&sql(`SELECT to_jsonb(b) FROM bookings b WHERE id=${q(old.bookingId)}`)===before,'Historical date-edit preview preserves recorded discount and original bill')
 rpc('booking_ux_edit_set_v1',actor.id,randomUUID(),{...command,expectedTotal:5000},false)
 check(Number(sql(`SELECT total_price FROM bookings WHERE id=${q(old.bookingId)}`))===5000&&sql(`SELECT to_jsonb(u) FROM coupon_usages u WHERE booking_id=${q(old.bookingId)}`)===usage,'Historical date-only edit preserves net price and immutable usage evidence')
 const expCode='EXP'+randomUUID().slice(0,9).toUpperCase(),expId=randomUUID();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,created_by) VALUES(${q(expId)},${q(expCode)},'fixed',100,${q(f.sa.id)})`)
 const exp=rpc('booking_ux_create_v1',actor.id,randomUUID(),{...input,expectedTotalPrice:5400,coupon:{id:expId,code:expCode}}),deadline=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(exp.bookingId)}`)
 sql("CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,clock_timestamp())$$;")
 const expired=json(`BEGIN;SET LOCAL booking_ux.test_clock=${q(deadline)};SELECT task10_expire_booking_v1(${q(exp.bookingId)});COMMIT;`)
 check(expired.cancelled&&sql(`SELECT status FROM progressive_coupon_reservations WHERE booking_id=${q(exp.bookingId)}`)==='released','Authoritative deadline expiry releases a new Legacy coupon hold without consumption')
 sql(clock+';')
 const unchanged={}
 for(const [table,expected] of Object.entries(baseline.hashes)){
  const newActors=`SELECT id FROM profiles WHERE created_at>=${q(baseline.at)}::timestamptz`
  const where=['bookings','payments','coupon_usages','progressive_coupon_reservations'].includes(table)?`WHERE user_id NOT IN (${newActors})`:['booking_sessions','booking_package_units'].includes(table)?`WHERE booking_id IN (SELECT id FROM bookings WHERE user_id NOT IN (${newActors}))`:''
  const actual=sql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM ${table} t ${where}`);unchanged[table]={expected,actual};assert.equal(actual,expected,'Pre-existing rows changed: '+table)
 }
 check(true,'Every pre-existing bill/session/payment/usage/unit/price/setting row retains its original hash')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,unchanged,target:run.target},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||'')},null,2));throw e}
finally{sql(clock+';')}
