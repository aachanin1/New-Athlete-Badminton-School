import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { run, sql, q, concurrentSql, holdTransaction } from '../tests/admin-makeup-review/runtime.mjs'
const f = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'))), checks = []
const check = (v, label) => { assert.ok(v, label); checks.push(label) }
const tables = ['bookings', 'booking_sessions', 'attendance', 'coach_assignment_groups', 'coach_assignment_group_students', 'coach_checkins', 'lesson_wallet_credits', 'payments']
const fingerprints = () => Object.fromEntries(tables.map(table => [table, sql(`SELECT md5(coalesce(string_agg(row_to_json(x)::text,'' ORDER BY id),'')) FROM public.${table} x`)]))
const before = { hashes: fingerprints(), ids: JSON.parse(sql("SELECT jsonb_build_object('audit',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'notification',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'),'receipt',coalesce((SELECT jsonb_agg(request_id) FROM admin_makeup_review_requests),'[]'))")) }
const counts = () => JSON.parse(sql("SELECT jsonb_build_object('audit',(SELECT count(*) FROM activity_logs),'notification',(SELECT count(*) FROM notifications),'receipt',(SELECT count(*) FROM admin_makeup_review_requests))"))
const read = round => JSON.parse(sql(`SELECT public.admin_makeup_review_page_v1(${q(f.sa.id)},${q(f.month+'-01')},'',${q(round.branch)})`))
const envelope = (round, action = 'request_coach_review') => { const data = read(round); return { request: randomUUID(), anchor: data.sessions[0].id, members: data.sessions.map(s => s.id).sort(), group: data.groups[0].key, action } }
const command = (e, readOnly = false, actor = f.sa.id) => `SELECT public.admin_makeup_request_review_round_v1(${q(actor)},${q(e.anchor)},${q(e.group)},${q(e.action)},ARRAY[${e.members.map(q).join(',')}]::uuid[],${q(e.request)},${readOnly},'127.0.0.1');`
const call = (...args) => JSON.parse(sql(command(...args)))
try {
 const e = envelope(f.rounds[0]), initial = counts(), result = call(e), after = counts()
 check(result.confirmed && result.targetCount === 5 && result.notificationCount === 1, 'One command confirms the five complete members and one coach delivery')
 check(after.audit-initial.audit === 5 && after.notification-initial.notification === 1 && after.receipt-initial.receipt === 1, 'Per-learner audit plus notification and receipt commit in one transaction')
 assert.deepEqual(fingerprints(), before.hashes); checks.push('Request changes no booking, attendance, assignment, check-in, Wallet or payment row')
 check(call(e).idempotentReplay === true, 'Same request replay returns the committed receipt')
 assert.deepEqual(counts(), after); checks.push('Replay creates no duplicate audits or notification')
 check(call({ ...e, group: '', members: [e.anchor] }, true).confirmed, 'Minimal actor-owned readback recovers a receipt without storing names or roster in browser storage')
 assert.throws(() => call({ ...e, members: e.members.slice(1) }), /MISMATCH/); checks.push('Reused request ID with different payload is rejected')
 assert.throws(() => call(e, true, f.admin.id), /MISMATCH/); checks.push('A different authorized Admin cannot read another actor request receipt')
 const parallel = envelope(f.rounds[1]), countBefore = counts()
 const concurrent = await Promise.all([concurrentSql(command(parallel)), concurrentSql(command(parallel))])
 check(concurrent.map(JSON.parse).every(r => r.confirmed) && concurrent.map(JSON.parse).filter(r => r.idempotentReplay).length === 1, 'Two concurrent identical requests share exactly one committed result')
 check(counts().notification-countBefore.notification === 1 && counts().audit-countBefore.audit === 5, 'Concurrent double submit produces one delivery and five audits')
 const resend = call({ ...parallel, request: randomUUID() }); check(resend.confirmed && !resend.idempotentReplay, 'An intentional new send remains a distinct auditable request')
 const mix = call(envelope(f.mixed)); check(mix.targetCount === 2 && !mix.targetSessionIds.includes(f.mixed.ids[0]), 'Mixed round attendance request targets only its two missing-attendance learners')
 const evidence = call(envelope(f.evidence, 'request_coach_evidence')); check(evidence.targetCount === 4 && evidence.notificationCount === 1, 'Evidence-only request retains recorded attendance and requests evidence once')
 const large = call(envelope(f.large)); check(large.targetCount === 600 && large.notificationCount === 1, 'A complete six-hundred-member round sends one command and one coach notification')
 const stale = envelope(f.rounds[2]); stale.members.pop(); const staleBefore = counts()
 assert.throws(() => call(stale), /SCOPE_CHANGED/); assert.deepEqual(counts(), staleBefore); checks.push('A partial stale client roster cannot send a partial round')
 const absentReceipt = call({ ...stale, request: randomUUID() }, true); check(absentReceipt.confirmed === false && absentReceipt.definitive, 'Read-only missing receipt does not dispatch a request')
 assert.throws(() => call(envelope(f.rounds[3]), false, f.parent.id), /UNAUTHORIZED/); checks.push('A real Parent cannot invoke the service helper with forged actor fields')
 for (const role of ['anon', 'authenticated']) {
  assert.throws(() => sql(`BEGIN;SET LOCAL ROLE ${role};${command(envelope(f.rounds[4]))}COMMIT;`), /permission denied/)
  checks.push(role+' cannot execute the private request helper directly')
 }
 const locked = envelope(f.rounds[5]), held = await holdTransaction(`SELECT id FROM coach_assignment_groups WHERE id=${q(f.rounds[5].group)} FOR UPDATE;`, 'review-group-lock-'+randomUUID())
 try { assert.throws(() => call(locked), /could not obtain lock/); checks.push('Competing group mutation causes a definitive no-write lock rejection') } finally { held.release(); await held.done }
 const pending = envelope(f.rounds[6]), pendingLock = await holdTransaction(`SELECT pg_advisory_xact_lock(hashtextextended('admin-review-request-v1|'||${q(pending.request)},0));`, 'review-pending-'+randomUUID())
 try { const p=call(pending,true); check(!p.confirmed && p.pending && !p.definitive, 'Readback of an in-flight command stays unknown instead of declaring it absent') } finally { pendingLock.release(); await pendingLock.done }
 // A real database failure between statement effects must roll back delivery,
 // all learner audits and the receipt, then allow the same command to retry.
 const failure = envelope(f.rounds[7]), failureBefore = counts()
 sql(`CREATE FUNCTION public.review_test_fail_delivery() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC_NOTIFICATION_FAILURE';END$$;REVOKE ALL ON FUNCTION public.review_test_fail_delivery() FROM PUBLIC,anon,authenticated,service_role;CREATE TRIGGER review_test_fail_delivery BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.review_test_fail_delivery();`)
 try { assert.throws(() => call(failure), /SYNTHETIC_NOTIFICATION_FAILURE/); assert.deepEqual(counts(), failureBefore); checks.push('Injected delivery failure leaves no notification, audit or request receipt') }
 finally { sql('DROP TRIGGER review_test_fail_delivery ON public.notifications;DROP FUNCTION public.review_test_fail_delivery();') }
 check(call(failure,true).confirmed === false, 'Lost or failed command can be checked without resending')
 check(call(failure).confirmed, 'The same request ID can retry after a proven rolled-back delivery failure')
 const coachChange = envelope(f.rounds[8])
 assert.throws(() => sql(`BEGIN;UPDATE coach_assignment_groups SET coach_id=${q(f.coach2.id)} WHERE id=${q(f.rounds[8].group)};${command(coachChange)}ROLLBACK;`), /SCOPE_CHANGED/)
 checks.push('A coach replacement invalidates the stale displayed round before delivery; injected fixture update rolls back with the command')
 assert.deepEqual(fingerprints(), before.hashes); checks.push('All protected business table fingerprints preserved after request/recovery/concurrency cases')
 const definitions = JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'")), originals=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-functions.json')))
 for(const [name,definition]of Object.entries(originals))assert.deepEqual(definitions[name],definition,name)
 checks.push(`All ${Object.keys(originals).length} pre-existing public definitions/ACL/config/definer attributes remain unchanged`)
 fs.writeFileSync(path.join(run.outputDir,'db-'+Date.now()+'.json'),JSON.stringify({checks,protectedTables:tables,functionsBefore:Object.keys(originals).length,functionsAfter:Object.keys(definitions).length},null,2));console.log(JSON.stringify({passed:checks.length}))
} finally {
 sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.ids.audit.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.ids.notification.map(q).join(',')}]::uuid[]));DELETE FROM admin_makeup_review_requests WHERE NOT(request_id=ANY(ARRAY[${before.ids.receipt.map(q).join(',')}]::uuid[]));`)
}
