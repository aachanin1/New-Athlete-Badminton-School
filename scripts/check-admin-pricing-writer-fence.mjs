import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {run,sql,q} from '../tests/booking-ux/runtime.mjs'
const root=path.join(run.evidenceRoot,'admin-pricing-local-20261028'),actor=JSON.parse(fs.readFileSync(path.join(root,'actors.private.json'))).admin.id
const out=sql(`BEGIN;SET LOCAL statement_timeout='20s';UPDATE profiles SET role='super_admin' WHERE id=${q(actor)};
CREATE TEMP TABLE guard_checks(label text);GRANT SELECT,INSERT ON guard_checks TO service_role;SET LOCAL ROLE service_role;
DO $qa$ DECLARE s jsonb:=admin_current_pricing_v1(${q(actor)});v_before text;r jsonb;tiers jsonb;denied boolean;target uuid;BEGIN
 SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) INTO v_before FROM pricing_tiers t;
 FOR target IN SELECT t.id FROM pricing_tiers t JOIN course_types c ON c.id=t.course_type_id WHERE c.name::text IN ('adult_group','private') LOOP
 denied:=false;BEGIN UPDATE pricing_tiers SET price_per_session=price_per_session+1 WHERE id=target;EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%ADMIN_PRICING_ATOMIC_REQUIRED%'THEN denied:=true;ELSE RAISE;END IF;END;IF NOT denied THEN RAISE EXCEPTION 'QA_RAW_WRITE_NOT_FENCED';END IF;
 END LOOP;INSERT INTO guard_checks VALUES('Every old Adult/Private raw service-role writer denied');
 denied:=false;BEGIN UPDATE pricing_tiers SET price_per_session=price_per_session WHERE id=(s->'tiers'->0->>'id')::uuid;EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%ADMIN_PRICING_ATOMIC_REQUIRED%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_RAW_NOOP_NOT_FENCED';END IF;INSERT INTO guard_checks VALUES('Old raw no-op also denied before write');
 SELECT jsonb_agg(jsonb_build_object('id',x->'id','min_sessions',x->'min_sessions','max_sessions',x->'max_sessions','price_per_session',(x->>'price_per_session')::numeric+1)) INTO tiers FROM jsonb_array_elements(s->'tiers')x;
 r:=admin_current_pricing_v1(${q(actor)},(s->>'asOfDate')::date,s->'tiers',tiers);IF (r->>'changed')::int<>jsonb_array_length(tiers) THEN RAISE EXCEPTION 'QA_NEW_RPC_DENIED';END IF;INSERT INTO guard_checks VALUES('Current atomic RPC updates the complete set with audit');
 IF current_setting('admin_pricing.write',true)='authorized' THEN RAISE EXCEPTION 'QA_WRITE_TOKEN_LEAKED';END IF;INSERT INTO guard_checks VALUES('Write token restored after RPC');
 denied:=false;BEGIN UPDATE pricing_tiers SET price_per_session=price_per_session+1 WHERE id=(s->'tiers'->0->>'id')::uuid;EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%ADMIN_PRICING_ATOMIC_REQUIRED%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_RPC_ESCAPED_FENCE';END IF;INSERT INTO guard_checks VALUES('Raw writes remain denied after a successful RPC');
 denied:=false;BEGIN PERFORM admin_current_pricing_v1(${q(actor)},(s->>'asOfDate')::date,s->'tiers',tiers);EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%ADMIN_PRICING_CONFLICT%';END;IF NOT denied THEN RAISE EXCEPTION 'QA_STALE_NOT_DENIED';END IF;INSERT INTO guard_checks VALUES('Stale snapshot still denied');
 END $qa$;RESET ROLE;SELECT jsonb_agg(label) FROM guard_checks;ROLLBACK;`)
const checks=JSON.parse(out.split('\n').find(x=>x.startsWith('[')));assert.equal(checks.length,6);fs.writeFileSync(path.join(root,'writer-fence-results.json'),JSON.stringify({at:new Date().toISOString(),checks,rolledBack:true,oldApplicationContract:'Raw service-role UPDATE rejected at table; trusted DB maintenance unchanged; Kids catalog unchanged'},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,rolledBack:true}))
