// Build explicit, reviewed function replacements from the physically verified
// local v7 snapshot. The resulting migration has no runtime file dependency.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const root='.playwright/admin-makeup-browse-v7/acceptance/v8'
const defs=JSON.parse(fs.readFileSync(path.join(root,'baseline-functions.json')))
const file='supabase/migrations/20261019065814_admin_makeup_credit_approval_v1.sql'
const marker='-- BEGIN VERIFIED V7 EXTENSIONS'
const base=fs.readFileSync(file,'utf8').split(marker)[0]
const old=[],extensions=[]
const pick=prefix=>{const match=Object.entries(defs).filter(([key])=>key.startsWith(prefix+'('));assert.equal(match.length,1,prefix);old.push(match[0][1]+';');return match[0][1].replaceAll('\r\n','\n')}
function replace(body,from,to,count=1){assert.equal(body.split(from).length-1,count,from.slice(0,80));return body.replaceAll(from,to)}
function emit(prefix,edit){const original=pick(prefix),current=edit(original),md5=createHash('md5').update(original).digest('hex');extensions.push(`DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('${Object.keys(defs).find(k=>k.startsWith(prefix+'('))}'::regprocedure),chr(13)||chr(10),chr(10)))<>'${md5}' THEN RAISE EXCEPTION 'ADMIN_CREDIT_V7_BASELINE_DRIFT';END IF;END $guard$;\n${current};`)}
emit('task10_family_makeup_state_v1',body=>{
 body=replace(body,'DECLARE v jsonb; v_eligible boolean;','DECLARE v jsonb; v_eligible boolean; v_sources jsonb;v_approved integer;v_used integer;')
 body=replace(body,"IF NOT(v ? 'sourceMonth') THEN RETURN v;END IF;",`IF NOT(v ? 'sourceMonth') THEN RETURN v;END IF;
  SELECT coalesce(jsonb_agg(s.value||jsonb_build_object('approval',CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('id',g.id,'status',g.status,'expiresAt',g.expires_at) END,
    'approvalAvailable',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton) AND s.value->>'kind'='wallet' AND g.id IS NULL AND (v->>'active')::boolean AND public.task10_clock_v1()<(v->>'expiresAt')::timestamptz
     AND public.admin_makeup_credit_store_proof_v1((s.value->>'sourceSessionId')::uuid,(s.value->>'creditId')::uuid)) ORDER BY s.value->>'sourceSessionId'),'[]'),
    count(*) FILTER(WHERE g.status='approved' AND public.task10_clock_v1()<g.expires_at AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton))
  INTO v_sources,v_approved FROM jsonb_array_elements(v->'sources') s(value)
   LEFT JOIN public.admin_makeup_credit_approvals g ON g.credit_id=(s.value->>'creditId')::uuid AND g.source_session_id=(s.value->>'sourceSessionId')::uuid;
  SELECT count(*) INTO v_used FROM public.admin_makeup_credit_approvals WHERE parent_id=p_parent_id AND source_month=p_source_month AND used_mode='exception';
  v:=v||jsonb_build_object('sources',v_sources,'approvedSources',v_approved,'exceptionUsed',v_used,'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton));`)
 body=replace(body,"AND (v->>'remaining')::integer>0 AND jsonb_array_length(v->'sources')>0;","AND ((v->>'remaining')::integer>0 OR v_approved>0) AND jsonb_array_length(v->'sources')>0;")
 body=replace(body,"CASE WHEN v->>'reason'='destination_minimum' THEN NULL ELSE v->>'reason' END","CASE WHEN v_eligible OR v->>'reason'='destination_minimum' THEN NULL ELSE v->>'reason' END")
 return body
})
emit('lesson_source_previous_kids_makeup_v1',body=>{
 const sourceGuard="IF v_source IS NULL OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;"
 body=replace(body,sourceGuard,sourceGuard+`
  IF (v_state->>'remaining')::integer=0 AND NOT coalesce(v_source->'approval'->>'status'='approved' AND public.task10_clock_v1()<(v_source->'approval'->>'expiresAt')::timestamptz,false) THEN RAISE EXCEPTION 'TASK10_APPROVAL_REQUIRED';END IF;`,2)
 body=replace(body,"'remaining',(v_state->>'remaining')::integer-1,","'remaining',greatest(0,(v_state->>'remaining')::integer-1),'useMode',CASE WHEN (v_state->>'remaining')::integer>0 THEN 'normal' ELSE 'exception' END,")
 return body
})
emit('admin_makeup_browse_v1',body=>{
 body=replace(body,"(SELECT count(*) FROM sources s WHERE s.user_id=f.user_id)::integer AS source_count",`(SELECT count(*) FROM sources s WHERE s.user_id=f.user_id)::integer AS source_count,
    (SELECT count(*) FROM sources s JOIN public.admin_makeup_credit_approvals g ON g.credit_id=s.credit_id AND g.source_session_id=s.id WHERE s.user_id=f.user_id AND g.status='approved' AND v_now<g.expires_at AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton))::integer AS approved_sources,
    (SELECT count(*) FROM public.admin_makeup_credit_approvals g WHERE g.parent_id=f.user_id AND g.source_month=p_month AND g.used_mode='exception')::integer AS exception_used`)
 body=replace(body,'AND remaining>0 AND source_count>0','AND (remaining>0 OR approved_sources>0) AND source_count>0')
 body=replace(body,'AND p.remaining>0 AND p.source_count>0','AND (p.remaining>0 OR p.approved_sources>0) AND p.source_count>0')
 body=replace(body,"WHEN p.remaining=0 THEN 'quota_exhausted'","WHEN p.remaining=0 AND p.approved_sources=0 THEN 'quota_exhausted'")
 body=replace(body,"'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1',","'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1','approvedSources',p.approved_sources,'exceptionUsed',p.exception_used,'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton),")
 body=replace(body,"'kind',s.kind,'creditId',s.credit_id)",`'kind',s.kind,'creditId',s.credit_id,
      'approval',(SELECT jsonb_build_object('id',g.id,'status',g.status,'expiresAt',g.expires_at) FROM public.admin_makeup_credit_approvals g WHERE g.credit_id=s.credit_id AND g.source_session_id=s.id),
      'approvalAvailable',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton) AND s.kind='wallet' AND v_policy.makeup_enabled AND v_now<v_end AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals g WHERE g.source_root_id=s.root_id)
       AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id))`)
 return body
})
emit('admin_makeup_history_v1',body=>{
 body=replace(body,"), filtered AS MATERIALIZED (SELECT * FROM events",`UNION ALL
  SELECT 'approval:'||d.id::text,'wallet',CASE WHEN d.operation='approve' THEN 'ยืนยันกรณีพิเศษรายเครดิต' ELSE 'เพิกถอนการยืนยันกรณีพิเศษ' END,
   d.created_at,'บันทึกภายใน Admin เมื่อ',g.source_session_id,NULL::uuid,d.actor_id,d.reason,
   CASE WHEN d.operation='revoke' THEN 'เพิกถอนแล้ว' WHEN g.status='consumed' THEN 'ใช้ต้นทางแล้ว' WHEN public.task10_clock_v1()>=g.expires_at THEN 'หมดอายุชดเชยแล้ว' ELSE 'ยืนยันแล้ว รอเลือกวัน' END,NULL::timestamptz,g.credit_id
  FROM public.admin_makeup_credit_approvals g JOIN public.admin_makeup_credit_decisions d ON d.approval_id=g.id
   JOIN selected_roots r ON r.root_id=g.source_root_id WHERE g.parent_id=p_user AND g.source_month=p_month
 ), filtered AS MATERIALIZED (SELECT * FROM events`)
 return body
})
const transition=pick('lesson_source_transition_v1')
extensions.push(`DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'${createHash('md5').update(transition).digest('hex')}' THEN RAISE EXCEPTION 'ADMIN_CREDIT_V7_BASELINE_DRIFT';END IF;END $guard$;
ALTER FUNCTION public.lesson_source_transition_v1(uuid,text,uuid,jsonb) RENAME TO admin_makeup_previous_transition_v1;
REVOKE ALL ON FUNCTION public.admin_makeup_previous_transition_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.admin_makeup_store_requests(
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,source_session_id uuid NOT NULL REFERENCES public.booking_sessions(id),
 request_fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.admin_makeup_store_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_makeup_store_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.admin_makeup_store_requests TO service_role;

CREATE FUNCTION public.lesson_source_transition_v1(p_actor_id uuid,p_operation text,p_id uuid,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $wrapper$
DECLARE v_fp text;v_prior public.admin_makeup_store_requests%ROWTYPE;v_result jsonb;v_decision jsonb;v_request uuid;v_approve boolean;
BEGIN
 IF p_operation IS DISTINCT FROM 'admin_store' THEN
  IF p_payload ? 'approveCredit' OR p_payload ? 'readOnly' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
  RETURN public.admin_makeup_previous_transition_v1(p_actor_id,p_operation,p_id,p_payload);
 END IF;
 PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
 IF p_payload IS NULL OR p_id IS NULL OR nullif(p_payload->>'requestId','') IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 v_request:=(p_payload->>'requestId')::uuid;
 IF p_payload ? 'approveCredit' AND jsonb_typeof(p_payload->'approveCredit')<>'boolean' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 v_approve:=coalesce((p_payload->>'approveCredit')::boolean,false);
 v_fp:=encode(extensions.digest(jsonb_build_array(p_id,p_payload-'readOnly')::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-store-request|'||p_actor_id::text||'|'||v_request::text,0));
 IF v_approve THEN PERFORM pg_advisory_xact_lock(hashtextextended('admin-credit-request|'||p_actor_id::text||'|'||v_request::text,0));END IF;
 SELECT * INTO v_prior FROM public.admin_makeup_store_requests WHERE actor_id=p_actor_id AND request_id=v_request;
 IF FOUND THEN
  IF v_prior.request_fingerprint<>v_fp THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
  RETURN v_prior.result;
 END IF;
 IF coalesce((p_payload->>'readOnly')::boolean,false) THEN RETURN jsonb_build_object('confirmed',false);END IF;
 IF v_approve AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND enabled) THEN RAISE EXCEPTION 'TASK10_APPROVAL_DISABLED';END IF;
 IF v_approve AND EXISTS(SELECT 1 FROM public.activity_logs WHERE user_id=p_actor_id AND entity_id=p_id AND action='admin_lesson_assistance'
  AND details->>'operation'='store' AND details->>'requestId'=v_request::text) THEN RAISE EXCEPTION 'TASK10_APPROVAL_CONFLICT';END IF;
 v_result:=public.admin_makeup_previous_transition_v1(p_actor_id,p_operation,p_id,p_payload-'approveCredit'-'readOnly');
 IF v_approve THEN
  v_decision:=public.admin_makeup_credit_decide_v1(p_actor_id,(v_result->>'credit_id')::uuid,'approve',p_payload->>'reason',v_request,false);
  v_result:=v_result||jsonb_build_object('approval',v_decision);
 END IF;
 INSERT INTO public.admin_makeup_store_requests(actor_id,request_id,source_session_id,request_fingerprint,result) VALUES(p_actor_id,v_request,p_id,v_fp,v_result);
 RETURN v_result;
END $wrapper$;
REVOKE ALL ON FUNCTION public.lesson_source_transition_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lesson_source_transition_v1(uuid,text,uuid,jsonb) TO service_role;

CREATE FUNCTION public.admin_makeup_credit_store_v1(p_actor_id uuid,p_operation text,p_id uuid,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $store$
BEGIN
 IF p_operation IS DISTINCT FROM 'admin_store' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 IF NOT public.admin_makeup_credit_ready_v1(p_actor_id) THEN RAISE EXCEPTION 'TASK10_UNAVAILABLE';END IF;
 RETURN public.lesson_source_transition_v1(p_actor_id,p_operation,p_id,p_payload);
END $store$;
REVOKE ALL ON FUNCTION public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb) TO service_role;`)
fs.writeFileSync(file,base+marker+'\n'+extensions.join('\n\n')+"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)) WHERE singleton;\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n")
fs.writeFileSync(path.join(root,'rollback-functions.sql'),'BEGIN;\nSELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\nUPDATE public.admin_makeup_credit_control SET enabled=false WHERE singleton;\n'+old.join('\n')+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n")
console.log(JSON.stringify({built:file,changedFunctions:old.length,bytes:fs.statSync(file).size}))
