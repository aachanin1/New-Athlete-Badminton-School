// Owner-authorized one-time Kids cutover. Generates reviewable SQL; never connects
// to a database. Private manifests/output must remain outside Git/deployment.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

export const migrationName = 'task10_kids_same_month_late_pricing'
export const migrationVersion = '20260927090306'
export const operationAction = 'owner_directed_kids_same_month_cutover'
const literal = value => "'" + String(value).replaceAll("'", "''") + "'"
const hash = value => createHash('sha256').update(value).digest('hex')
const uuid = value => assert.match(value, /^[0-9a-f]{8}-[0-9a-f-]{27}$/)
const protectedTables = ['payments','task10_accepted_receipts','progressive_payment_allocations','progressive_payment_batches',
  'progressive_payment_batch_bookings','progressive_payment_verification_attempts','lesson_wallet_credits','lesson_wallet_credit_members',
  'attendance','finance_expenses','coach_payouts','task10_booking_pricing_evidence','task10_family_makeup_uses']
const protectedHashSql = `SELECT md5(jsonb_build_object(${protectedTables.map(t=>`${literal(t)},(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text) FROM public.${t} x)`).join(',')})::text)`

export function captureSql(extraIds = []) {
  extraIds.forEach(uuid)
  const extra = extraIds.length ? `OR b.id IN (${extraIds.map(literal)})` : ''
  return `WITH pending AS MATERIALIZED (
 SELECT b.* FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
 WHERE c.name::text='kids_group' AND (b.status::text='pending_payment' ${extra})
), details AS MATERIALIZED (SELECT b.id,jsonb_build_object(
 'booking',to_jsonb(b),
 'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.booking_sessions s WHERE s.booking_id=b.id),
 'payments',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.payments p WHERE p.booking_id=b.id),
 'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.booking_id,r.request_id),'[]') FROM public.task10_accepted_receipts r WHERE r.booking_id=b.id),
 'allocations',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.progressive_payment_allocations a WHERE a.booking_id=b.id),
 'batches',(SELECT coalesce(jsonb_agg(jsonb_build_object('member',to_jsonb(m),'batch',to_jsonb(pb)) ORDER BY pb.id),'[]') FROM public.progressive_payment_batch_bookings m JOIN public.progressive_payment_batches pb ON pb.id=m.payment_batch_id WHERE m.booking_id=b.id),
 'attempts',(SELECT count(*) FROM public.progressive_payment_verification_attempts a WHERE EXISTS(SELECT 1 FROM public.progressive_payment_batch_bookings m WHERE m.booking_id=b.id AND m.payment_batch_id=a.payment_batch_id)),
 'coupons',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id),'[]') FROM public.coupon_usages u WHERE u.booking_id=b.id),
 'reservations',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.progressive_coupon_reservations r WHERE r.booking_id=b.id),
 'attendance',(SELECT count(*) FROM public.attendance a JOIN public.booking_sessions s ON s.id=a.booking_session_id WHERE s.booking_id=b.id),
 'assignments',(SELECT count(*) FROM public.coach_assignment_group_students a JOIN public.booking_sessions s ON s.id=a.booking_session_id WHERE s.booking_id=b.id),
 'wallet',(SELECT count(*) FROM public.lesson_wallet_credits w WHERE w.booking_id=b.id OR EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=b.id AND s.id IN(w.original_session_id,w.redeemed_session_id))),
 'descendants',(SELECT count(*) FROM public.booking_sessions d JOIN public.booking_sessions s ON s.id=d.rescheduled_from_id WHERE s.booking_id=b.id),
 'multipart',(SELECT count(*) FROM storage.s3_multipart_uploads u WHERE u.bucket_id IN('payment-slips','progressive-payment-slips') AND left(u.key,37)=b.user_id::text||'/'),
 'unlinkedStorage',(SELECT count(*) FROM storage.objects o WHERE o.bucket_id IN('payment-slips','progressive-payment-slips') AND left(o.name,37)=b.user_id::text||'/'
   AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.user_id=b.user_id AND split_part(p.slip_image_url,'/storage/v1/object/public/'||o.bucket_id||'/',2)=o.name AND p.booking_id<>b.id)
   AND NOT EXISTS(SELECT 1 FROM public.progressive_payment_batches pb WHERE pb.user_id=b.user_id AND pb.status='approved' AND pb.slip_storage_bucket=o.bucket_id AND pb.slip_storage_path=o.name
     AND NOT EXISTS(SELECT 1 FROM public.progressive_payment_batch_bookings m WHERE m.payment_batch_id=pb.id AND m.booking_id=b.id))),
 'scope',(SELECT to_jsonb(sc) FROM public.booking_pricing_scopes sc WHERE sc.user_id=b.user_id AND sc.course_type_id=b.course_type_id AND sc.lesson_year=b.year AND sc.lesson_month=b.month),
 'slots',(SELECT coalesce(jsonb_agg(to_jsonb(ss) ORDER BY ss.id),'[]') FROM public.schedule_slots ss WHERE ss.id IN(SELECT schedule_slot_id FROM public.booking_sessions WHERE booking_id=b.id))
 ) AS evidence FROM pending b), classified AS MATERIALIZED (SELECT id,evidence,
 CASE WHEN evidence->'booking'->>'status'<>'pending_payment' THEN 'not_pending'
 WHEN jsonb_array_length(evidence->'payments')+jsonb_array_length(evidence->'receipts')+jsonb_array_length(evidence->'allocations')>0 THEN 'payment_or_receipt'
 WHEN jsonb_array_length(evidence->'batches')>0 OR (evidence->>'attempts')::integer>0 OR evidence->'scope'->>'locked_by_payment_batch_id' IS NOT NULL THEN 'batch_or_inflight_payment'
 WHEN (evidence->>'multipart')::integer>0 OR (evidence->>'unlinkedStorage')::integer>0 THEN 'storage_or_inflight_upload'
 WHEN (evidence->>'attendance')::integer+(evidence->>'assignments')::integer+(evidence->>'wallet')::integer+(evidence->>'descendants')::integer>0 OR jsonb_array_length(evidence->'coupons')>0 THEN 'protected_dependencies'
 WHEN jsonb_array_length(evidence->'sessions')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(evidence->'sessions') s WHERE s->>'status'<>'scheduled' OR s->>'cancelled_at' IS NOT NULL OR (s->>'is_makeup')::boolean OR s->>'rescheduled_from_id' IS NOT NULL) THEN 'session_conflict'
 ELSE 'eligible' END AS reason FROM details), final AS (SELECT a.id,a.evidence,
 CASE WHEN a.reason='eligible' AND EXISTS(SELECT 1 FROM classified p WHERE p.id<>a.id AND p.reason<>'eligible' AND p.evidence->'booking'->>'status'='pending_payment'
   AND ROW(p.evidence->'booking'->>'user_id',p.evidence->'booking'->>'course_type_id',p.evidence->'booking'->>'year',p.evidence->'booking'->>'month')=
       ROW(a.evidence->'booking'->>'user_id',a.evidence->'booking'->>'course_type_id',a.evidence->'booking'->>'year',a.evidence->'booking'->>'month')) THEN 'protected_pending_scope' ELSE a.reason END AS reason FROM classified a)
 SELECT jsonb_build_object('observedAt',clock_timestamp(),'readOnly',current_setting('transaction_read_only'),
 'controls',(SELECT to_jsonb(a) FROM public.task10_policy_activation a WHERE singleton),
 'cron',(SELECT jsonb_agg(jsonb_build_object('jobid',jobid,'active',active,'schedule',schedule,'command',command) ORDER BY jobid) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1'),
 'quoteBodyHash',(SELECT md5(prosrc) FROM pg_proc WHERE oid='public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)'::regprocedure),
 'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'reason',reason,'fingerprint',encode(extensions.digest(evidence::text,'sha256'),'hex'),'evidence',evidence) ORDER BY id) FROM final),'[]')) AS capture`
}

