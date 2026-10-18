import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { run, env, db, sql, concurrentSql, holdTransaction, observeLockWait, q } from '../tests/branch-closure/isolated-runtime.mjs'
const checks = [], password = 'BranchClosureLocal!2026'
const check = (value, label) => { assert.ok(value, label); checks.push(label) }
const reject = (fn, code, label) => { assert.throws(fn, new RegExp(code), label); checks.push(label) }
async function account(role) {
  const email = `branch-closure-${randomUUID()}@example.invalid`
  const result = await db.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(result.error); const id = result.data.user.id
  const update = await db.from('profiles').update({ role, full_name: `ทดสอบวันปิด ${role}` }).eq('id', id); assert.ifError(update.error)
  return { id, email }
}
const sa = await account('super_admin'), admin = await account('admin'), coach = await account('coach'), owner = await account('user'), other = await account('user')
for (const name of ['kids_group','adult_group','private']) sql(`INSERT INTO course_types(name,max_students,duration_hours) SELECT ${q(name)},20,1 WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE name=${q(name)});`)
sql("DO $$ BEGIN IF EXISTS(SELECT 1 FROM task10_policy_activation WHERE effective_at IS NULL) THEN PERFORM task10_bootstrap_catalogs_v1(); END IF; END $$; UPDATE task10_policy_activation SET state='active',effective_at=coalesce(effective_at,clock_timestamp()-interval '1 day'),makeup_enabled=true;")
const source = JSON.parse(sql("SELECT jsonb_build_object('date',t::date,'start',t::time,'end',(t+interval '1 hour')::time) FROM (SELECT CASE WHEN extract(hour FROM clock_timestamp() AT TIME ZONE 'Asia/Bangkok')>=20 THEN date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 day 7 hours' ELSE date_trunc('hour',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '2 hours' END AS t) x;"))
function fixture(courseName = 'kids_group', family = false, parent = owner, date = source.date, start = source.start, end = source.end) {
  const [booking, branch, template, slot] = Array.from({ length: 4 }, randomUUID), ids = Array.from({ length: family ? 3 : 1 }, randomUUID)
  const children = family ? [null, randomUUID(), randomUUID()] : courseName === 'kids_group' ? [randomUUID()] : [null]
  const course = sql(`SELECT id FROM course_types WHERE name=${q(courseName)}`)
  assert.ok(course, 'Migration baseline must include course types')
  sql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); CREATE TEMP TABLE closure_fixture_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true); SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาทดสอบเฉพาะงานวันปิด',${q('closure-'+branch)});
    ${children.filter(Boolean).map(id => `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(parent.id)},'นักเรียนทดสอบวันปิด','เด็กทดสอบ');`).join('')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,created_at) VALUES(${q(booking)},${q(parent.id)},${q(courseName==='kids_group'?'child':'self')},${q(courseName==='kids_group'?children[0]:null)},${q(branch)},${q(course)},extract(month FROM date ${q(date)}),extract(year FROM date ${q(date)}),${courseName==='kids_group'?8:1},500,'verified',(SELECT effective_at-interval '1 day' FROM closure_fixture_policy));
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date ${q(date)}),${q(start)},${q(end)},true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},${q(date)},${q(start)},${q(end)},'open');
    ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},${q(slot)},${q(date)},${q(start)},${q(end)},${q(branch)},${q(children[i])},'scheduled',false);`).join('')}
    ${courseName!=='kids_group'?`INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(booking)},${q(parent.id)},500,'approved',clock_timestamp());
    INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(course)},1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(course)});`:''}
    UPDATE task10_policy_activation SET state=(SELECT state FROM closure_fixture_policy),effective_at=(SELECT effective_at FROM closure_fixture_policy),
      pricing_enabled=(SELECT pricing_enabled FROM closure_fixture_policy),makeup_enabled=(SELECT makeup_enabled FROM closure_fixture_policy),expiry_enabled=(SELECT expiry_enabled FROM closure_fixture_policy); COMMIT;`)
  return { parent, booking, branch, course, courseName, template, slot, ids, children, date, start, end }
}
function target(f, nextMonth = false, offset = 1) {
  const date = sql(nextMonth ? `SELECT ((date_trunc('month',date ${q(f.date)})+interval '1 month')::date+${offset+5});` : `SELECT (date ${q(f.date)}+${offset})::date;`)
  let template = sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.course)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND end_time='11:00' AND is_active;`)
  if (!template) { template=randomUUID();sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(date)}),'10:00','11:00',true);`) }
  return { date, template, branch: f.branch, start: '10:00', end: '11:00' }
}
const payload = (t, reason = 'แก้วันเรียนตามที่ผู้ปกครองแจ้ง', requestId = randomUUID()) => ({ targetDate:t.date,startTime:t.start,endTime:t.end,branchId:t.branch,templateId:t.template,reason,requestId })
const transition = (actor, op, id, p = {}) => `SELECT lesson_source_transition_v1(${q(actor.id)},${q(op)},${q(id)},${q(JSON.stringify(p))}::jsonb);`
const closure = (f, closed = true, requestId = randomUUID(), actor = sa) => `SELECT branch_date_closure_set_v1(${q(actor.id)},${q(f.branch)},${q(f.date)},${closed},'หยุดเฉพาะวันทดสอบ',${q(requestId)});`
const state = f => JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(admin.id)},${q(f.parent.id)},date_trunc('month',date ${q(f.date)})::date);`))

const f = fixture(), t = target(f)
const financial = fixture => sql(`SELECT md5(jsonb_build_object('booking',(SELECT to_jsonb(b) FROM bookings b WHERE id=${q(fixture.booking)}),'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p WHERE booking_id=${q(fixture.booking)}))::text);`)
const originalFinancial = financial(f)
reject(() => sql(transition(owner,'reschedule',f.ids[0],payload(t))), 'CUTOFF|INELIGIBLE', 'Parent still observes 12-hour cutoff')
reject(() => sql(transition(owner,'store',f.ids[0])), 'NOT_STORABLE', 'Parent still observes 48-hour cutoff')
reject(() => sql(transition(owner,'admin_store',f.ids[0],{reason:'ปลอม Admin',requestId:randomUUID()})), 'UNAUTHORIZED', 'Parent cannot forge Admin operation')
reject(() => sql(transition(coach,'admin_store',f.ids[0],{reason:'โค้ช',requestId:randomUUID()})), 'UNAUTHORIZED', 'Coach receives no Admin override')
sql(`INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":["makeup"]}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;`)
reject(() => sql(transition(admin,'admin_store',f.ids[0],{requestId:randomUUID()})), 'REASON_REQUIRED', 'Admin needs a reason')
const p = {...payload(t),policyActor:'parent',waivedRules:['forged']}, moved = JSON.parse(sql(transition(admin,'admin_reschedule',f.ids[0],p)))
check(Boolean(moved.sessionId),'Admin moves a source within 12 hours')
check(JSON.parse(sql(transition(admin,'admin_reschedule',f.ids[0],p))).sessionId===moved.sessionId,'Move replay returns the original destination')
check(sql(`SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=${q(f.ids[0])}`)==='1','Move creates exactly one destination')
reject(() => sql(transition(admin,'admin_store',f.ids[0],{reason:'ซ้ำ',requestId:randomUUID()})), 'ALREADY_USED|CONFLICT|STALE', 'Moved original cannot be stored again')
const stored = JSON.parse(sql(transition(admin,'admin_store',moved.sessionId,{reason:'เดือนนี้ไม่มีวันใช้แล้ว',requestId:randomUUID()})))
check(Boolean(stored.credit_id),'Admin stores the moved source under 48 hours')
check(state(f).used===0,'Store does not consume shared quota')
check(state(f).eligible && state(f).destinationPurchase.quantity===0,'D0 Admin state is eligible with real wallet and retained quota')
const mt = target(f,true), req = randomUUID()
reject(() => sql(transition(owner,'redeem',stored.credit_id,payload(mt))), 'SAME_MONTH|TARGET_MONTH|AFTER_EXPIRY', 'Admin waiver does not enable Parent cross-month Wallet redemption')
const makeupSql = (sourceId, requestId, reason = 'ชดเชยตามสิทธิ์เดิม', attending = f.children[0], dest = mt) => `SELECT admin_consume_family_makeup_v1(${q(admin.id)},${q(sourceId)},${q(attending)},${q(dest.template)},${q(dest.branch)},${q(dest.date)},${q(dest.start)},${q(dest.end)},${q(requestId)},${q(reason)});`
reject(() => sql(makeupSql(moved.sessionId,req,'')), 'REASON_REQUIRED', 'Makeup requires a reason')
const grant = JSON.parse(sql(makeupSql(moved.sessionId,req)))
check(grant.remaining===1,'Admin makeup consumes one shared quota')
check(JSON.parse(sql(makeupSql(moved.sessionId,req))).data.id===grant.data.id,'Makeup replay cannot consume another source')
check(state(f).remaining===1 && state(f).sources.length===0,'Used wallet is absent from available sources')
check(financial(f)===originalFinancial,'Move, Store and Makeup preserve original billing and payment evidence')
const assistanceAudit=JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY created_at,id) FROM activity_logs a WHERE action='admin_lesson_assistance' AND entity_id=ANY(ARRAY[${q(f.ids[0])},${q(moved.sessionId)}]::uuid[]);`))
check(assistanceAudit.length===3 && assistanceAudit.every(a=>a.user_id===admin.id && a.details.reason && a.details.policyActor==='admin'),'Move, Store and Makeup atomically retain actor and reason without duplicate replay audit')
check(assistanceAudit.find(a=>a.details.operation==='reschedule').details.waivedRules.join(',')==='reschedule_12h','Audit policy exceptions are server-derived, not accepted from forged payload fields')
reject(() => sql(makeupSql(moved.sessionId,randomUUID())), 'REPLAY_CONFLICT|ALREADY_USED|INELIGIBLE', 'Wallet cannot create a second makeup destination')

const cf = fixture('adult_group'), cid = randomUUID(), original = sql(`SELECT md5(row_to_json(s)::text) FROM booking_sessions s WHERE id=${q(cf.ids[0])}`)
reject(() => sql(closure(cf,true,randomUUID(),admin)), 'UNAUTHORIZED', 'Only Super Admin manages dated closures')
sql(closure(cf,true,cid));check(sql(`SELECT md5(row_to_json(s)::text) FROM booking_sessions s WHERE id=${q(cf.ids[0])}`)===original,'Closing does not change an existing booking')
check(JSON.parse(sql(closure(cf,true,cid))).success,'Closure request replays safely')
const newId = randomUUID(), insert = (id = newId) => `BEGIN;SELECT set_config('lesson_source.write','authorized',true);INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,status) VALUES(${q(id)},${q(cf.booking)},${q(cf.slot)},${q(cf.date)},${q(cf.start)},${q(cf.end)},${q(cf.branch)},'scheduled');COMMIT;`
reject(() => sql(insert()), 'BRANCH_DATE_CLOSED', 'Direct insert cannot bypass dated closure')
check(sql(`SELECT count(*) FROM booking_sessions WHERE id=${q(newId)}`)==='0','Rejected admission leaves no session residue')
const out = target(cf), outResult = JSON.parse(sql(transition(admin,'admin_reschedule',cf.ids[0],payload(out))))
check(Boolean(outResult.sessionId),'Moving out of a closed date remains permitted')
sql(closure(cf,false));sql(insert());check(sql(`SELECT count(*) FROM booking_sessions WHERE id=${q(newId)}`)==='1','Reopening restores admission')

const pf = fixture('private',true,await account('user')), pt = target(pf), pm = JSON.parse(sql(transition(admin,'admin_reschedule',pf.ids[1],payload(pt))))
check(pm.participantCount===3 && pm.sessionIds.length===3,'Admin reschedule moves every Family participant atomically')
check(sql(`SELECT count(*) FROM booking_sessions WHERE id=ANY(ARRAY[${pf.ids.map(q)}]::uuid[]) AND status='rescheduled'`)==='3','Family source participants remain together')
const walletFamily = JSON.parse(sql(transition(admin,'admin_store',pm.sessionId,{reason:'ลาครอบครัว',requestId:randomUUID()})))
check(walletFamily.participant_count===3,'Admin Store preserves one Family unit and all participant identities')

const attended = fixture('kids_group',false,await account('user')), at = target(attended)
sql(`INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(attended.ids[0])},${q(attended.children[0])},'child',${q(coach.id)},'present')`)
reject(() => sql(transition(admin,'admin_store',attended.ids[0],{reason:'ไม่ควรใช้ซ้ำ',requestId:randomUUID()})), 'ATTENDANCE|CONFLICT|NOT_STORABLE', 'Present attendance prevents Admin Store')
reject(() => sql(transition(admin,'admin_reschedule',attended.ids[0],payload(at))), 'INELIGIBLE|ATTENDANCE|CONFLICT', 'Present attendance prevents Admin move')

const sourceRead = JSON.parse(sql(`SELECT admin_lesson_sessions_v1(${q(admin.id)},date_trunc('month',date ${q(source.date)})::date,'นักเรียนทดสอบวันปิด',NULL,'kids_group',1,NULL);`))
check(sourceRead.items.length>0 && sourceRead.total>=sourceRead.items.length,'Future lesson read filters before pagination')
const authenticated = createClient(env.apiUrl,env.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}})
assert.ifError((await authenticated.auth.signInWithPassword({email:owner.email,password})).error)
const forged = await authenticated.rpc('lesson_source_transition_v1',{p_actor_id:admin.id,p_operation:'admin_store',p_id:attended.ids[0],p_payload:{reason:'forged',requestId:randomUUID()}})
check(Boolean(forged.error),'Authenticated user cannot directly invoke service-only Admin transition')
const directClosure = await authenticated.from('branch_date_closures').insert({branch_id:f.branch,closure_date:f.date,reason:'forged'})
check(Boolean(directClosure.error),'RLS/ACL prevent direct closure writes')
sql(`UPDATE system_settings SET value='{"adminAllowedMenuKeys":[]}' WHERE key='admin_menu_permissions';`)
reject(() => sql(transition(admin,'admin_store',attended.ids[0],{reason:'ไม่มีเมนู',requestId:randomUUID()})), 'UNAUTHORIZED', 'Removed makeup permission blocks DB mutation')
reject(() => state(f), 'UNAUTHORIZED', 'Removed makeup permission blocks family state reads')
sql(`UPDATE system_settings SET value='{"adminAllowedMenuKeys":["makeup"]}' WHERE key='admin_menu_permissions';`)

const missingIdentity=fixture('kids_group',false,await account('user'))
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET child_id=NULL WHERE id=${q(missingIdentity.ids[0])};COMMIT;`)
const identityRead=JSON.parse(sql(`SELECT admin_lesson_sessions_v1(${q(admin.id)},date_trunc('month',date ${q(missingIdentity.date)})::date,'',NULL,NULL,1,${q(missingIdentity.ids[0])});`))
check(identityRead.items[0].identity_valid===false,'Incomplete Kids identity is explicitly unavailable to Admin UI')
reject(()=>sql(transition(admin,'admin_store',missingIdentity.ids[0],{reason:'ไม่ใช่ตัวตนที่ยืนยัน',requestId:randomUUID()})),'IDENTITY_CONFLICT','Admin override cannot turn a missing child into the Parent learner')
const foreignIdentity=fixture('kids_group',false,await account('user'))
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET child_id=${q(attended.children[0])} WHERE id=${q(foreignIdentity.ids[0])};COMMIT;`)
reject(()=>sql(transition(admin,'admin_store',foreignIdentity.ids[0],{reason:'คนละครอบครัว',requestId:randomUUID()})),'IDENTITY_CONFLICT','Admin cannot use another family child as the source identity')

function extraSource(f, offset, attendance = null) {
  const date = sql(`SELECT (date ${q(f.date)}+${offset})::date`), id=randomUUID(), slot=randomUUID(), template=randomUUID()
  sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(date)}),'16:00','17:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(f.branch)},${q(f.course)},${q(date)},'16:00','17:00','open');
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(f.booking)},${q(slot)},${q(date)},'16:00','17:00',${q(f.branch)},${q(f.children[0])},${q(attendance==='absent'?'absent':'scheduled')},false);
    ${attendance?`INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(id)},${q(f.children[0])},'child',${q(coach.id)},${q(attendance)});`:''}COMMIT;`)
  return id
}
const absent1=extraSource(f,-1,'absent'),absent2=extraSource(f,-2,'absent'),mt2=target(f,true,8)
check(state(f).sources.filter(s=>s.kind==='absent').length===2,'Only exact attendance-backed absent sources are counted')
reject(()=>sql(transition(admin,'admin_store',absent1,{reason:'ห้ามใช้เลี่ยงโควตา',requestId:randomUUID()})),'ATTENDANCE|NOT_STORABLE|CONFLICT','Actual absent source cannot be converted to Wallet')
reject(()=>sql(transition(admin,'admin_reschedule',absent1,payload(t))),'INELIGIBLE|ATTENDANCE|CONFLICT','Actual absent source cannot bypass Makeup quota as ordinary move')
const grant2=JSON.parse(sql(makeupSql(absent1,randomUUID(),'ใช้สิทธิ์ขาดจริง',f.children[0],mt2)))
check(grant2.remaining===0 && state(f).remaining===0 && state(f).sources.length===1,'Wallet and absent sources share the same original quota')
reject(()=>sql(makeupSql(absent2,randomUUID(),'โควตาเต็ม',f.children[0],mt)),'INELIGIBLE|QUOTA','Real absence cannot exceed the retained family quota')
const afterQuotaSource=extraSource(f,3),afterQuotaStore=JSON.parse(sql(transition(admin,'admin_store',afterQuotaSource,{reason:'เก็บไว้ตามอายุสิทธิ์',requestId:randomUUID()})))
check(Boolean(afterQuotaStore.credit_id) && state(f).remaining===0,'Store remains separate from next-month quota consumption')
const retrospective=extraSource(f,-3),retroStore=JSON.parse(sql(transition(admin,'admin_store',retrospective,{reason:'แก้รายการลาที่ตรวจสอบแล้ว',requestId:randomUUID()})))
check(Boolean(retroStore.credit_id),'Admin can correct a past unused scheduled source with reason and preserved expiry')
const expiredDate=sql("SELECT (date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')-interval '1 month'+interval '6 days')::date"),expired=fixture('kids_group',false,await account('user'),expiredDate)
reject(()=>sql(transition(admin,'admin_store',expired.ids[0],{reason:'ห้ามคืนชีพสิทธิ์เก่า',requestId:randomUUID()})),'EXPIRED','Admin timing waiver does not revive an expired entitlement')
sql(`UPDATE task10_policy_activation SET makeup_enabled=false;`)
check(state(f).reason==='paused' && !state(f).eligible,'Paused Makeup policy remains enforced for Admin')
sql(`UPDATE task10_policy_activation SET makeup_enabled=true;`)

