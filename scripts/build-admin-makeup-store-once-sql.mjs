import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const root='.playwright/admin-makeup-browse-v7/acceptance/v9'
const defs=JSON.parse(fs.readFileSync(root+'/baseline-functions.json'))
const file='supabase/migrations/20261019100346_admin_makeup_store_once_v9.sql'
const old=[],replacements=[]
function edit(name,fn){const matches=Object.entries(defs).filter(([key])=>key.startsWith(name+'('));assert.equal(matches.length,1,name);const [sig,raw]=matches[0],body=raw.replaceAll('\r\n','\n');old.push(raw+';');replacements.push(`DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('${sig}'::regprocedure),chr(13)||chr(10),chr(10)))<>'${createHash('md5').update(body).digest('hex')}' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;\n`+fn(body)+';')}
function replace(body,from,to,count=1){assert.equal(body.split(from).length-1,count,from.slice(0,100));return body.replaceAll(from,to)}
const helpers=`BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);
-- Installs disabled. Only this task's physically guarded Local acceptance enables it.
ALTER TABLE public.admin_makeup_credit_control ADD COLUMN store_once_enabled boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.admin_makeup_store_once_ready_v1(p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 RETURN public.admin_makeup_credit_ready_v1(p_actor) AND EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND store_once_enabled);
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_store_once_ready_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_store_once_ready_v1(uuid) TO service_role;

CREATE FUNCTION public.admin_makeup_store_once_preview_v1(p_actor uuid,p_source uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_root uuid;v_kids boolean;v_fresh boolean;v_booking uuid;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 v_root:=public.task10_source_root_v1(p_source);
 SELECT c.name='kids_group',b.id INTO v_kids,v_booking FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id WHERE s.id=p_source;
 v_fresh:=coalesce(v_kids,false) AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals WHERE source_root_id=v_root)
  AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits w WHERE w.booking_id=v_booking AND w.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(w.original_session_id)=v_root);
 RETURN jsonb_build_object('ready',public.admin_makeup_store_once_ready_v1(p_actor),'confirmCredit',v_fresh,
  'active',EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE singleton AND effective_at IS NOT NULL AND makeup_enabled));
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_store_once_preview_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_store_once_preview_v1(uuid,uuid) TO service_role;

-- Existing immutable Store proof supplies the original reason. The deciding
-- actor remains the Admin confirming the destination, not the historical storer.
CREATE FUNCTION public.admin_makeup_confirm_stored_source_v9(p_actor uuid,p_source uuid,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_credit uuid;v_reason text;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF NOT public.admin_makeup_store_once_ready_v1(p_actor) THEN RAISE EXCEPTION 'TASK10_UNAVAILABLE';END IF;
 SELECT w.id,a.details->>'reason' INTO v_credit,v_reason FROM public.lesson_wallet_credits w
 JOIN public.lesson_source_operations o ON o.unit_id=p_source AND o.operation='store' AND o.result->>'credit_id'=w.id::text
 JOIN public.activity_logs a ON a.user_id=o.actor_id AND a.entity_id=p_source AND a.action='admin_lesson_assistance'
  AND a.details->>'operation'='store' AND a.details->>'policyActor'='admin'
 WHERE w.original_session_id=p_source AND public.admin_makeup_credit_store_proof_v1(p_source,w.id)
 AND o.request_fingerprint=encode(extensions.digest(jsonb_build_object('date',a.details->'targetDate','start',a.details->'startTime','end',a.details->'endTime',
 'branch',a.details->'branchId','template',a.details->'templateId','reason',a.details->>'reason','attendingChildId',NULL::text,'requestId',a.details->>'requestId')::text,'sha256'),'hex')
 ORDER BY a.created_at,a.id LIMIT 1;
 IF v_credit IS NULL THEN RAISE EXCEPTION 'TASK10_APPROVAL_INELIGIBLE';END IF;
 PERFORM public.admin_makeup_credit_decide_v1(p_actor,v_credit,'approve',v_reason,p_request,false);
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_confirm_stored_source_v9(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
`
edit('lesson_source_transition_v1',body=>{
 body=replace(body,'v_request uuid;v_approve boolean;','v_request uuid;v_approve boolean;v_once boolean;v_preview jsonb;')
 const point="IF coalesce((p_payload->>'readOnly')::boolean,false) THEN RETURN jsonb_build_object('confirmed',false);END IF;"
 return replace(body,point,point+`
 v_once:=p_payload->>'storePolicy'='admin-store-once-v1';
 IF coalesce(v_once,false) THEN
  IF p_payload ? 'approveCredit' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
  v_preview:=public.admin_makeup_store_once_preview_v1(p_actor_id,p_id);
  IF NOT (v_preview->>'ready')::boolean THEN RAISE EXCEPTION 'TASK10_UNAVAILABLE';END IF;
  v_approve:=(v_preview->>'confirmCredit')::boolean;
 ELSIF EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND store_once_enabled) OR p_payload ? 'storePolicy' THEN
  RAISE EXCEPTION 'TASK10_STORE_REFRESH_REQUIRED';
 END IF;`)
})
edit('task10_family_makeup_state_v1',body=>{
 body=replace(body,'v_approved integer;v_used integer;','v_approved integer;v_used integer;v_available integer;')
 body=replace(body,"AND g.id IS NULL AND (v->>'active')::boolean",`AND g.id IS NULL
     AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals prior WHERE prior.source_root_id=(s.value->>'rootId')::uuid)
     AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=(s.value->>'bookingId')::uuid AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=(s.value->>'rootId')::uuid)
     AND (v->>'active')::boolean`)
 const point="v:=v||jsonb_build_object('sources',v_sources"
 body=replace(body,point,"SELECT count(*) INTO v_available FROM jsonb_array_elements(v_sources) s WHERE (s->>'approvalAvailable')::boolean AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton);\n  "+point)
 body=replace(body,"'approvedSources',v_approved,","'approvedSources',v_approved,'storedReadySources',v_available,'storeOnceEnabled',(SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton),")
 return replace(body,"OR v_approved>0)","OR v_approved>0 OR v_available>0)")
})
edit('lesson_source_previous_kids_makeup_v1',body=>{
 const point="v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);"
 const auto=`
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF coalesce((v_source->>'approvalAvailable')::boolean,false) AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton) THEN
   PERFORM public.admin_makeup_confirm_stored_source_v9(p_actor_id,p_source_session_id,p_request_id);
   v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  END IF;`
 // Only before the first eligibility gate; the second read follows source locks.
 assert.equal(body.split(point).length-1,2);return body.replace(point,point+auto)
})
edit('admin_makeup_browse_v1',body=>{
 const approval="AND g.status='approved' AND v_now<g.expires_at AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton))::integer AS approved_sources"
 const combined=`AND v_now<v_end AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton)
      AND (g.status='approved' AND v_now<g.expires_at OR g.id IS NULL AND s.kind='wallet' AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton)
       AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals prior WHERE prior.source_root_id=s.root_id)
       AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=s.booking_id AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=s.root_id)
       AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id)))::integer AS approved_sources`
 body=replace(body,'FROM sources s JOIN public.admin_makeup_credit_approvals g ON g.credit_id=s.credit_id AND g.source_session_id=s.id','FROM sources s LEFT JOIN public.admin_makeup_credit_approvals g ON g.credit_id=s.credit_id AND g.source_session_id=s.id')
 body=replace(body,approval,combined)
 body=replace(body,"AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id)) ORDER BY s.id)",`AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=s.booking_id AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=s.root_id)
       AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id)) ORDER BY s.id)`)
 return replace(body,"'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton),","'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton),'storeOnceEnabled',(SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton),")
})
edit('admin_makeup_history_v1',body=>{
 body=replace(body,"THEN 'ยืนยันกรณีพิเศษรายเครดิต'","THEN 'ยืนยันใช้เครดิตจากการเก็บ'")
 return replace(body,'WHERE g.parent_id=p_user AND g.source_month=p_month',`WHERE g.parent_id=p_user AND g.source_month=p_month
    AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_store_requests r WHERE r.actor_id=d.actor_id AND r.request_id=d.request_id
     AND r.result->'approval'->>'approvalId'=g.id::text AND r.result->>'storePolicy'='admin-store-once-v1')`)
})
// The public generic entry also owns the policy, so a stale service writer cannot
// silently store without the promised confirmation. Unknown new keys fail closed.
const sql=helpers+replacements.join('\n\n')+`
UPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)) WHERE singleton;
NOTIFY pgrst,'reload schema';COMMIT;\n`
// Return the policy in the durable Store result used by reload recovery/history.
const final=replace(sql,"v_result:=v_result||jsonb_build_object('approval',v_decision);","v_result:=v_result||jsonb_build_object('approval',v_decision);\n END IF;\n IF coalesce(v_once,false) THEN v_result:=v_result||jsonb_build_object('storePolicy','admin-store-once-v1');")
fs.writeFileSync(file,final)
fs.writeFileSync(root+'/rollback-v8.sql',"BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);UPDATE public.admin_makeup_credit_control SET store_once_enabled=false;\n"+old.join('\n')+"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));NOTIFY pgrst,'reload schema';COMMIT;\n")
console.log(JSON.stringify({file,replaced:old.length,bytes:final.length}))
