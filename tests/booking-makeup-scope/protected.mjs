import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {sql,q,fixtures,concurrentSql,holdTransaction,observeLockWait} from './runtime.mjs'
import {fixture as f,read,rpc,historical,body,session,create,snapshot,evidence,hashFile} from './helpers.mjs'
const checks=[],check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const coupon=value=>{const id=randomUUID();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,created_by) VALUES(${q(id)},${q('SCOPE'+randomUUID().slice(0,8))},'fixed',${value},0,${q(f.admin.id)})`);return{id}}
try{
 const actor=await fixtures.account('user','ครอบครัวตรวจราคาและสิทธิ์'),children=[randomUUID(),randomUUID()]
 sql(children.map(id=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(actor.id)},'เด็กจำลองสิทธิ์','จำลอง')`).join(';'))
 const december=sql(`SELECT (date ${q(f.dates.month)}+interval '1 month 10 days')::date`),proof=historical({parent:actor,sourceChild:children[0],attending:children[0],targetDate:december,status:'scheduled'})
 check(sql(`SELECT progressive_proven_makeup_destination_v1(${q(proof.destinations[0])})`)==='t','October source officially assigned in December is accepted')
 const original=snapshot([proof.booking]),discount=coupon(100),paidInput={...body([session(december,children[1],'10:00')],actor),coupon:discount},discountKey=randomUUID(),discountBill=create(paidInput,discountKey,actor)
 check(discountBill.totalPrice===600,'December purchase quotes700 minus100 coupon; October Makeup does not increase tier')
 create(paidInput,discountKey,actor)
 check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE booking_id=${q(discountBill.bookingId)} AND status='reserved'`)==='1','Coupon reservation occurs exactly once on create replay')
 const zeroDate=sql(`SELECT (date ${q(december)}+1)::date`),zero=coupon(625),zeroInput={...body([session(zeroDate,children[1],'10:00')],actor),coupon:zero},zeroKey=randomUUID(),zeroBill=create(zeroInput,zeroKey,actor)
 check(zeroBill.totalPrice===0&&zeroBill.status==='verified','Kids zero-charge coupon settles at correct cumulative rate without money transfer')
 create(zeroInput,zeroKey,actor)
 check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE booking_id=${q(zeroBill.bookingId)} AND status='consumed'`)==='1'&&sql(`SELECT count(*) FROM payments WHERE booking_id=${q(zeroBill.bookingId)}`)==='0','Kids zero-charge replay consumes one reservation without inventing a payment')
 assert.deepEqual(snapshot([proof.booking]),original);check(true,'Prior source bill and official Makeup receipt remain unchanged after coupon settlements')
 for(const [pkg,amount,members] of [['adult-10',5500,[null]],['private-10',8000,children]]){
  const terms=read(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id=${q(pkg)}`),c=coupon(amount),key=randomUUID(),input={packageId:pkg,packageRevision:terms.revision,courseTypeId:f.courses[terms.course],branchId:f.branch,participants:members,learnerType:members.includes(null)?'self':'child',childId:members.length===1?members[0]:null,month:+f.dates.month.slice(5,7),year:+f.dates.month.slice(0,4),totalSessions:terms.quantity,totalAmount:amount,expectedTotalPrice:0,sessions:[],coupon:c}
  const bill=create(input,key,actor);check(bill.status==='verified'&&bill.totalPrice===0,pkg+' retains zero-charge settlement')
  const units=read(`SELECT jsonb_agg(jsonb_build_object('participants',participants,'expiry',expires_at)) FROM booking_package_units WHERE booking_id=${q(bill.bookingId)}`)
  check(units.length===10&&units.every(u=>JSON.stringify(u.participants)===JSON.stringify(members)&&u.expiry),pkg+' grants exactly10 units with original roster and expiry')
  create(input,key,actor);check(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(bill.bookingId)}`)==='10',pkg+' replay grants no extra rights')
 }
 // A real competing pricing-scope lock, not a timing-only Promise assertion.
 const nextDate=sql(`SELECT (date ${q(zeroDate)}+1)::date`),input=body([session(nextDate,children[0],'10:00')],actor),key=randomUUID()
 const held=await holdTransaction(`SELECT task10_lock_pricing_scope_v1(${q(actor.id)},${q(f.courses.kids_group)},${input.year},${input.month});`,'scope-source-held')
 const pending=concurrentSql(`SET application_name='scope-source-writer';SELECT booking_ux_create_v1(${q(actor.id)},${q(key)},${q(JSON.stringify(input))}::jsonb);`)
 try{await observeLockWait('scope-source-writer');check(true,'New booking waits for the real shared pricing-scope lock')}finally{held.release();await held.done}
 const afterWait=JSON.parse(await pending)
 check(afterWait.status==='pending_payment','Booking completes correctly after competing lock releases')
 const file=evidence('protected-pass',{checks,discountBill,zeroBill,afterWait,suiteHash:hashFile('tests/booking-makeup-scope/protected.mjs')})
 console.log(JSON.stringify({passed:checks.length,evidence:file}))
}catch(error){evidence('protected-failed',{checks,error:String(error),stderr:String(error.stderr||'')});throw error}
