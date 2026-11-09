import assert from 'node:assert/strict'
import { fixture, account, session, evidence } from './helpers.mjs'
import { sql, q } from './runtime.mjs'
import { randomUUID } from 'node:crypto'

const f = fixture(), actor = await account('user', 'ทดสอบขอบวันและเรทกลางเดือน'), child = randomUUID()
sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},'เด็กขอบวัน Local','กลางเดือน')`)
const current = f.dates.today.slice(0, 7), next = f.dates.month
const clock = day => `${current}-${String(day).padStart(2, '0')}T12:00:00+07:00`
const defineClock = timestamp => `CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $clock$ SELECT ${q(timestamp)}::timestamptz $clock$; CREATE OR REPLACE FUNCTION public.task10_transaction_start_v1() RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog AS $clock$ SELECT ${q(timestamp)}::timestamptz $clock$;`
const quote = month => `public.task10_booking_policy_quote_v1(${q(actor.id)},${q(f.courses.kids_group)},${q(month + '-01')},'progressive',NULL)`
const checks = []
try {
  for (const [day, lessonMonth, regime] of [[15,current,'early'],[16,current,'late'],[16,next,'early']]) {
    const result = sql(`BEGIN;${defineClock(clock(day))} SELECT ${quote(lessonMonth)}->'catalog'->>'regime';ROLLBACK;`)
    assert.equal(result, regime); checks.push(`Bangkok day${day} lesson${lessonMonth} selects${regime}`)
  }
  const quantities = [[17,18,19,20],[21,22,23,24],[25]]
  const inputs = quantities.map(days => days.map(day => session(f, 'kids_group', `${current}-${day}`, child)))
  const result = sql(`BEGIN;${defineClock(clock(16))}
    DO $scenario$ DECLARE policy jsonb;baseline jsonb;input jsonb;result jsonb;ss jsonb;scoperev bigint;expected numeric;idx integer:=0;
    BEGIN
      FOR ss IN SELECT x FROM jsonb_array_elements(${q(JSON.stringify(inputs))}::jsonb) x LOOP
        idx:=idx+1;expected:=CASE WHEN idx=3 THEN 700 ELSE 2000 END;
        policy:=${quote(current)};
        SELECT to_jsonb(x) INTO baseline FROM progressive_legacy_baseline_v1(${q(actor.id)},${q(f.courses.kids_group)},${+current.slice(0,4)},${+current.slice(5)}) x;
        SELECT revision INTO scoperev FROM booking_pricing_scopes WHERE user_id=${q(actor.id)} AND course_type_id=${q(f.courses.kids_group)} AND lesson_year=${+current.slice(0,4)} AND lesson_month=${+current.slice(5)};
        input:=jsonb_build_object('purchasePolicyVersion',2,'learnerType','child','childId',${q(child)},'participants',jsonb_build_array(${q(child)}),'branchId',${q(f.branches[0])},'courseTypeId',${q(f.courses.kids_group)},'month',${+current.slice(5)},'year',${+current.slice(0,4)},'totalSessions',jsonb_array_length(ss),'sessions',ss,'expectedScopeRevision',coalesce(scoperev,0),'expectedLegacyBaselineSessions',(baseline->>'baseline_sessions')::integer,'expectedLegacyBaselineFingerprint',baseline->>'baseline_fingerprint','expectedPolicyFingerprint',policy->>'fingerprint');
        result:=booking_ux_create_v1(${q(actor.id)},gen_random_uuid(),input);
        IF (result->>'totalPrice')::numeric IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Late per-bill scenario % expected %, got %',idx,expected,result;END IF;
      END LOOP;
    END $scenario$;
    SELECT 'late-4-4-1=2000-2000-700';ROLLBACK;`)
  assert.equal(result, 'late-4-4-1=2000-2000-700'); checks.push(result)
  console.log(JSON.stringify({ passed: checks.length, evidence: evidence('clock-pass', { checks, note: 'Clock overrides and all scenario bills rolled back in the same transaction; real runtime clock retained.' }) }))
} catch (error) { evidence('clock-failed', { checks, error: String(error), stderr: String(error.stderr || '') }); throw error }