for (let n=0;n<6;n++) {
  const race=fixture('kids_group',false,await account('user')),destination=target(race)
  const results=await Promise.allSettled([concurrentSql(transition(admin,'admin_store',race.ids[0],{reason:'แข่งเก็บ',requestId:randomUUID()})),concurrentSql(transition(admin,'admin_reschedule',race.ids[0],payload(destination)))])
  check(results.filter(x=>x.status==='fulfilled').length===1,'Store/move concurrent pair has one committed winner '+n)
  check(sql(`SELECT (SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(race.ids[0])})+(SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=${q(race.ids[0])});`)==='1','Store/move race leaves exactly one right '+n)
}

const closeRace=fixture('adult_group',false,await account('user')),incomingOwner=await account('user')
const admission = (fixture,booking,id) => `
  SELECT set_config('lesson_source.write','authorized',true);
  SELECT set_config('task10.payment_write','authorized',true);
  SELECT set_config('task10.source_write','authorized',true);
  INSERT INTO bookings(id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status,expires_at)
    VALUES(${q(booking)},${q(incomingOwner.id)},'self',${q(fixture.branch)},${q(fixture.course)},extract(month FROM date ${q(fixture.date)}),extract(year FROM date ${q(fixture.date)}),1,500,'pending_payment',clock_timestamp()+interval '1 day');
  INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,status)
    VALUES(${q(id)},${q(booking)},${q(fixture.slot)},${q(fixture.date)},${q(fixture.start)},${q(fixture.end)},${q(fixture.branch)},'scheduled');`