export function createPlan(capture, input) {
  uuid(input.actorId)
  assert.equal(capture.readOnly, 'on')
  assert.equal(capture.controls.state, 'active')
  assert(capture.controls.pricing_enabled && capture.controls.makeup_enabled && capture.controls.expiry_enabled)
  assert.equal(capture.cron.length, 1); assert.equal(capture.cron[0].active, true)
  assert.match(input.sourceSha, /^[a-f0-9]{40}$/)
  assert.match(input.deploymentId, /^dpl_/)
  assert.match(input.migrationHash, /^[a-f0-9]{64}$/)
  const rows = capture.rows
  return { version: 1, operationId: randomUUID(), ...input, migrationVersion, migrationName,
    operator: 'Developer Codex via database-owner connection; Owner-directed cancellation, not customer action',
    authorization: 'Owner FINAL CODEX COMMAND 2026-09-27: same-month late pricing and one-time unpaid Kids cancellation; automated acceptance; no Pause/Resume',
    observedAt: capture.observedAt, controls: capture.controls, cron: capture.cron, quoteBodyHash: capture.quoteBodyHash,
    rows, requests: Object.fromEntries(rows.map(r => [r.id, randomUUID()])),
    manifestHash: hash(JSON.stringify(capture)), expected: { bills: rows.filter(r=>r.reason==='eligible').length,
      sessions: rows.filter(r=>r.reason==='eligible').reduce((n,r)=>n+r.evidence.sessions.length,0),
      billValue: rows.filter(r=>r.reason==='eligible').reduce((n,r)=>n+Number(r.evidence.booking.total_price),0) } }
}

