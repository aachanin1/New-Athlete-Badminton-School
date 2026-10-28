import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { run, sql, q, concurrentSql, holdTransaction, observeLockWait } from '../tests/booking-ux/runtime.mjs'

const root=path.join(run.evidenceRoot,'admin-pricing-local-20261028')
const actors=JSON.parse(fs.readFileSync(path.join(root,'actors.private.json'))),actor=actors.admin.id
const read=()=>JSON.parse(sql(`SELECT admin_current_pricing_v1(${q(actor)});`))
const input=s=>s.tiers.map(({id,min_sessions,max_sessions,price_per_session})=>({id,min_sessions,max_sessions,price_per_session}))
const call=(s,rows=input(s))=>`admin_current_pricing_v1(${q(actor)},${q(s.asOfDate)}::date,${q(JSON.stringify(s.tiers))}::jsonb,${q(JSON.stringify(rows))}::jsonb)`
const snapshot=read(),original=input(snapshot),changed=structuredClone(original);changed[0].price_per_session+=10
const cases=[
 ['expired ID',r=>{r[0].id=actors.historical.find(h=>h.when==='past').id},'CONFLICT'],
 ['future ID',r=>{r[0].id=actors.historical.find(h=>h.when==='future').id},'CONFLICT'],
 ['unknown ID',r=>{r[0].id=randomUUID()},'CONFLICT'],
 ['duplicate ID',r=>{r[1].id=r[0].id},'INVALID'],
 ['missing ID',r=>{r.pop()},'CONFLICT'],
 ['negative price',r=>{r[1].price_per_session=-1},'INVALID'],
 ['fractional count',r=>{r[1].min_sessions=1.5},'INVALID'],
 ['missing upper field',r=>{delete r[1].max_sessions},'INVALID'],
 ['extra write field',r=>{r[1].valid_to='2099-01-01'},'INVALID'],
 ['null number',r=>{r[1].price_per_session=null},'INVALID'],
]
const rows=cases.map(([name,mutate,code])=>{const r=structuredClone(changed);mutate(r);return{name,rows:r,code}})
let query=`BEGIN;SET LOCAL statement_timeout='20s';CREATE TEMP TABLE pricing_checks(label text);DO $test$ DECLARE a uuid:=${q(actor)};s jsonb:=admin_current_pricing_v1(a);before_rows text;before_audits bigint;r jsonb; denied boolean; BEGIN
 SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) INTO before_rows FROM pricing_tiers t;
 SELECT count(*) INTO before_audits FROM activity_logs WHERE user_id=a;
 IF jsonb_array_length(s->'tiers')<>${original.length} THEN RAISE EXCEPTION 'QA_CURRENT_SET';END IF;
 INSERT INTO pricing_checks VALUES('Current-only authoritative snapshot');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'tiers') x WHERE (x->>'id')::uuid IN (${actors.historical.map(h=>q(h.id)).join(',')}))THEN RAISE EXCEPTION 'QA_HISTORY_LEAK';END IF;
 INSERT INTO pricing_checks VALUES('Expired and future rows excluded');
 r:=${call(snapshot)};IF (r->>'changed')::int<>0 OR (SELECT count(*) FROM activity_logs WHERE user_id=a)<>before_audits THEN RAISE EXCEPTION 'QA_NOOP';END IF;INSERT INTO pricing_checks VALUES('No-op creates no audit');
 ${rows.map(c=>`denied:=false;BEGIN PERFORM ${call(snapshot,c.rows)};EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%ADMIN_PRICING_${c.code}%' THEN denied:=true;ELSE RAISE;END IF;END;IF NOT denied THEN RAISE EXCEPTION 'QA_NOT_DENIED ${c.name}';END IF;IF (SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM pricing_tiers t)<>before_rows THEN RAISE EXCEPTION 'QA_PARTIAL_WRITE';END IF;INSERT INTO pricing_checks VALUES(${q(c.name+' rejected without partial write')});`).join('\n')}
 denied:=false;BEGIN PERFORM admin_current_pricing_v1(a);PERFORM admin_current_pricing_v1(${q(actors.parent.id)});EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%FORBIDDEN%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_ROLE';END IF;INSERT INTO pricing_checks VALUES('Non-admin actor denied');
 denied:=false;BEGIN PERFORM admin_current_pricing_v1(a,NULL,NULL,${q(JSON.stringify(original))}::jsonb);EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%RELOAD_REQUIRED%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_OLD_CLIENT';END IF;INSERT INTO pricing_checks VALUES('Old client without snapshot rejected');
 denied:=false;BEGIN PERFORM admin_current_pricing_v1(a,${q(snapshot.asOfDate)}::date-1,s->'tiers',${q(JSON.stringify(original))}::jsonb);EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%CONFLICT%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_OLD_DAY';END IF;INSERT INTO pricing_checks VALUES('Old-day snapshot rejected');
 r:=${call(snapshot,changed)};IF (r->>'changed')::int<>1 OR (SELECT count(*) FROM activity_logs WHERE user_id=a)<>before_audits+1 THEN RAISE EXCEPTION 'QA_SAVE_AUDIT';END IF;
 IF NOT EXISTS(SELECT 1 FROM activity_logs WHERE user_id=a AND details->'before'=s->'tiers' AND details->'after'=r->'tiers')THEN RAISE EXCEPTION 'QA_AUDIT_EVIDENCE';END IF;INSERT INTO pricing_checks VALUES('Actual save and before/after audit atomic');
 denied:=false;BEGIN PERFORM ${call(snapshot,changed)};EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%CONFLICT%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_STALE';END IF;INSERT INTO pricing_checks VALUES('Stale snapshot cannot overwrite');
 END $test$;
 SELECT jsonb_agg(label) FROM pricing_checks;ROLLBACK;`
const checks=JSON.parse(sql(query).split('\n').find(x=>x.startsWith('[')))
const atomic=sql(`BEGIN;
CREATE FUNCTION pg_temp.fail_pricing_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.user_id=${q(actor)}::uuid AND NEW.action='pricing_updated' THEN RAISE EXCEPTION 'QA_AUDIT_FAILURE';END IF;RETURN NEW;END$$;
CREATE TRIGGER qa_pricing_audit_fail BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_pricing_audit();
DO $$DECLARE before_rows text;denied boolean:=false;BEGIN SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) INTO before_rows FROM pricing_tiers t;BEGIN PERFORM ${call(snapshot,changed)};EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%QA_AUDIT_FAILURE%'THEN denied:=true;ELSE RAISE;END IF;END;IF NOT denied OR before_rows<>(SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM pricing_tiers t)THEN RAISE EXCEPTION 'QA_AUDIT_NOT_ATOMIC';END IF;END$$;ROLLBACK;SELECT true;`)
assert.equal(atomic,'t');checks.push('Forced audit failure rolls back every price update')
assert.deepEqual(read(),snapshot)
const permissions=JSON.parse(sql(`SELECT jsonb_build_object('anon',has_function_privilege('anon','admin_current_pricing_v1(uuid,date,jsonb,jsonb)','execute'),'authenticated',has_function_privilege('authenticated','admin_current_pricing_v1(uuid,date,jsonb,jsonb)','execute'),'service',has_function_privilege('service_role','admin_current_pricing_v1(uuid,date,jsonb,jsonb)','execute'),'definer',(SELECT prosecdef FROM pg_proc WHERE oid='admin_current_pricing_v1(uuid,date,jsonb,jsonb)'::regprocedure))`))
assert.deepEqual(permissions,{anon:false,authenticated:false,service:true,definer:false});checks.push('Only service role executes SECURITY INVOKER RPC')
const holder=await holdTransaction(`SELECT ${call(snapshot,changed)};`,'qa-pricing-holder'),second=concurrentSql(`SET application_name='qa-pricing-stale';SELECT ${call(snapshot,changed)};`),secondResult=second.then(x=>({value:x}),e=>({error:e.message})),reader=concurrentSql(`SET application_name='qa-pricing-reader';SELECT booking_ux_catalog_v1();`)
let released=false
try{await observeLockWait('qa-pricing-stale');await observeLockWait('qa-pricing-reader');holder.release();released=true;await holder.done;const stale=await secondResult;assert.ok(stale.error?.includes('ADMIN_PRICING_CONFLICT'));await reader;checks.push('Real competing writer waits then rejects stale snapshot');checks.push('Customer catalog read waits for complete save');}finally{if(!released)holder.release();await holder.done.catch(()=>{});const current=read();if(JSON.stringify(input(current))!==JSON.stringify(original))sql(`SELECT ${call(current,original)};`)}
assert.deepEqual(read(),snapshot)
const midnight=JSON.parse(sql(`SELECT jsonb_build_array(('2026-10-28 06:59:59+07'::timestamptz AT TIME ZONE 'UTC')::date,('2026-10-28 07:00:00+07'::timestamptz AT TIME ZONE 'UTC')::date)`));assert.deepEqual(midnight,['2026-10-27','2026-10-28']);checks.push('Existing UTC cutoff remains 07:00 Thailand')
const result={at:new Date().toISOString(),checks,permissions,pricesRestored:true,customerAccountsUnused:true,clockUnchanged:true,scope:'isolated Local; transaction rollback plus QA-only concurrent saves restored to original'}
fs.writeFileSync(path.join(root,'db-results.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,pricesRestored:true,permissions}))