const cb=randomUUID(),cs=randomUUID(),waitName='closure-admit-'+randomUUID(),heldClose=await holdTransaction(closure(closeRace), 'closure-holder-'+randomUUID())
const blockedAdmission=concurrentSql(`SET application_name=${q(waitName)};BEGIN;${admission(closeRace,cb,cs)}COMMIT;`);void blockedAdmission.catch(()=>{})
await observeLockWait(waitName);heldClose.release();await heldClose.done
await assert.rejects(blockedAdmission,/BRANCH_DATE_CLOSED/);checks.push('Admission waits for an in-flight closure and then fails closed')
check(sql(`SELECT (SELECT count(*) FROM bookings WHERE id=${q(cb)})+(SELECT count(*) FROM booking_sessions WHERE id=${q(cs)})`)==='0','Closure-winning race rolls back the entire incoming booking transaction')
sql(closure(closeRace,false));const ab=randomUUID(),as=randomUUID(),waitClose='admit-close-'+randomUUID(),heldAdmission=await holdTransaction(admission(closeRace,ab,as),'admission-holder-'+randomUUID())
const blockedClose=concurrentSql(`SET application_name=${q(waitClose)};${closure(closeRace)}`);void blockedClose.catch(()=>{})
await observeLockWait(waitClose);heldAdmission.release();await heldAdmission.done;await blockedClose
check(sql(`SELECT count(*) FROM booking_sessions WHERE id=${q(as)} AND status='scheduled'`)==='1','Admission-winning race preserves the committed existing name when closure follows')
reject(()=>sql(`BEGIN;${admission(closeRace,randomUUID(),randomUUID())}COMMIT;`),'BRANCH_DATE_CLOSED','Later admission is blocked after the raced closure commits')
const fixtureFile=path.join(run.outputDir,'branch-closure-fixture-'+Date.now()+'.json')
fs.writeFileSync(fixtureFile,JSON.stringify({password,sa,admin,coach,owner,other,source,fixture:f,closedFixture:cf,familyFixture:pf},null,2),{flag:'wx'})
const report={passed:true,runId:run.runId,checks,fixtureFile,migrationSha256:createHash('sha256').update(fs.readFileSync('supabase/migrations/20261018110456_branch_date_closures_and_admin_assistance.sql')).digest('hex')}
fs.writeFileSync(path.join(run.outputDir,'db-'+Date.now()+'.json'),JSON.stringify(report,null,2),{flag:'wx'})
console.log(JSON.stringify({passed:true,checks:checks.length,fixtureFile}))