export function buildCutoverSql(plan, migrationSql, { failBeforeCommit = false } = {}) {
  uuid(plan.operationId); uuid(plan.actorId)
  assert.equal(plan.version, 1); assert.equal(plan.migrationVersion, migrationVersion)
  assert.equal(hash(migrationSql), plan.migrationHash)
  assert.equal((migrationSql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1)
  assert(migrationSql.includes('public.task10_booking_policy_quote_v1('))
  assert(!/^\s*(BEGIN|COMMIT|ROLLBACK);/m.test(migrationSql))
  const ids=plan.rows.map(r=>r.id);ids.forEach(uuid)
  return `BEGIN;
SET LOCAL statement_timeout='45s'; SET LOCAL lock_timeout='3s'; SET LOCAL idle_in_transaction_session_timeout='15s';
SELECT pg_advisory_xact_lock(10,1);
SELECT pg_advisory_xact_lock(10,2);
SELECT pg_advisory_xact_lock(10,3);
LOCK TABLE storage.objects,storage.s3_multipart_uploads,storage.s3_multipart_uploads_parts IN SHARE MODE NOWAIT;
LOCK TABLE public.attendance,public.coach_assignment_group_students,public.coach_assignments,public.coupon_usages,public.progressive_coupon_reservations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $cutover$
DECLARE v_plan jsonb:=${literal(JSON.stringify(plan))}::jsonb; actual jsonb; v_row jsonb; frozen jsonb; outcome jsonb;
 selected uuid[]:=ARRAY[]::uuid[]; skipped jsonb:='[]'; before_logs uuid[]; logrow record; v_bill record; revision bigint;
 cutover_at timestamptz:=public.task10_clock_v1(); bill_value numeric:=0; session_count integer:=0; protected_before text; protected_after text; financial_before text; financial_after text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.activity_logs WHERE action=${literal(operationAction)}) OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${literal(migrationVersion)}) THEN RAISE EXCEPTION 'KIDS_CUTOVER_ALREADY_RECORDED_NO_REPLAY'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(v_plan->>'actorId')::uuid AND role::text='super_admin') THEN RAISE EXCEPTION 'KIDS_CUTOVER_OPERATOR'; END IF;
 IF (SELECT to_jsonb(a) FROM public.task10_policy_activation a WHERE singleton) IS DISTINCT FROM v_plan->'controls' THEN RAISE EXCEPTION 'KIDS_CUTOVER_CONTROLS_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)'::regprocedure) IS DISTINCT FROM v_plan->>'quoteBodyHash' THEN RAISE EXCEPTION 'KIDS_CUTOVER_DEFINITION_CHANGED'; END IF;
 IF jsonb_array_length(v_plan->'rows')>0 THEN
   PERFORM public.task10_lock_booking_set_v1(ARRAY[${ids.map(literal)}]::uuid[]);
 END IF;
 SELECT capture INTO actual FROM (${captureSql(ids)}) c;
 IF actual->'cron' IS DISTINCT FROM v_plan->'cron' THEN RAISE EXCEPTION 'KIDS_CUTOVER_CRON_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(actual->'rows') a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_plan->'rows') f WHERE f->>'id'=a->>'id')) THEN RAISE EXCEPTION 'KIDS_CUTOVER_NEW_CANDIDATES_REFRESH_MANIFEST'; END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(actual->'rows') LOOP
   SELECT value INTO frozen FROM jsonb_array_elements(v_plan->'rows') WHERE value->>'id'=v_row->>'id';
   IF v_row->>'reason'<>'eligible' OR frozen->>'reason'<>'eligible' OR v_row->>'fingerprint' IS DISTINCT FROM frozen->>'fingerprint' THEN
     skipped:=skipped||jsonb_build_array(jsonb_build_object('bookingId',v_row->>'id','reason',CASE WHEN v_row->>'reason'<>'eligible' THEN v_row->>'reason' ELSE 'changed_since_manifest' END));
   ELSE selected:=array_append(selected,(v_row->>'id')::uuid); END IF;
 END LOOP;
 -- Do not reprice a skipped pending bill indirectly through a sibling cancellation.
 FOR v_bill IN SELECT k.* FROM public.bookings k WHERE k.id=ANY(selected) LOOP
   IF EXISTS(SELECT 1 FROM public.bookings other WHERE other.user_id=v_bill.user_id AND other.course_type_id=v_bill.course_type_id AND other.year=v_bill.year AND other.month=v_bill.month AND other.status::text='pending_payment' AND NOT other.id=ANY(selected)) THEN
     selected:=array_remove(selected,v_bill.id);skipped:=skipped||jsonb_build_array(jsonb_build_object('bookingId',v_bill.id,'reason','skipped_pending_scope'));
   END IF;
 END LOOP;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.id),'[]')::text) INTO protected_before FROM public.bookings k WHERE NOT k.id=ANY(selected);
 SELECT result INTO financial_before FROM (${protectedHashSql}) AS proof(result);
 SELECT array_agg(id) INTO before_logs FROM public.activity_logs;
 FOR v_bill IN SELECT * FROM public.bookings WHERE id=ANY(selected) ORDER BY (pricing_scope_id IS NULL),pricing_scope_id,created_at DESC,id DESC LOOP
   IF v_bill.created_at>=cutover_at OR v_bill.status::text<>'pending_payment' OR NOT EXISTS(SELECT 1 FROM public.course_types WHERE id=v_bill.course_type_id AND name::text='kids_group') THEN RAISE EXCEPTION 'KIDS_CUTOVER_ROW_PRECONDITION'; END IF;
   bill_value:=bill_value+v_bill.total_price;
   session_count:=session_count+(SELECT count(*) FROM public.booking_sessions WHERE booking_id=v_bill.id);
   IF v_bill.pricing_scope_id IS NULL THEN
     PERFORM public.task10_cancel_legacy_booking_v1(v_bill.id,(v_plan->>'actorId')::uuid,'admin_payment_cancelled');outcome:=jsonb_build_object('flow','legacy','cancelled',true);
   ELSE
     SELECT sc.revision INTO revision FROM public.booking_pricing_scopes sc WHERE sc.id=v_bill.pricing_scope_id;
     outcome:=public.cancel_progressive_pending_booking_v1(v_bill.user_id,v_bill.id,(v_plan->'requests'->>v_bill.id::text)::uuid,revision);
     IF outcome->>'ok' IS DISTINCT FROM 'true' OR outcome->>'idempotentReplay' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'KIDS_CUTOVER_RPC_RESULT'; END IF;
   END IF;
   INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES((v_plan->>'actorId')::uuid,'owner_directed_kids_pricing_cancellation','booking',v_bill.id,jsonb_build_object('operationId',v_plan->>'operationId','operator',v_plan->>'operator','authorization',v_plan->>'authorization','bookingOwnerId',v_bill.user_id,'before',to_jsonb(v_bill),'result',outcome));
 END LOOP;
 FOR logrow IN SELECT * FROM public.activity_logs WHERE NOT id=ANY(coalesce(before_logs,ARRAY[]::uuid[])) AND action='cancel_progressive_pending_booking' AND entity_id=ANY(selected) LOOP
   UPDATE public.activity_logs SET user_id=(v_plan->>'actorId')::uuid,details=coalesce(details,'{}')||jsonb_build_object('operationId',v_plan->>'operationId','bookingOwnerId',logrow.user_id,'operator',v_plan->>'operator','ownerDirected',true,'customerInitiated',false) WHERE id=logrow.id;
 END LOOP;
 IF (SELECT count(*) FROM public.bookings WHERE id=ANY(selected) AND status::text='cancelled')<>cardinality(selected)
 OR (SELECT count(*) FROM public.booking_sessions WHERE booking_id=ANY(selected) AND cancelled_at IS NOT NULL)<>session_count
 OR EXISTS(SELECT 1 FROM public.progressive_coupon_reservations WHERE booking_id=ANY(selected) AND status='reserved') THEN RAISE EXCEPTION 'KIDS_CUTOVER_CANCELLATION_POSTCONDITION'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.id),'[]')::text) INTO protected_after FROM public.bookings k WHERE NOT k.id=ANY(selected);
 IF protected_before IS DISTINCT FROM protected_after THEN RAISE EXCEPTION 'KIDS_CUTOVER_PROTECTED_BOOKING_CHANGED'; END IF;
 SELECT result INTO financial_after FROM (${protectedHashSql}) AS proof(result);
 IF financial_before IS DISTINCT FROM financial_after THEN RAISE EXCEPTION 'KIDS_CUTOVER_PROTECTED_EVIDENCE_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_slots ss WHERE ss.id IN(SELECT schedule_slot_id FROM public.booking_sessions WHERE booking_id=ANY(selected))
   AND ss.current_students<>(SELECT count(*) FROM public.booking_sessions bs JOIN public.bookings bk ON bk.id=bs.booking_id WHERE bs.schedule_slot_id=ss.id AND bs.cancelled_at IS NULL
   AND bs.status::text IN('scheduled','completed','absent') AND bk.status::text IN('pending_payment','paid','verified') AND (bk.status::text<>'pending_payment' OR bk.expires_at IS NULL OR bk.expires_at>transaction_timestamp()))) THEN RAISE EXCEPTION 'KIDS_CUTOVER_CAPACITY_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM public.booking_pricing_scopes sc CROSS JOIN LATERAL public.progressive_legacy_baseline_v1(sc.user_id,sc.course_type_id,sc.lesson_year,sc.lesson_month) baseline
   WHERE sc.legacy_baseline_initialized_at IS NOT NULL AND sc.id IN(SELECT pricing_scope_id FROM public.bookings WHERE id=ANY(selected))
   AND ((public.task10_effective_scope_baseline_v1(sc.id)->>'sessions')::integer IS DISTINCT FROM baseline.baseline_sessions OR public.task10_effective_scope_baseline_v1(sc.id)->>'fingerprint' IS DISTINCT FROM baseline.baseline_fingerprint)) THEN RAISE EXCEPTION 'KIDS_CUTOVER_BASELINE_MISMATCH'; END IF;
 EXECUTE ${literal(migrationSql)};
 INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${literal(migrationVersion)},${literal(migrationName)},ARRAY[${literal(migrationSql)}]);
 IF (SELECT to_jsonb(a) FROM public.task10_policy_activation a WHERE singleton) IS DISTINCT FROM v_plan->'controls' THEN RAISE EXCEPTION 'KIDS_CUTOVER_CONTROLS_CHANGED'; END IF;
 INSERT INTO public.activity_logs(id,user_id,action,entity_type,entity_id,details) VALUES((v_plan->>'operationId')::uuid,(v_plan->>'actorId')::uuid,${literal(operationAction)},'task10_kids_pricing_cutover',(v_plan->>'operationId')::uuid,
 jsonb_build_object('cutoverAt',cutover_at,'operator',v_plan->>'operator','authorization',v_plan->>'authorization','sourceSha',v_plan->>'sourceSha','deploymentId',v_plan->>'deploymentId','migrationVersion',v_plan->>'migrationVersion','migrationHash',v_plan->>'migrationHash','manifestHash',v_plan->>'manifestHash','selectionRuleVersion','kids_same_month_v2','cancelledBookings',selected,'billCount',cardinality(selected),'sessionCount',session_count,'billValue',bill_value,'skipped',skipped,'controlsUnchanged',true));
 ${failBeforeCommit ? "RAISE EXCEPTION 'KIDS_CUTOVER_INJECTED_PRECOMMIT_FAILURE';" : ''}
END $cutover$;
SELECT details FROM public.activity_logs WHERE id=${literal(plan.operationId)};
COMMIT;`
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/task10-kids-pricing-cutover.mjs')) {
  const [planPath, migrationPath, outputPath] = process.argv.slice(2)
  assert(planPath && migrationPath && outputPath, 'Usage: node script.mjs private-plan.json migration.sql private-output.sql')
  writeFileSync(outputPath, buildCutoverSql(JSON.parse(readFileSync(planPath,'utf8')), readFileSync(migrationPath,'utf8')), { flag:'wx' })
  console.log('Cutover SQL generated for review; no database connection or execution occurred.')
}
