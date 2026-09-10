import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { INITIAL_LATE_KIDS_TIERS } from '../../src/lib/booking-pricing-policy'
import { concurrentLocalSql, holdLocalTransaction, createLocalAdmin, localSql, readTask10Fixture, seedTask10Family, setDisposableClock, setupTask10, sqlLiteral, task10MigrationHashes, uploadTask10Slip, protectedWalletFixture, raceFamilyWalletStore, type ProtectedWalletFixture, type FamilyFixture } from './local-supabase'

test.describe('Wallet corrective compatibility',()=>{
  // Only synthetic local rows. The reset verifies the disposable identity and
  // restores the original suite's inert controls, real clocks and inactive cron.
  test.afterAll(async()=>{ await setupTask10() })

  function walletCase(operation:'store'|'redeem',history:'used'|'ambiguous'|'clean'='used') {
    const f=readTask10Fixture()
    const c={parent:f.userId,child:randomUUID(),booking:randomUUID(),source:randomUUID(),credit:randomUUID(),
      history:randomUUID(),slot:randomUUID(),targetSlot:randomUUID(),template:randomUUID(),targetTemplate:randomUUID(),branch:f.branchId}
    // Unique times keep canonical template matching unambiguous across cases.
    const start=`12:${String(walletMinute++).padStart(2,'0')}:00`;const end='16:00:00'
    const sql=`INSERT INTO public.children(id,parent_id,full_name,date_of_birth) VALUES('${c.child}','${c.parent}','Wallet corrective fixture','2016-01-01');
      INSERT INTO public.bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
        VALUES('${c.booking}','${c.parent}','child','${c.child}','${c.branch}','${f.kidsCourseId}',9,2051,1,700,'verified');
      INSERT INTO public.schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES
        ('${c.template}','${c.branch}','${f.kidsCourseId}',extract(dow FROM date '2051-09-10'),'${start}','${end}',true),
        ('${c.targetTemplate}','${c.branch}','${f.kidsCourseId}',extract(dow FROM date '2051-09-12'),'${start}','${end}',true);
      INSERT INTO public.schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status) VALUES
        ('${c.slot}','${c.template}','${c.branch}','${f.kidsCourseId}','2051-09-10','${start}','${end}',6,0,'open'),
        ('${c.targetSlot}','${c.targetTemplate}','${c.branch}','${f.kidsCourseId}','2051-09-12','${start}','${end}',6,0,'open');
      INSERT INTO public.booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
        VALUES('${c.source}','${c.booking}','${c.slot}','2051-09-10','${start}','${end}','${c.branch}','${c.child}','${operation==='store'?'scheduled':'walleted'}',false);
      ${history==='used'?`INSERT INTO public.booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
        VALUES('${c.history}','${c.booking}','${c.slot}','2051-09-10','${start}','${end}','${c.branch}','${c.child}','completed',true,'${c.source}');`:''}
      ${history==='ambiguous'?`UPDATE public.booking_sessions SET rescheduled_from_id=id WHERE id='${c.source}';`:''}
      ${operation==='redeem'?`INSERT INTO public.lesson_wallet_credits(id,user_id,booking_id,original_session_id,child_id,branch_id,course_type_id,original_schedule_slot_id,
        original_date,original_start_time,original_end_time,status,expires_at) VALUES('${c.credit}','${c.parent}','${c.booking}','${c.source}','${c.child}','${c.branch}',
        '${f.kidsCourseId}','${c.slot}','2051-09-10','${start}','${end}','active','2051-09-30T23:59:59.999+07:00');`:''}`
    const args=operation==='store'?{p_user_id:c.parent,p_session_id:c.source,p_actor_id:c.parent}:
      {p_user_id:c.parent,p_credit_id:c.credit,p_target_date:'2051-09-12',p_start_time:start,p_end_time:end,p_branch_id:c.branch,p_schedule_template_id:c.targetTemplate}
    const params=operation==='store'?`'${c.parent}','${c.source}','${c.parent}'`:
      `'${c.parent}','${c.credit}','2051-09-12','${start}','${end}','${c.branch}','${c.targetTemplate}'`
    const rpc=`lesson_wallet_${operation}_v2`
    const snapshot=`SELECT jsonb_build_object(
      'sourceStatus',(SELECT status FROM public.booking_sessions WHERE id='${c.source}'),
      'credits',(SELECT count(*) FROM public.lesson_wallet_credits WHERE booking_id='${c.booking}'),
      'creditStatuses',(SELECT jsonb_agg(status ORDER BY status) FROM public.lesson_wallet_credits WHERE booking_id='${c.booking}'),
      'members',(SELECT count(*) FROM public.lesson_wallet_credit_members m JOIN public.lesson_wallet_credits w ON w.id=m.credit_id WHERE w.booking_id='${c.booking}'),
      'descendants',(SELECT count(*) FROM public.booking_sessions WHERE booking_id='${c.booking}' AND rescheduled_from_id='${c.source}' AND NOT is_makeup AND id<>'${c.source}'),
      'history',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'is_makeup',is_makeup,'predecessor',rescheduled_from_id)) FROM public.booking_sessions WHERE id='${c.history}'),
      'payments',(SELECT count(*) FROM public.payments WHERE booking_id='${c.booking}'),
      'mutations',(SELECT count(*) FROM public.task10_source_mutations WHERE source_session_id='${c.source}'))`
    return {...c,sql,args,params,rpc,snapshot}
  }
  let walletMinute=0
  const never=`UPDATE public.task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;`
  const seed=(sql:string)=>localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); ${never} ${sql} COMMIT;`)
  const artifact=()=>({sourceSha:'a'.repeat(40),deploymentId:'dpl_local_wallet_corrective',targetProjectRef:'verified-local-disposable',
    migrationHashes:task10MigrationHashes(),productionPromotionConfirmed:true,healthChecksPassed:true})

  for(const operation of ['store','redeem'] as const) for(const history of ['used','ambiguous'] as const) {
    test(`never_activated original ${operation} RPC matches preserved behavior with ${history} historical lineage`,async()=>{
      const c=walletCase(operation,history);seed(c.sql)
      const before=localSql(c.snapshot)
      const baseline=localSql(`BEGIN; SELECT public.task10_previous_wallet_${operation}_v2(${c.params}); ${c.snapshot}; ROLLBACK;`).split('\n').map(line=>JSON.parse(line))
      expect(baseline[0]).toMatchObject({participant_count:1})
      expect(localSql(c.snapshot)).toBe(before)
      const result=await createLocalAdmin().rpc(c.rpc,c.args)
      expect(result.error,JSON.stringify(result.error)).toBeNull()
      expect(result.data).toMatchObject({participant_count:1,original_date:'2051-09-10'})
      expect(JSON.parse(localSql(c.snapshot))).toEqual(baseline[1])
      expect(localSql('SELECT public.task10_source_policy_established_v1();')).toBe('f')
    })
  }

  test('never_activated Wallet uses the preserved transaction clock at before/exact/after 48h',()=>{
    // Do not fake task10_clock_v1 to test the old body's cutoff: that body reads
    // transaction_timestamp(). Construct source date/time from that SAME DB tx.
    for(const delta of [-1,0,1]) for(const previous of [true,false]) {
      const c=walletCase('store','clean')
      const functionName=previous?'task10_previous_wallet_store_v2':'lesson_wallet_store_v2'
      const result=JSON.parse(localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); ${never} ${c.sql}
        UPDATE public.schedule_slots SET date=((transaction_timestamp()+interval '48 hours'+interval '${delta} milliseconds') AT TIME ZONE 'Asia/Bangkok')::date,
          start_time=((transaction_timestamp()+interval '48 hours'+interval '${delta} milliseconds') AT TIME ZONE 'Asia/Bangkok')::time,end_time='24:00' WHERE id='${c.slot}';
        UPDATE public.booking_sessions s SET date=x.date,start_time=x.start_time,end_time=x.end_time FROM public.schedule_slots x WHERE s.id='${c.source}' AND x.id=s.schedule_slot_id;
        CREATE TEMP TABLE corrective_outcome(result jsonb,error text) ON COMMIT DROP;
        DO $test$ BEGIN BEGIN INSERT INTO corrective_outcome(result) SELECT public.${functionName}(${c.params});
          EXCEPTION WHEN OTHERS THEN INSERT INTO corrective_outcome(error) VALUES(SQLERRM); END; END $test$;
        SELECT jsonb_build_object('error',(SELECT error FROM corrective_outcome),'participants',(SELECT result->'participant_count' FROM corrective_outcome),
          'deltaMs',(SELECT extract(epoch FROM ((date+start_time) AT TIME ZONE 'Asia/Bangkok'-transaction_timestamp()-interval '48 hours'))*1000 FROM public.booking_sessions WHERE id='${c.source}'),
          'credits',(SELECT count(*) FROM public.lesson_wallet_credits WHERE booking_id='${c.booking}'),
          'sourceStatus',(SELECT status FROM public.booking_sessions WHERE id='${c.source}')); ROLLBACK;`).split('\n').filter(Boolean).at(-1)!)
      expect(result).toEqual({deltaMs:delta,error:delta>0?null:'LESSON_WALLET_UNIT_NOT_STORABLE',participants:delta>0?1:null,credits:delta>0?1:0,sourceStatus:delta>0?'walleted':'scheduled'})
    }
  })

  test('active and paused retain source guards for Wallet, Reschedule and Return without evidence changes',async()=>{
    for(const state of ['active','paused']) for(const operation of ['store','redeem'] as const) {
      const c=walletCase(operation);seed(c.sql)
      localSql(`UPDATE public.task10_policy_activation SET state='${state}',effective_at='2051-09-01T00:00:00+07:00',revision=1;
        INSERT INTO public.task10_wallet_transition_evidence(credit_id,source_month,source_root_id,effective_at,original_expires_at,evidence)
        SELECT id,'2051-09-01',original_session_id,'2051-09-01T00:00:00+07:00',expires_at,'{"correctiveFixture":true}' FROM public.lesson_wallet_credits WHERE id='${c.credit}';`)
      const before=localSql(`${c.snapshot}; SELECT row_to_json(a) FROM public.task10_policy_activation a;
        SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY credit_id),'[]') FROM public.task10_wallet_transition_evidence e;`)
      const denied=await createLocalAdmin().rpc(c.rpc,c.args)
      expect(denied.error?.message).toContain('TASK10_SOURCE_ALREADY_USED')
      expect(()=>localSql(`SELECT public.task10_reschedule_kids_v1('${c.parent}','${c.source}','2051-09-12','12:00','16:00','${c.branch}','${c.targetTemplate}');`)).toThrow('TASK10_SOURCE_ALREADY_USED')
      expect(()=>localSql(`SELECT public.task10_return_kids_entitlement_v1('${readTask10Fixture().makeupAdminId}','${c.source}','corrective guard verification');`)).toThrow('TASK10_SOURCE_ALREADY_USED')
      expect(localSql(`${c.snapshot}; SELECT row_to_json(a) FROM public.task10_policy_activation a;
        SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY credit_id),'[]') FROM public.task10_wallet_transition_evidence e;`)).toBe(before)
    }
  })

  test('active and paused allow eligible Wallet Store/Redeem once and preserve the original bodies',async()=>{
    expect(localSql(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.task10_previous_wallet_store_v2(uuid,uuid,uuid)'::regprocedure;`)).toBe('44b9f1eb00b66be46b2e1c07083210c8')
    expect(localSql(`SELECT md5(prosrc) FROM pg_proc WHERE oid='public.task10_previous_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid)'::regprocedure;`)).toBe('45df8f5e780c065928f3bc77a5a77997')
    for(const state of ['active','paused']) {
      const c=walletCase('store','clean');seed(c.sql)
      localSql(`UPDATE public.task10_policy_activation SET state='${state}',effective_at='2026-09-01T00:00:00+07:00',revision=1;`)
      const client=createLocalAdmin();const stored=await client.rpc(c.rpc,c.args)
      expect(stored.error).toBeNull()
      expect(stored.data).toMatchObject({participant_count:1,policy_type:'same_month'})
      const again=await client.rpc(c.rpc,c.args)
      expect(again.error?.message).toBe('LESSON_WALLET_UNIT_NOT_STORABLE')
      const args={p_user_id:c.parent,p_credit_id:stored.data.credit_id,p_target_date:'2051-09-12',
        p_start_time:stored.data.original_start_time,p_end_time:stored.data.original_end_time,p_branch_id:c.branch,p_schedule_template_id:c.targetTemplate}
      const redeemed=await client.rpc('lesson_wallet_redeem_v2',args)
      expect(redeemed.error).toBeNull()
      expect(redeemed.data).toMatchObject({participant_count:1,credit_id:stored.data.credit_id})
      const before=localSql(c.snapshot)
      expect((await client.rpc('lesson_wallet_redeem_v2',args)).error?.message).toBe('LESSON_WALLET_CREDIT_STALE')
      expect(localSql(c.snapshot)).toBe(before)
      expect(JSON.parse(before)).toMatchObject({credits:1,members:1,descendants:1,creditStatuses:['redeemed'],payments:0})
    }
  })

  test('Wallet commit precedes activation and invalidates a stale manifest; activation commit precedes waiting Wallet guards',async()=>{
    test.setTimeout(180_000)
    setDisposableClock('2051-09-01T00:00:00+07:00')
    const f=readTask10Fixture();const release=sqlLiteral(JSON.stringify(artifact()))
    for(const operation of ['store','redeem'] as const) {
      const c=walletCase(operation,'clean');seed(c.sql)
      const manifest=localSql(`SELECT public.task10_activation_manifest_v1('${f.adminUserId}',${release}::jsonb);`)
      const holder=await holdLocalTransaction(`SELECT public.${c.rpc}(${c.params});`,`corrective-wallet-holder-${randomUUID()}`)
      const app=`corrective-activation-wait-${randomUUID()}`
      const pending=concurrentLocalSql(`SET application_name='${app}'; SELECT public.task10_activate_v1('${f.adminUserId}',${sqlLiteral(manifest)}::jsonb);`).then(value=>({value,error:''}),error=>({value:'',error:String(error)}))
      try {
        await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event='advisory';`)).toBe('1')
      } finally { await holder.finish() }
      expect((await pending).error).toContain('TASK10_MANIFEST_CHANGED')
      expect(localSql('SELECT state FROM public.task10_policy_activation;')).toBe('never_activated')
      expect(localSql('SELECT count(*) FROM public.task10_activation_events;')).toBe('0')
    }
    const cases=(['store','redeem'] as const).map(operation=>walletCase(operation))
    seed(cases.map(c=>c.sql).join('\n'))
    const holder=await holdLocalTransaction(`SELECT public.task10_activate_v1('${f.adminUserId}',public.task10_activation_manifest_v1('${f.adminUserId}',${release}::jsonb));
      SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';`,`corrective-activation-holder-${randomUUID()}`)
    const waiters=cases.map(c=>{
      const before=localSql(c.snapshot);const app=`corrective-wallet-wait-${randomUUID()}`
      const pending=concurrentLocalSql(`SET application_name='${app}'; SELECT public.${c.rpc}(${c.params});`).then(value=>({value,error:''}),error=>({value:'',error:String(error)}))
      return {c,before,app,pending}
    })
    try {
      for(const waiter of waiters) await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${waiter.app}' AND wait_event='advisory';`)).toBe('1')
    } finally { await holder.finish() }
    for(const waiter of waiters) {
      expect((await waiter.pending).error).toContain('TASK10_SOURCE_ALREADY_USED')
      expect(localSql(waiter.c.snapshot)).toBe(waiter.before)
    }
    expect(localSql('SELECT state FROM public.task10_policy_activation;')).toBe('active')
    expect(localSql("SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")).toBe('f')
  })
})

test.describe('Family Wallet lock correction', () => {
  test.afterAll(async () => { await setupTask10() })
  const never = `UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,revision=0,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;`
  const prepare = (c: ProtectedWalletFixture, state: string, fixtureSql = '') => localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); ${never} ${c.seed} ${fixtureSql}
    ${state === 'never_activated' ? '' : `UPDATE task10_policy_activation SET state='${state}',effective_at=transaction_timestamp(),revision=1,pricing_enabled=${state === 'active'},makeup_enabled=${state === 'active'};`} COMMIT;`)
  const expected = (c: ProtectedWalletFixture, redeemed = false) => ({ credits:1, members:c.children.length, memberIdentity:true,
    walleted:c.children.length, otherScheduled:c.others.length, descendants:redeemed ? c.children.length : 0, childIdentity:true,
    targetSlots:redeemed ? 1 : 0, orphanCredits:0 })

  for (const state of ['never_activated', 'active', 'paused']) {
    for (const different of [false, true]) test(`${state}: ${different ? 'different-participant direct RPC' : 'same representative button duplicate'} Store race is atomic with typed loser`, async () => {
      const c = await protectedWalletFixture(readTask10Fixture()); prepare(c, state)
      const evidenceBefore = localSql('SELECT to_jsonb(a) FROM task10_policy_activation a; SELECT count(*) FROM task10_source_mutations;')
      const proof = await raceFamilyWalletStore(c, different)
      await test.info().attach('family-store-race.json', { body:Buffer.from(JSON.stringify(proof,null,2)), contentType:'application/json' })
      expect(proof.barrierReached, JSON.stringify(proof)).toBe(true)
      // Assert committed state and finance even if the error contract is wrong.
      expect(proof.snapshot).toEqual(expected(c))
      expect(proof.invariantsUnchanged).toBe(true)
      expect(proof.results.filter(r => !r.error)).toHaveLength(1)
      expect(proof.results.find(r => r.error)?.error).toContain('LESSON_WALLET_UNIT_NOT_STORABLE')
      expect(proof.results.some(r => /deadlock detected|lock timeout|statement timeout/.test(r.error))).toBe(false)
      expect(localSql('SELECT to_jsonb(a) FROM task10_policy_activation a; SELECT count(*) FROM task10_source_mutations;')).toBe(evidenceBefore)

      const credit = JSON.parse(proof.results.find(r => !r.error)!.output).credit_id as string
      const before = localSql(c.invariants)
      const args = { p_user_id:c.userId, p_credit_id:credit, p_target_date:c.dates.target, p_start_time:c.start,
        p_end_time:c.end, p_branch_id:c.branch, p_schedule_template_id:c.targetTemplate }
      const replays = await Promise.all([createLocalAdmin().rpc('lesson_wallet_redeem_v2', args), createLocalAdmin().rpc('lesson_wallet_redeem_v2', args)])
      expect(JSON.parse(localSql(c.snapshot))).toEqual(expected(c, true))
      expect(localSql(c.invariants)).toBe(before)
      expect(replays.filter(r => !r.error)).toHaveLength(1)
      expect(replays.find(r => r.error)?.error?.message).toBe('LESSON_WALLET_CREDIT_STALE')
    })

    test(`${state}: original Adult/Private Store and Redeem retain single/package expiry and participant identity`, async () => {
      test.setTimeout(180_000) // Four isolated API/DB fixtures, each with identity verification.
      for (const privateLesson of [false, true]) for (const quantity of [1, 2]) {
        const c = await protectedWalletFixture(readTask10Fixture(), privateLesson, quantity); prepare(c, state)
        const before = localSql(c.invariants)
        const stored = await createLocalAdmin().rpc('lesson_wallet_store_v2', { p_user_id:c.userId, p_session_id:c.sources[0], p_actor_id:c.userId })
        expect(stored.error).toBeNull()
        expect(stored.data).toMatchObject({ participant_count:c.children.length, policy_type:quantity > 1 ? 'ten_month_package' : 'same_month' })
        expect(localSql(`SELECT expires_at=CASE WHEN ${quantity}>1 THEN
          (date_trunc('month',entitlement_started_at AT TIME ZONE 'Asia/Bangkok')+interval '10 months') AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond'
          ELSE (date_trunc('month',original_date::timestamp)+interval '1 month') AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond' END
          FROM lesson_wallet_credits WHERE id='${stored.data.credit_id}';`)).toBe('t')
        const redeemed = await createLocalAdmin().rpc('lesson_wallet_redeem_v2', { p_user_id:c.userId, p_credit_id:stored.data.credit_id,
          p_target_date:c.dates.target, p_start_time:c.start, p_end_time:c.end, p_branch_id:c.branch, p_schedule_template_id:c.targetTemplate })
        expect(redeemed.error).toBeNull()
        expect(JSON.parse(localSql(c.snapshot))).toEqual(expected(c, true))
        expect(localSql(c.invariants)).toBe(before)
      }
    })

    test(`${state}: missing payment and one attended Family member still deny the entire Store without residue`, async () => {
      for (const privateLesson of [false, true]) {
        const f = readTask10Fixture(); const c = await protectedWalletFixture(f, privateLesson)
        // Construct missing evidence while the disposable fixture is inert;
        // payment lifecycle guards must remain in force during the real RPC.
        prepare(c, state, `DELETE FROM payments WHERE id='${c.payment}';`)
        const before = localSql(`${c.snapshot}; ${c.invariants};`)
        const result = await createLocalAdmin().rpc('lesson_wallet_store_v2', {p_user_id:c.userId,p_session_id:c.sources[0],p_actor_id:c.userId})
        expect(result.error?.message).toBe('LESSON_WALLET_PAYMENT_EVIDENCE_MISSING')
        expect(localSql(`${c.snapshot}; ${c.invariants};`)).toBe(before)
      }
      const f = readTask10Fixture(); const c = await protectedWalletFixture(f)
      prepare(c, state, `INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status)
        VALUES('${c.sources[1]}','${c.childId}','child','${f.adminUserId}','present');`)
      const before = localSql(`${c.snapshot}; ${c.invariants};`)
      const result = await createLocalAdmin().rpc('lesson_wallet_store_v2', {p_user_id:c.userId,p_session_id:c.sources[0],p_actor_id:c.userId})
      expect(result.error?.message).toBe('LESSON_WALLET_ATTENDANCE_EXISTS')
      expect(localSql(`${c.snapshot}; ${c.invariants};`)).toBe(before)
    })

    test(`${state}: Family Store another purchased hour and Redeem an existing credit both commit without a lock cycle`, async () => {
      const c = await protectedWalletFixture(readTask10Fixture()); prepare(c, state)
      const stored = JSON.parse(localSql(`SELECT lesson_wallet_store_v2(${c.storeArgs()});`))
      const before = localSql(c.financialInvariants)
      const holder = await holdLocalTransaction(`SELECT id FROM bookings WHERE id='${c.booking}' FOR UPDATE;`, `mixed-wallet-holder-${randomUUID()}`)
      const names = [`mixed-wallet-store-${randomUUID()}`, `mixed-wallet-redeem-${randomUUID()}`]
      const calls = [
        `SELECT lesson_wallet_store_v2(${c.storeArgs(c.others[0])});`,
        `SELECT lesson_wallet_redeem_v2(${c.redeemArgs(stored.credit_id)});`,
      ].map((sql, i) => concurrentLocalSql(`SET application_name='${names[i]}'; SET statement_timeout='45s'; ${sql}`)
        .then(output => ({output,error:''}), error => ({output:'',error:String(error)})))
      try {
        await expect.poll(() => localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('${names.join("','")}') AND wait_event_type='Lock';`)).toBe('2')
      } finally { await holder.finish() }
      const results = await Promise.all(calls)
      expect(results.map(r => r.error)).toEqual(['', ''])
      expect(JSON.parse(localSql(c.snapshot))).toEqual({...expected(c, true), credits:2, otherScheduled:0})
      // The second original hour intentionally becomes walleted in this test.
      expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members m JOIN lesson_wallet_credits w ON w.id=m.credit_id WHERE w.booking_id='${c.booking}';`)).toBe('4')
      expect(localSql(`SELECT total_sessions FROM bookings WHERE id='${c.booking}';`)).toBe('2')
      expect(localSql(c.financialInvariants)).toBe(before)
    })
  }

  test('Family Store/Redeem coordinate with actual activation in both transaction orders', async () => {
    test.setTimeout(240_000)
    const f = readTask10Fixture()
    const release = sqlLiteral(JSON.stringify({sourceSha:'a'.repeat(40),deploymentId:'dpl_local_family_lock',targetProjectRef:'verified-local-disposable',
      migrationHashes:task10MigrationHashes(),productionPromotionConfirmed:true,healthChecksPassed:true}))
    for (const activationFirst of [false, true]) {
      const store = await protectedWalletFixture(f); prepare(store, 'never_activated')
      const redeem = await protectedWalletFixture(f); prepare(redeem, 'never_activated')
      const credit = JSON.parse(localSql(`SELECT lesson_wallet_store_v2(${redeem.storeArgs()});`)).credit_id as string
      const work = [{c:store,sql:`SELECT lesson_wallet_store_v2(${store.storeArgs()});`,redeemed:false},
        {c:redeem,sql:`SELECT lesson_wallet_redeem_v2(${redeem.redeemArgs(credit)});`,redeemed:true}]
      const before = work.map(w => localSql(w.c.invariants))
      const manifest = localSql(`SELECT task10_activation_manifest_v1('${f.adminUserId}',${release}::jsonb);`)
      const activate = `SELECT task10_activate_v1('${f.adminUserId}',${sqlLiteral(manifest)}::jsonb);`
      if (activationFirst) {
        const holder = await holdLocalTransaction(`${activate} SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';`, `family-activation-${randomUUID()}`)
        const names = work.map(() => `family-activation-wait-${randomUUID()}`)
        const calls = work.map((w,i) => concurrentLocalSql(`SET application_name='${names[i]}'; SET statement_timeout='45s'; ${w.sql}`)
          .then(output => ({output,error:''}), error => ({output:'',error:String(error)})))
        try {
          for (const name of names) await expect.poll(() => localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='advisory';`)).toBe('1')
        } finally { await holder.finish() }
        expect((await Promise.all(calls)).map(r => r.error)).toEqual(['',''])
        expect(localSql('SELECT state FROM task10_policy_activation;')).toBe('active')
      } else {
        const holders = []
        for (const w of work) holders.push(await holdLocalTransaction(w.sql, `family-before-activation-${randomUUID()}`))
        const name = `family-activation-wait-${randomUUID()}`
        // Execute the real activation after Wallet commit, then roll it back so
        // the reverse ordering can exercise the actual initial cutover too.
        const pending = concurrentLocalSql(`SET application_name='${name}'; BEGIN; SET LOCAL statement_timeout='45s'; ${activate} ROLLBACK;`)
          .then(output => ({output,error:''}), error => ({output:'',error:String(error)}))
        try {
          await expect.poll(() => localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='advisory';`)).toBe('1')
        } finally { for (const holder of holders) await holder.finish() }
        expect((await pending).error).toBe('')
        expect(localSql('SELECT state FROM task10_policy_activation;')).toBe('never_activated')
      }
      for (const [i,w] of work.entries()) {
        expect(JSON.parse(localSql(w.c.snapshot))).toEqual(expected(w.c,w.redeemed))
        expect(localSql(w.c.invariants)).toBe(before[i])
      }
      expect(localSql("SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")).toBe('f')
    }
  })
})

test('Migration and catalog/settings saves never activate policy', async () => {
  expect(JSON.parse(localSql('SELECT row_to_json(a) FROM public.task10_policy_activation a;'))).toMatchObject({
    state:'never_activated', effective_at:null, pricing_enabled:false, makeup_enabled:false, expiry_enabled:false,
  })
  const fixture = readTask10Fixture()
  const read = await createLocalAdmin().rpc('task10_read_makeup_setting_v1',{p_actor_id:fixture.adminUserId})
  expect(read.error).toBeNull()
  expect(read.data).toMatchObject({minimum:2,revision:1})
  expect(JSON.parse(localSql("SELECT jsonb_build_object('active',active,'schedule',schedule) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';"))).toEqual({active:false,schedule:'* * * * *'})
})

test('Owner-only actual-clock activation checks manifest; pause/resume retain cutover and roll back cleanly',async()=>{
  const f=readTask10Fixture();const client=createLocalAdmin()
  setDisposableClock('2031-07-31T18:00:00+07:00')
  const artifact={sourceSha:'a'.repeat(40),deploymentId:'dpl_local_disposable_fixture',targetProjectRef:'verified-local-disposable',
    migrationHashes:task10MigrationHashes(),productionPromotionConfirmed:true,healthChecksPassed:true}
  const read=await client.rpc('task10_activation_manifest_v1',{p_actor_id:f.adminUserId,p_artifact:artifact})
  expect(read.error).toBeNull()
  expect(read.data.excluded).toContainEqual(expect.objectContaining({bookingId:f.lifecycle!.oldOverdue,reason:'already_overdue'}))
  const denied=await client.rpc('task10_activate_v1',{p_actor_id:f.adminUserId,p_expected_manifest:read.data})
  expect(denied.error?.code).toBe('42501')
  const changed={...read.data,artifact:{...artifact,deploymentId:'dpl_tampered_fixture'}}
  expect(()=>localSql(`BEGIN; SELECT public.task10_activate_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(changed))}::jsonb); ROLLBACK;`)).toThrow('TASK10_MANIFEST_CHANGED')
  const results=localSql(`BEGIN;
    SELECT public.task10_activate_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(read.data))}::jsonb);
    SELECT public.task10_pause_v1('${f.adminUserId}',1,true,${sqlLiteral(JSON.stringify(artifact))}::jsonb);
    SELECT public.task10_run_expiry_v1(50);
    SELECT public.task10_pause_v1('${f.adminUserId}',2,false,${sqlLiteral(JSON.stringify(artifact))}::jsonb);
    SELECT jsonb_build_object('oldOverdueCohort',(SELECT count(*) FROM public.task10_booking_expiry_cohort WHERE booking_id='${f.lifecycle!.oldOverdue}'),
      'events',(SELECT count(*) FROM public.task10_activation_events)); ROLLBACK;`).split('\n').map((line)=>JSON.parse(line))
  expect(results[0]).toMatchObject({state:'active',effectiveAt:'2031-07-31T11:00:00+00:00'})
  expect(results[1]).toMatchObject({state:'paused',effectiveAt:results[0].effectiveAt,expiryEnabled:false})
  expect(results[2]).toMatchObject({status:'inactive',cancelled:0})
  expect(results[3]).toMatchObject({state:'active',effectiveAt:results[0].effectiveAt})
  expect(results[4]).toEqual({oldOverdueCohort:0,events:3})
  expect(localSql('SELECT state FROM public.task10_policy_activation;')).toBe('never_activated')
})

test('Actual concurrent settings transactions: one winner, stale editor conflicts, replay retains result', async () => {
  const actor = readTask10Fixture().adminUserId
  const client = createLocalAdmin()
  const before = await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:actor})
  expect(before.error).toBeNull()
  const commands = [3,4].map((minimum) => ({p_actor_id:actor,p_minimum:minimum,p_expected_revision:before.data.revision,p_request_id:randomUUID()}))
  const results = await Promise.all(commands.map((args) => client.rpc('task10_save_makeup_setting_v1',args)))
  expect(results.filter((r) => !r.error)).toHaveLength(1)
  expect(results.find((r) => r.error)?.error?.message).toContain('TASK10_REVISION_CONFLICT')
  const index = results.findIndex((r) => !r.error)
  const winner = results[index].data
  const next = await client.rpc('task10_save_makeup_setting_v1',{p_actor_id:actor,p_minimum:2,p_expected_revision:winner.revision,p_request_id:randomUUID()})
  expect(next.error).toBeNull()
  const replay = await client.rpc('task10_save_makeup_setting_v1',commands[index])
  expect(replay.error).toBeNull()
  expect(replay.data).toEqual(winner)
  const actual = await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:actor})
  expect(actual.data).toEqual(next.data)
})

test('Ordinary Admin denied settings writes; direct update/rename/delete blocked', async () => {
  const fixture = readTask10Fixture(); const client = createLocalAdmin()
  const saved = await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:fixture.adminUserId})
  const denied = await client.rpc('task10_save_makeup_setting_v1',{p_actor_id:fixture.makeupAdminId,p_minimum:5,p_expected_revision:saved.data.revision,p_request_id:randomUUID()})
  expect(denied.error?.message).toContain('TASK10_UNAUTHORIZED')
  const before = localSql("SELECT value FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions';")
  for (const sql of [
    "UPDATE public.system_settings SET value='{\"minimum\":0}' WHERE key='kids_makeup_destination_minimum_sessions';",
    "UPDATE public.system_settings SET key='bypass' WHERE key='kids_makeup_destination_minimum_sessions';",
    "DELETE FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions';",
    "INSERT INTO public.system_settings(key,value) VALUES('kids_makeup_destination_minimum_sessions','{}');",
  ]) expect(() => localSql(`BEGIN; SET LOCAL ROLE service_role; ${sql} ROLLBACK;`)).toThrow('TASK10_GUARDED_SETTING')
  expect(localSql("SELECT value FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions';")).toBe(before)
})

test('Catalogs save independently, reject partial/overlapping sets and conflicting editors', async () => {
  const fixture=readTask10Fixture(); const client=createLocalAdmin()
  const read=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:fixture.adminUserId})
  expect(read.error).toBeNull()
  const early=read.data.early; const late=read.data.late
  const invalid=await client.rpc('task10_save_pricing_catalog_v1',{p_actor_id:fixture.adminUserId,p_regime:'late',p_expected_revision:late.revision,p_tiers:late.tiers.slice(1)})
  expect(invalid.error?.message).toContain('TASK10_INVALID_REQUEST')
  const params={p_actor_id:fixture.adminUserId,p_regime:'late',p_expected_revision:late.revision,p_tiers:late.tiers}
  const results=await Promise.all([client.rpc('task10_save_pricing_catalog_v1',params),client.rpc('task10_save_pricing_catalog_v1',params)])
  expect(results.filter((r)=>!r.error)).toHaveLength(1)
  expect(results.find((r)=>r.error)?.error?.message).toContain('TASK10_REVISION_CONFLICT')
  const after=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:fixture.adminUserId})
  expect(after.data.early).toEqual(early)
  expect(after.data.late.revision).toBe(late.revision+1)
  expect(localSql(`SELECT count(*) FROM public.task10_pricing_catalog_versions WHERE id='${late.versionId}';`)).toBe('1')
})

test('Legacy atomic creation/edit/cancel keeps package pricing, Family participants, replay and coupon history',async()=>{
  const f=readTask10Fixture();const client=createLocalAdmin();setDisposableClock('2033-03-01T10:00:00+07:00')
  localSql(`INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from,valid_to)
    VALUES('${f.adultCourseId}',10,10,550,5500,'2033-03-01','2033-03-31'),('${f.privateCourseId}',10,10,800,8000,'2033-03-01','2033-03-31');`)
  localSql(`INSERT INTO public.schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
    SELECT '${f.branchId}',c,d,'10:00','11:00',true FROM unnest(ARRAY['${f.adultCourseId}'::uuid,'${f.privateCourseId}'::uuid]) c CROSS JOIN generate_series(0,6) d
    WHERE NOT EXISTS(SELECT 1 FROM public.schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id=c AND day_of_week=d AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  const sessions=(count:number,childId:string|null=null)=>Array.from({length:count},(_,i)=>({date:`2033-03-${String(10+i).padStart(2,'0')}`,startTime:'10:00',endTime:'11:00',branchId:f.branchId,childId}))
  const base={learnerType:'self',childId:null,branchId:f.branchId,courseTypeId:f.adultCourseId,month:3,year:2033,totalSessions:10,totalAmount:5500,expectedTotalPrice:5500,sessions:sessions(10)}
  const args={p_user_id:f.userId,p_action:'create',p_request_id:randomUUID(),p_input:base}
  const created=await client.rpc('task10_write_legacy_booking_v1',args);expect(created.error).toBeNull()
  const replay=await client.rpc('task10_write_legacy_booking_v1',args);expect(replay.error).toBeNull();expect(replay.data).toMatchObject({...created.data,idempotentReplay:true})
  const id=created.data.bookingId
  const before=localSql(`SELECT jsonb_build_object('book',(SELECT to_jsonb(b) FROM bookings b WHERE id='${id}'),'sessions',(SELECT jsonb_agg(s ORDER BY id) FROM booking_sessions s WHERE booking_id='${id}'));`)
  const invalid=await client.rpc('task10_write_legacy_booking_v1',{...args,p_action:'update',p_request_id:randomUUID(),p_input:{...base,bookingId:id,sessions:[...sessions(9),{...sessions(1)[0],date:'2033-03-29',startTime:'03:00',endTime:'04:00'}]}})
  expect(invalid.error?.message).toContain('TASK10_INVALID_TEMPLATE')
  expect(localSql(`SELECT jsonb_build_object('book',(SELECT to_jsonb(b) FROM bookings b WHERE id='${id}'),'sessions',(SELECT jsonb_agg(s ORDER BY id) FROM booking_sessions s WHERE booking_id='${id}'));`)).toBe(before)
  const edited=await client.rpc('task10_write_legacy_booking_v1',{...args,p_action:'update',p_request_id:randomUUID(),p_input:{...base,bookingId:id,totalSessions:1,totalAmount:500,expectedTotalPrice:500,sessions:sessions(1)}})
  expect(edited.error).toBeNull();expect(edited.data.totalPrice).toBe(500)
  const cancel={...args,p_action:'cancel',p_request_id:randomUUID(),p_input:{bookingId:id}}
  const cancelled=await client.rpc('task10_write_legacy_booking_v1',cancel);expect(cancelled.error).toBeNull()
  expect((await client.rpc('task10_write_legacy_booking_v1',cancel)).data.idempotentReplay).toBe(true)
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${id}' AND cancelled_at IS NOT NULL;`)).toBe('1')
  const privateArgs={...args,p_request_id:randomUUID(),p_input:{...base,courseTypeId:f.privateCourseId,totalAmount:8000,expectedTotalPrice:8000,sessions:[...sessions(10),...sessions(10,f.mainChildId)]}}
  const privateCreated=await client.rpc('task10_write_legacy_booking_v1',privateArgs);expect(privateCreated.error).toBeNull()
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${privateCreated.data.bookingId}';`)).toBe('20')
  expect((await client.rpc('task10_write_legacy_booking_v1',{...privateArgs,p_request_id:randomUUID(),p_input:{...privateArgs.p_input,sessions:privateArgs.p_input.sessions.slice(1)}})).error?.message).toContain('TASK10_FAMILY_PARTICIPANTS_CONFLICT')
  const coupon=randomUUID();localSql(`INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,current_uses,is_active,created_by) VALUES('${coupon}','TASK10-LEGACY','fixed',100,1,0,true,'${f.adminUserId}');`)
  const couponArgs={...args,p_user_id:f.otherUserId,p_request_id:randomUUID(),p_input:{...base,totalSessions:1,totalAmount:500,expectedTotalPrice:400,sessions:sessions(1),coupon:{id:coupon}}}
  const results=await Promise.all([client.rpc('task10_write_legacy_booking_v1',couponArgs),client.rpc('task10_write_legacy_booking_v1',{...couponArgs,p_request_id:randomUUID()})])
  expect(results.filter(r=>!r.error)).toHaveLength(1)
  const winner=results.find(r=>!r.error)!.data
  expect((await client.rpc('task10_write_legacy_booking_v1',{p_user_id:f.otherUserId,p_action:'cancel',p_request_id:randomUUID(),p_input:{bookingId:winner.bookingId}})).error).toBeNull()
  expect(localSql(`SELECT count(*) FROM coupon_usages WHERE booking_id='${winner.bookingId}';`)).toBe('1')
  expect(localSql(`SELECT current_uses FROM coupons WHERE id='${coupon}';`)).toBe('1')
})

test('Legacy zero-charge monthly true-up stays verified without a slip or cancellation',async()=>{
  const f=readTask10Fixture();const client=createLocalAdmin();const settled=randomUUID()
  setDisposableClock('2033-03-01T10:00:00+07:00')
  localSql(`INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES('${settled}','${f.userId}','child','${f.mainChildId}','${f.branchId}','${f.kidsCourseId}',3,2033,10,10000,'verified');
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.kidsCourseId}',extract(dow FROM '2033-03-20'::date),'17:00','19:00',true
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM '2033-03-20'::date) AND start_time='17:00' AND end_time='19:00' AND is_active);`)
  const request={p_user_id:f.userId,p_action:'create',p_request_id:randomUUID(),p_input:{learnerType:'child',childId:f.mainChildId,branchId:f.branchId,courseTypeId:f.kidsCourseId,
    month:3,year:2033,totalSessions:1,totalAmount:0,expectedTotalPrice:0,sessions:[{date:'2033-03-20',startTime:'17:00',endTime:'19:00',branchId:f.branchId,childId:f.mainChildId}]}}
  const result=await client.rpc('task10_write_legacy_booking_v1',request);expect(result.error).toBeNull();expect(result.data).toMatchObject({status:'verified',totalPrice:0})
  const id=result.data.bookingId
  expect((await client.rpc('task10_write_legacy_booking_v1',request)).data).toMatchObject({...result.data,idempotentReplay:true})
  expect((await client.rpc('task10_write_legacy_booking_v1',{p_user_id:f.userId,p_action:'cancel',p_request_id:randomUUID(),p_input:{bookingId:id}})).error?.message).toContain('TASK10_BOOKING_STATE_CONFLICT')
  expect(localSql(`SELECT count(*) FROM payments WHERE booking_id='${id}';`)).toBe('0')
  expect(localSql(`SELECT status FROM bookings WHERE id='${id}';`)).toBe('verified')
})

test.describe('Task10 family source transactions', () => {
  let family:FamilyFixture
  test.beforeAll(async()=>{ family=await seedTask10Family() })
  const state=()=>createLocalAdmin().rpc('task10_family_makeup_state_v1',{
    p_actor_id:readTask10Fixture().makeupAdminId,p_parent_id:family.parentId,p_source_month:'2031-07-01',
  })
  function args(sourceId:string,targetDate:string,childId=family.children[0]) {
    const f=readTask10Fixture()
    const template=localSql(`SELECT id FROM public.schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM '${targetDate}'::date) AND start_time='17:00' AND end_time='19:00' AND is_active;`)
    return {p_actor_id:f.makeupAdminId,p_source_session_id:sourceId,p_attending_child_id:childId,p_template_id:template,
      p_branch_id:f.branchId,p_target_date:targetDate,p_start_time:'17:00',p_end_time:'19:00',p_request_id:randomUUID()}
  }

  test('N20, absent6 + valid-at-cutover Wallet2, verified-only sibling D0/D1/D2',async()=>{
    const f=readTask10Fixture()
    const boundaries=[0,3,4,7,8,11,12,15,16,19,20,24]
    const evidence=localSql(boundaries.map(n=>`BEGIN;
      SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,7);
      UPDATE bookings SET total_sessions=${Math.max(1,n)},entitlement_sessions=${Math.max(1,n)},status='${n===0?'paid':'verified'}' WHERE id='${family.bookings[0]}';
      UPDATE bookings SET status='paid' WHERE id='${family.bookings[1]}';
      SELECT public.task10_family_makeup_state_v1('${f.makeupAdminId}','${family.parentId}','2031-07-01'); ROLLBACK;`).join('\n'))
      .split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line))
    expect(evidence.map(row=>row.sourcePurchase.quantity)).toEqual(boundaries)
    expect(evidence.map(row=>row.quota)).toEqual([0,0,1,1,2,2,3,3,4,4,5,5])
    const destinationCases=localSql(['pending_payment','paid','cancelled','verified'].map(status=>`BEGIN;
      SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8);
      UPDATE bookings SET status='${status}',total_sessions=3,entitlement_sessions=3 WHERE id='${family.bookings[2]}';
      SELECT public.task10_family_makeup_state_v1('${f.makeupAdminId}','${family.parentId}','2031-07-01'); ROLLBACK;`).join('\n'))
      .split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line))
    expect(destinationCases.map(row=>row.destinationPurchase.quantity)).toEqual([0,0,0,3])
    const oldUsage=JSON.parse(localSql(`BEGIN; SELECT set_config('task10.source_write','authorized',true);
      INSERT INTO booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
        SELECT booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,'scheduled',true,id FROM booking_sessions WHERE id='${family.sources[4]}';
      SELECT public.task10_family_makeup_state_v1('${f.makeupAdminId}','${family.parentId}','2031-07-01'); ROLLBACK;`).split('\n').find(line=>line.startsWith('{'))!)
    expect(oldUsage).toMatchObject({quota:5,used:1,remaining:4})
    expect(oldUsage.sources.map((row:{rootId:string})=>row.rootId)).not.toContain(family.sources[4])
    const initial=await state(); expect(initial.error).toBeNull()
    expect(initial.data).toMatchObject({sourcePurchase:{quantity:20},destinationPurchase:{quantity:0},quota:5,used:0,remaining:5,eligible:false,reason:'destination_minimum'})
    expect(initial.data.sources).toHaveLength(8)
    expect(initial.data.sources.filter((s:{kind:string})=>s.kind==='wallet')).toHaveLength(2)
    expect(initial.data.sources.map((s:{sourceSessionId:string})=>s.sourceSessionId)).not.toContain(family.sources[8])
    localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${readTask10Fixture().kidsCourseId}',2031,8); UPDATE public.bookings SET status='verified' WHERE id='${family.bookings[2]}'; COMMIT;`)
    expect((await state()).data).toMatchObject({destinationPurchase:{quantity:1},eligible:false})
    localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${readTask10Fixture().kidsCourseId}',2031,8); UPDATE public.bookings SET status='verified' WHERE id='${family.bookings[3]}'; COMMIT;`)
    expect((await state()).data).toMatchObject({destinationPurchase:{quantity:2},eligible:true})
  })

  test('Waiting Makeup consumption rechecks the committed minimum and destination purchase under the shared locks',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin()
    const setting=await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:f.adminUserId});expect(setting.error).toBeNull()
    for(const kind of ['minimum','destination']) {
      const app=`task10-makeup-${randomUUID()}`
      const change=kind==='minimum'
        ? `SELECT public.task10_save_makeup_setting_v1('${f.adminUserId}',3,${setting.data.revision},'${randomUUID()}');`
        : `SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='paid' WHERE id='${family.bookings[3]}';`
      const holder=concurrentLocalSql(`SET application_name='${app}'; BEGIN; ${change} SELECT pg_sleep(14); COMMIT;`)
      try {
        await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event='PgSleep';`)).toBe('1')
        const pending=client.rpc('task10_consume_family_makeup_v1',args(family.sources[0],'2031-08-09')).then(r=>r)
        await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_consume_family_makeup_v1%';`)).toBe('1')
        await holder
        expect((await pending).error?.message).toContain('TASK10_MAKEUP_INELIGIBLE')
        expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('0')
      } finally {
        await holder
        if(kind==='minimum') {
          const saved=await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:f.adminUserId});expect(saved.error).toBeNull()
          expect((await client.rpc('task10_save_makeup_setting_v1',{p_actor_id:f.adminUserId,p_minimum:2,p_expected_revision:saved.data.revision,p_request_id:randomUUID()})).error).toBeNull()
        } else localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id='${family.bookings[3]}'; COMMIT;`)
      }
    }
    expect((await state()).data).toMatchObject({used:0,eligible:true,minimum:{minimum:2},destinationPurchase:{quantity:2}})
  })

  test('Attendance changed while Makeup waits for its source is rechecked before consuming entitlement',async()=>{
    const app=`task10-attendance-${randomUUID()}`;const source=family.sources[0]
    const request=args(source,'2031-08-09');const client=createLocalAdmin()
    const holder=await holdLocalTransaction(`
      SELECT id FROM booking_sessions WHERE id='${source}' FOR UPDATE;
      UPDATE attendance SET status='present' WHERE booking_session_id='${source}' AND student_id='${family.children[0]}';`,app)
    try {
      const pending=client.rpc('task10_consume_family_makeup_v1',request).then(r=>r)
      await expect.poll(()=>localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_consume_family_makeup_v1%';")).toBe('1')
      await holder.finish()
      expect((await pending).error?.message).toContain('TASK10_SOURCE_CONFLICT')
      expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('0')
    } finally {
      await holder.finish()
      localSql(`UPDATE attendance SET status='absent' WHERE booking_session_id='${source}' AND student_id='${family.children[0]}';`)
    }
  })

  test('Same source races once, cross-family child fails without residue, old endpoint guard cannot bypass',async()=>{
    const client=createLocalAdmin(); const f=readTask10Fixture()
    const invalid=await client.rpc('task10_consume_family_makeup_v1',args(family.sources[0],'2031-08-10',f.mainChildId))
    expect(invalid.error?.message).toContain('TASK10_CHILD_NOT_IN_FAMILY')
    const requests=[args(family.sources[0],'2031-08-10'),args(family.sources[0],'2031-08-11')]
    const outcomes=await Promise.all(requests.map((a)=>client.rpc('task10_consume_family_makeup_v1',a)))
    expect(outcomes.filter((r)=>!r.error)).toHaveLength(1)
    expect(outcomes.find((r)=>r.error)?.error?.message).toContain('TASK10_SOURCE_CONFLICT')
    expect(localSql(`SELECT count(*) FROM public.booking_sessions WHERE booking_id IN ('${family.bookings[0]}','${family.bookings[1]}') AND is_makeup;`)).toBe('1')
    expect(localSql(`SELECT count(*) FROM public.task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('1')
    const winner=outcomes.findIndex((r)=>!r.error)
    const oldSetting=await client.rpc('task10_read_makeup_setting_v1',{p_actor_id:f.adminUserId})
    const saved=await client.rpc('task10_save_makeup_setting_v1',{p_actor_id:f.adminUserId,p_minimum:3,p_expected_revision:oldSetting.data.revision,p_request_id:randomUUID()})
    expect(saved.error).toBeNull()
    const replay=await client.rpc('task10_consume_family_makeup_v1',requests[winner])
    expect(replay.data).toEqual(outcomes[winner].data)
    expect((await state()).data).toMatchObject({used:1,eligible:false,minimum:{minimum:3}})
    await client.rpc('task10_save_makeup_setting_v1',{p_actor_id:f.adminUserId,p_minimum:2,p_expected_revision:saved.data.revision,p_request_id:randomUUID()})
    const bypass=await client.from('booking_sessions').insert({booking_id:family.bookings[0],branch_id:f.branchId,child_id:family.children[0],date:'2031-08-15',start_time:'17:00',end_time:'19:00',status:'scheduled',is_makeup:true,rescheduled_from_id:family.sources[1]})
    expect(bypass.error?.message).toContain('TASK10_GUARDED_SOURCE')
  })

  test('One child uses all five; Wallet source is consumed once and quota blocks sixth',async()=>{
    const client=createLocalAdmin()
    for(const [source,date] of [[family.sources[1],'2031-08-12'],[family.sources[2],'2031-08-13'],[family.sources[6],'2031-08-14']]) {
      const result=await client.rpc('task10_consume_family_makeup_v1',args(source,date))
      expect(result.error).toBeNull()
    }
    const final=await Promise.all([client.rpc('task10_consume_family_makeup_v1',args(family.sources[3],'2031-08-16')),
      client.rpc('task10_consume_family_makeup_v1',args(family.sources[4],'2031-08-17'))])
    expect(final.filter((r)=>!r.error)).toHaveLength(1)
    expect(final.find((r)=>r.error)?.error?.message).toContain('TASK10_MAKEUP_INELIGIBLE')
    expect((await state()).data).toMatchObject({quota:5,used:5,remaining:0,destinationPurchase:{quantity:2},reason:'quota_exhausted'})
    expect(localSql(`SELECT count(*) FROM public.task10_family_makeup_uses WHERE parent_id='${family.parentId}' AND attending_child_id='${family.children[0]}';`)).toBe('5')
    const consumedCredit=await client.rpc('lesson_wallet_redeem_v2',{p_user_id:family.parentId,p_credit_id:family.credits[0],p_target_date:'2031-08-20',p_start_time:'17:00',p_end_time:'19:00',p_branch_id:readTask10Fixture().branchId,p_schedule_template_id:args(family.sources[0],'2031-08-20').p_template_id})
    expect(consumedCredit.error?.message).toContain('TASK10_SOURCE_ALREADY_USED')
    expect(localSql(`SELECT count(*) FROM public.attendance WHERE booking_session_id='${family.sources[6]}';`)).toBe('0')
    expect(localSql(`SELECT count(*) FROM public.payments WHERE booking_id IN (${family.bookings.map(sqlLiteral).join(',')});`)).toBe('0')
    setDisposableClock('2031-09-01T00:00:00+07:00')
    expect((await state()).data).toMatchObject({eligible:false,reason:'expired'})
    setDisposableClock('2031-08-01T00:00:00+07:00')
  })

  test('Owner-confirmed exact cutoffs: Reschedule >=12h; Wallet Store >48h, with no failed residue',()=>{
    const f=readTask10Fixture()
    const template=args(family.sources[0],'2031-09-26').p_template_id
    const before=localSql(`SELECT jsonb_build_object('sessions',(SELECT count(*) FROM public.booking_sessions),'credits',(SELECT count(*) FROM public.lesson_wallet_credits),'mutations',(SELECT count(*) FROM public.task10_source_mutations));`)
    for(const delta of [-1,0,1]) {
      setDisposableClock(new Date(Date.parse('2031-09-20T17:00:00+07:00')-12*60*60*1000+delta).toISOString())
      const sql=`BEGIN; SELECT public.task10_reschedule_kids_v1('${family.parentId}','${family.cutoffSources[0]}','2031-09-26','17:00','19:00','${f.branchId}','${template}'); ROLLBACK;`
      if(delta<=0) expect(JSON.parse(localSql(sql))).toHaveProperty('sessionId')
      else expect(()=>localSql(sql)).toThrow('TASK10_RESCHEDULE_CUTOFF')
    }
    for(const delta of [-1,0,1]) {
      setDisposableClock(new Date(Date.parse('2031-09-23T17:00:00+07:00')-48*60*60*1000+delta).toISOString())
      const sql=`BEGIN; SELECT public.lesson_wallet_store_v2('${family.parentId}','${family.cutoffSources[3]}','${family.parentId}'); ROLLBACK;`
      if(delta<0) expect(JSON.parse(localSql(sql))).toHaveProperty('credit_id')
      else expect(()=>localSql(sql)).toThrow('LESSON_WALLET_UNIT_NOT_STORABLE')
    }
    expect(localSql(`SELECT jsonb_build_object('sessions',(SELECT count(*) FROM public.booking_sessions),'credits',(SELECT count(*) FROM public.lesson_wallet_credits),'mutations',(SELECT count(*) FROM public.task10_source_mutations));`)).toBe(before)
    setDisposableClock('2031-08-01T00:00:00+07:00')
  })
})

test.describe('Task10 retained pricing catalogs',()=>{
  const created:Array<{id:string;quote:Record<string,unknown>;expiresAt:string}>=[]
  test.beforeAll(async()=>{ if(!readTask10Fixture().family) await seedTask10Family() })
  const quote=(month:number,bookingId:string|null=null,userId=readTask10Fixture().userId)=>createLocalAdmin().rpc('task10_booking_policy_quote_v1',{
    p_user_id:userId,p_course_type_id:readTask10Fixture().kidsCourseId,p_lesson_month:`2031-${String(month).padStart(2,'0')}-01`,p_formula:'progressive',p_booking_id:bookingId,
  })
  function sessions(month:number,start:number,count:number,child=readTask10Fixture().mainChildId) {
    const f=readTask10Fixture()
    return Array.from({length:count},(_,i)=>({date:`2031-${String(month).padStart(2,'0')}-${String(start+i).padStart(2,'0')}`,start_time:'17:00',end_time:'19:00',branch_id:f.branchId,child_id:child}))
  }
  async function create(month:number,start:number,count:number,expectedPolicy?:string,userId=readTask10Fixture().userId,child=readTask10Fixture().mainChildId,couponId:string|null=null) {
    const f=readTask10Fixture();const client=createLocalAdmin();const policy=await quote(month,null,userId)
    expect(policy.error).toBeNull()
    const scope=await client.from('booking_pricing_scopes').select('revision').eq('user_id',userId).eq('course_type_id',f.kidsCourseId).eq('lesson_year',2031).eq('lesson_month',month).maybeSingle()
    const baseline=await client.rpc('progressive_legacy_baseline_v1',{p_user_id:userId,p_course_type_id:f.kidsCourseId,p_lesson_year:2031,p_lesson_month:month})
    expect(baseline.error).toBeNull()
    const requestId=randomUUID()
    const result=await client.rpc('task10_create_progressive_booking_v1',{
      p_user_id:userId,p_learner_type:'child',p_child_id:child,p_branch_id:f.branchId,p_course_type_id:f.kidsCourseId,
      p_sessions:sessions(month,start,count,child),p_coupon_id:couponId,p_client_request_id:requestId,
      p_expected_scope_revision:scope.data?.revision||0,p_expected_legacy_baseline_sessions:baseline.data[0].baseline_sessions,
      p_expected_legacy_baseline_fingerprint:baseline.data[0].baseline_fingerprint,p_expected_policy_fingerprint:expectedPolicy??policy.data.fingerprint,
    })
    return {result,requestId,policy:policy.data}
  }

  test('Late creation uses approved split/month examples and persists complete origin evidence',async()=>{
    setDisposableClock('2031-09-17T10:00:00+07:00')
    const first=await create(9,20,4);expect(first.result.error).toBeNull();expect(first.result.data.totalPrice).toBe(2000)
    created.push({id:first.result.data.bookingId,quote:first.policy,expiresAt:first.result.data.expiresAt})
    setDisposableClock('2031-09-17T10:00:01+07:00')
    const second=await create(9,24,6);expect(second.result.error).toBeNull();expect(second.result.data.totalPrice).toBe(2100)
    created.push({id:second.result.data.bookingId,quote:second.policy,expiresAt:second.result.data.expiresAt})
    setDisposableClock('2031-09-17T10:00:02+07:00')
    const october=await create(10,20,10);expect(october.result.error).toBeNull();expect(october.result.data.totalPrice).toBe(3500)
    const f=readTask10Fixture();const separate=await create(10,20,6,undefined,f.multiBranchUserId,f.multiBranchChildId)
    expect(separate.result.error).toBeNull();expect(separate.result.data.totalPrice).toBe(2598)
    const evidence=await createLocalAdmin().from('task10_booking_pricing_evidence').select('*').eq('booking_id',created[0].id).single()
    expect(evidence.error).toBeNull()
    expect(evidence.data).toMatchObject({bangkok_date:'2031-09-17',lesson_month:'2031-09-01',formula:'progressive',successful_created_at:'2031-09-17T03:00:00+00:00'})
    expect(evidence.data.evidence.catalog.tiers).toHaveLength(6)
    expect(evidence.data.evidence.catalog.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  test('Catalog edits keep each old bill set; quantity edit reprices downstream from its own set without extending expiry',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin()
    const before=await client.from('task10_booking_pricing_evidence').select('*').eq('booking_id',created[1].id).single()
    const catalogs=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:f.adminUserId})
    const saved=await client.rpc('task10_save_pricing_catalog_v1',{p_actor_id:f.adminUserId,p_regime:'late',p_expected_revision:catalogs.data.late.revision,
      p_tiers:[{minSessions:1,maxSessions:9,ratePerSession:800},{minSessions:10,maxSessions:null,ratePerSession:100}]})
    expect(saved.error).toBeNull()
    setDisposableClock('2031-09-17T10:00:03+07:00')
    const downstream=await create(9,30,1);expect(downstream.result.error).toBeNull();expect(downstream.result.data.totalPrice).toBe(100)
    const retained=await quote(9,created[1].id);expect(retained.error).toBeNull()
    expect(retained.data.catalog.versionId).toBe(before.data.catalog_version_id)
    const result=await client.rpc('task10_update_progressive_booking_v1',{p_user_id:f.userId,p_booking_id:created[1].id,p_branch_id:f.branchId,
      p_sessions:sessions(9,24,4),p_client_request_id:randomUUID(),p_expected_scope_revision:downstream.result.data.scopeRevision,p_expected_policy_fingerprint:retained.data.fingerprint})
    expect(result.error).toBeNull();expect(result.data.totalPrice).toBe(1624);expect(result.data.expiresAt).toBe(created[1].expiresAt)
    const actual=await client.from('bookings').select('id,total_price,pricing_revision').in('id',[created[0].id,downstream.result.data.bookingId])
    expect(actual.data?.find((b)=>b.id===created[0].id)).toMatchObject({total_price:2000,pricing_revision:1})
    expect(actual.data?.find((b)=>b.id===downstream.result.data.bookingId)).toMatchObject({total_price:800})
    expect((await client.from('task10_booking_pricing_evidence').select('*').eq('booking_id',created[1].id).single()).data).toEqual(before.data)
    const calculations=await client.from('task10_booking_calculations').select('revision,evidence').eq('booking_id',created[1].id).order('revision')
    expect(calculations.data?.map((row)=>row.evidence.final)).toEqual([2100,1624])
  })

  test('Actual Progressive Storage receipts survive prepared timeout and rejected review, then approve the complete unchanged scope',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin();setDisposableClock('2031-12-01T10:00:00+07:00')
    const first=await create(12,18,1);expect(first.result.error).toBeNull()
    setDisposableClock('2031-12-01T10:00:01+07:00')
    const second=await create(12,19,1);expect(second.result.error).toBeNull()
    const ids=[first.result.data.bookingId,second.result.data.bookingId]
    const scopeId=second.result.data.scopeId
    const prepare=async()=>{
      const scope=await client.from('booking_pricing_scopes').select('revision').eq('id',scopeId).single();expect(scope.error).toBeNull()
      const total=(await client.from('bookings').select('total_price').in('id',ids)).data!.reduce((sum,b)=>sum+Number(b.total_price),0)
      const p=await client.rpc('prepare_progressive_payment_batch_v2',{p_user_id:f.userId,p_pricing_scope_id:scopeId,p_booking_ids:ids,
        p_expected_scope_revision:scope.data!.revision,p_expected_total:total,p_idempotency_key:randomUUID()})
      expect(p.error).toBeNull();return p.data.batchId as string
    }
    const upload=async(batchId:string)=>{
      const slip=await uploadTask10Slip(f.userId,batchId)
      const u=await client.rpc('record_progressive_payment_upload_v1',{p_batch_id:batchId,p_user_id:f.userId,p_storage_bucket:'progressive-payment-slips',
        p_storage_path:slip.storagePath,p_mime_type:'image/png',p_size_bytes:104,p_sha256:slip.sha256})
      expect(u.error).toBeNull()
      return {storageBucket:'progressive-payment-slips',storagePath:slip.storagePath,mimeType:'image/png',sizeBytes:104,sha256:slip.sha256}
    }
    const batch1=await prepare();await upload(batch1)
    const members=await client.from('progressive_payment_batch_bookings').select('member_fingerprint').eq('payment_batch_id',batch1)
    expect(members.data).toHaveLength(2);members.data!.forEach(m=>expect(m.member_fingerprint).toMatch(/^[a-f0-9]{64}$/))
    setDisposableClock('2031-12-01T10:31:00+07:00')
    const timeout=await client.rpc('expire_progressive_prepared_batch_v1',{p_batch_id:batch1});expect(timeout.error).toBeNull()
    expect((await client.from('progressive_payment_batches').select('status').eq('id',batch1).single()).data!.status).toBe('cancelled')
    setDisposableClock('2031-12-20T10:00:00+07:00')
    expect((await client.rpc('task10_expire_booking_v1',{p_booking_id:ids[0]})).data.cancelled).toBe(false)
    const batch2=await prepare();const metadata2=await upload(batch2)
    const submit2=await client.rpc('submit_progressive_payment_batch_v1',{p_batch_id:batch2,p_user_id:f.userId,p_slip_metadata:metadata2,p_idempotency_key:randomUUID()});expect(submit2.error).toBeNull()
    const rejected=await client.rpc('reject_progressive_payment_batch_v1',{p_batch_id:batch2,p_actor_id:f.adminUserId,p_rejection_reason:'Fixture re-upload requested',p_idempotency_key:randomUUID()});expect(rejected.error).toBeNull()
    expect((await client.rpc('task10_expire_booking_v1',{p_booking_id:ids[1]})).data.cancelled).toBe(false)
    const batch3=await prepare();const metadata3=await upload(batch3)
    expect((await client.rpc('submit_progressive_payment_batch_v1',{p_batch_id:batch3,p_user_id:f.userId,p_slip_metadata:metadata3,p_idempotency_key:randomUUID()})).error).toBeNull()
    const approveArgs={p_batch_id:batch3,p_actor_id:f.adminUserId,p_idempotency_key:randomUUID()}
    const approved=await client.rpc('approve_progressive_payment_batch_v1',approveArgs);expect(approved.error).toBeNull()
    expect((await client.rpc('approve_progressive_payment_batch_v1',approveArgs)).error).toBeNull()
    expect((await client.from('bookings').select('status').in('id',ids)).data!.every(b=>b.status==='verified')).toBe(true)
    const allocations=await client.from('progressive_payment_allocations').select('amount').eq('payment_batch_id',batch3)
    expect(allocations.error).toBeNull();expect(allocations.data).toHaveLength(2);expect(allocations.data!.reduce((sum,a)=>sum+Number(a.amount),0)).toBe(1325)
    expect(localSql(`SELECT count(*) FROM payments WHERE booking_id IN ('${ids[0]}','${ids[1]}');`)).toBe('0')
  })

  test('Progressive expiry cancels only the due bill, releases its reservation once and requires the entire remaining scope to be prepared again',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin();const coupon=randomUUID()
    setDisposableClock('2031-10-10T10:00:00+07:00')
    const catalogs=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:f.adminUserId});expect(catalogs.error).toBeNull()
    expect((await client.rpc('task10_save_pricing_catalog_v1',{p_actor_id:f.adminUserId,p_regime:'late',p_expected_revision:catalogs.data.late.revision,p_tiers:INITIAL_LATE_KIDS_TIERS})).error).toBeNull()
    localSql(`UPDATE task10_policy_activation SET expiry_enabled=true;
      INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,current_uses,is_active,created_by) VALUES('${coupon}','TASK10-EXPIRY-${coupon}','fixed',100,5,0,true,'${f.adminUserId}');`)
    const child=localSql(`SELECT child_id FROM bookings WHERE id='${f.lifecycle!.kidsStatusProof}';`)
    const first=await create(10,17,4,undefined,f.otherUserId,child,coupon);expect(first.result.error).toBeNull();expect(first.result.data.totalPrice).toBe(2400)
    expect(first.policy.catalog.regime).toBe('early')
    setDisposableClock('2031-10-16T10:00:00+07:00')
    const second=await create(10,21,6,undefined,f.otherUserId,child);expect(second.result.error).toBeNull();expect(second.result.data.totalPrice).toBe(2100)
    expect(second.policy.catalog.regime).toBe('late')
    const ids=[first.result.data.bookingId,second.result.data.bookingId];const scope=second.result.data.scopeId
    const prepared=await client.rpc('prepare_progressive_payment_batch_v2',{p_user_id:f.otherUserId,p_pricing_scope_id:scope,p_booking_ids:ids,
      p_expected_scope_revision:second.result.data.scopeRevision,p_expected_total:4500,p_idempotency_key:randomUUID()});expect(prepared.error).toBeNull()
    const original=localSql(`SELECT to_jsonb(e) FROM task10_booking_pricing_evidence e WHERE booking_id='${ids[1]}';`)
    setDisposableClock('2031-10-17T17:00:00+07:00')
    const cancelled=await Promise.all([client.rpc('task10_expire_booking_v1',{p_booking_id:ids[0]}),client.rpc('task10_expire_booking_v1',{p_booking_id:ids[0]})])
    expect(cancelled.every(r=>!r.error)).toBe(true);expect(cancelled.filter(r=>r.data.cancelled)).toHaveLength(1)
    expect(localSql(`SELECT status FROM progressive_payment_batches WHERE id='${prepared.data.batchId}';`)).toBe('cancelled')
    expect(localSql(`SELECT count(*) FROM progressive_payment_batch_bookings WHERE payment_batch_id='${prepared.data.batchId}' AND active;`)).toBe('0')
    const reservation=JSON.parse(localSql(`SELECT jsonb_build_object('status',status,'reason',release_reason) FROM progressive_coupon_reservations WHERE booking_id='${ids[0]}';`))
    expect(reservation).toEqual({status:'released',reason:'booking_expired'})
    expect(localSql(`SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${ids[0]}';`)).toBe('1')
    expect(localSql(`SELECT to_jsonb(e) FROM task10_booking_pricing_evidence e WHERE booking_id='${ids[1]}';`)).toBe(original)
    const remaining=await client.from('bookings').select('status,total_price,pricing_revision,expires_at').eq('id',ids[1]).single();expect(remaining.error).toBeNull()
    expect(remaining.data).toMatchObject({status:'pending_payment',total_price:2598,expires_at:second.result.data.expiresAt})
    const revision=localSql(`SELECT revision FROM booking_pricing_scopes WHERE id='${scope}';`)
    const fresh=await client.rpc('prepare_progressive_payment_batch_v2',{p_user_id:f.otherUserId,p_pricing_scope_id:scope,p_booking_ids:[ids[1]],
      p_expected_scope_revision:Number(revision),p_expected_total:2598,p_idempotency_key:randomUUID()});expect(fresh.error).toBeNull()
    expect(fresh.data.batchId).not.toBe(prepared.data.batchId)
    expect((await client.rpc('cancel_progressive_prepared_batch_v1',{p_batch_id:fresh.data.batchId,p_user_id:f.otherUserId,p_reason:'task10_test_complete'})).error).toBeNull()
    localSql('UPDATE task10_policy_activation SET expiry_enabled=false;')
  })

  test('Frozen Legacy baseline retains proven receipt/review transitions and rejects unrelated identity drift',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin();setDisposableClock('2031-08-01T10:00:00+07:00')
    const id=f.lifecycle!.kidsStatusProof
    const child=localSql(`SELECT child_id FROM bookings WHERE id='${id}';`)
    const next=await create(8,20,1,undefined,f.otherUserId,child);expect(next.result.error).toBeNull()
    const scopeId=next.result.data.scopeId
    const original=localSql(`SELECT jsonb_build_object('sessions',legacy_baseline_sessions,'fingerprint',legacy_baseline_fingerprint,'initializedAt',legacy_baseline_initialized_at) FROM booking_pricing_scopes WHERE id='${scopeId}';`)
    const initial=await client.rpc('progressive_legacy_baseline_v1',{p_user_id:f.otherUserId,p_course_type_id:f.kidsCourseId,p_lesson_year:2031,p_lesson_month:8});expect(initial.error).toBeNull()
    const slip=await uploadTask10Slip(f.otherUserId)
    const acceptArgs={p_user_id:f.otherUserId,p_booking_ids:[id],p_storage_path:slip.storagePath,p_public_url:slip.publicUrl,p_sha256:slip.sha256,p_expected_amount:500,p_request_id:randomUUID()}
    const accepted=await client.rpc('task10_accept_legacy_slip_v1',acceptArgs);expect(accepted.error).toBeNull()
    expect((await client.rpc('task10_finalize_legacy_slip_v1',{p_user_id:f.otherUserId,p_request_id:acceptArgs.p_request_id,p_approved:false,p_notes:'Fixture review required'})).error).toBeNull()
    expect((await client.rpc('task10_review_legacy_payment_v1',{p_actor_id:f.adminUserId,p_payment_id:accepted.data.payments[0].paymentId,p_action:'send_back',p_notes:'Fixture re-upload',p_request_id:randomUUID()})).error).toBeNull()
    const retry={...acceptArgs,p_request_id:randomUUID()};expect((await client.rpc('task10_accept_legacy_slip_v1',retry)).error).toBeNull()
    expect((await client.rpc('task10_finalize_legacy_slip_v1',{p_user_id:f.otherUserId,p_request_id:retry.p_request_id,p_approved:true,p_notes:'Fixture approved'})).error).toBeNull()
    const after=await client.rpc('progressive_legacy_baseline_v1',{p_user_id:f.otherUserId,p_course_type_id:f.kidsCourseId,p_lesson_year:2031,p_lesson_month:8});expect(after.error).toBeNull();expect(after.data).toEqual(initial.data)
    expect(localSql(`SELECT jsonb_build_object('sessions',legacy_baseline_sessions,'fingerprint',legacy_baseline_fingerprint,'initializedAt',legacy_baseline_initialized_at) FROM booking_pricing_scopes WHERE id='${scopeId}';`)).toBe(original)
    expect(()=>localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${f.otherUserId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET total_sessions=9 WHERE id='${id}'; SELECT * FROM public.progressive_legacy_baseline_v1('${f.otherUserId}','${f.kidsCourseId}',2031,8); ROLLBACK;`)).toThrow('PROGRESSIVE_LEGACY_BASELINE_DRIFT')
    expect(localSql(`SELECT count(*) FROM task10_legacy_baseline_deltas WHERE scope_id='${scopeId}';`)).toBe('0')
    expect((await create(8,21,1,undefined,f.otherUserId,child)).result.error).toBeNull()
  })

  test('Coupon lock wait crossing Bangkok 15-to-16 uses the successful write clock and rejects the old preview without residue',async()=>{
    const f=readTask10Fixture();const coupon=randomUUID();const app=`task10-clock-${randomUUID()}`
    setDisposableClock('2031-09-15T23:59:59.999+07:00')
    localSql(`INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,current_uses,is_active,created_by) VALUES('${coupon}','${app}','fixed',1,5,0,true,'${f.adminUserId}');`)
    const early=await quote(11);expect(early.error).toBeNull()
    // Release after the observed clock crossing; a fixed18s hold races the API's8s timeout.
    const holder=await holdLocalTransaction(`SELECT id FROM coupons WHERE id='${coupon}' FOR UPDATE;`,app)
    try {
      const pending=create(11,20,4,early.data.fingerprint,f.userId,f.mainChildId,coupon)
      await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_create_progressive_booking_v1%';`)).toBe('1')
      setDisposableClock('2031-09-16T00:00:00+07:00')
      await holder.finish()
      const rejected=await pending
      expect(rejected.result.error?.message).toContain('TASK10_PREVIEW_CONFLICT')
      expect(localSql(`SELECT count(*) FROM bookings WHERE client_request_id='${rejected.requestId}';`)).toBe('0')
      expect(localSql(`SELECT count(*) FROM schedule_slots WHERE date>='2031-11-01' AND date<'2031-12-01';`)).toBe('0')
      expect(localSql(`SELECT current_uses FROM coupons WHERE id='${coupon}';`)).toBe('0')
    } finally { await holder.finish() }
  })

  test('15-to-16 stale preview and direct writes fail atomically before booking/slot residue',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin()
    setDisposableClock('2031-09-15T23:59:59.999+07:00')
    const early=await quote(11);expect(early.error).toBeNull();expect(early.data.catalog.regime).toBe('early')
    setDisposableClock('2031-09-16T00:00:00+07:00')
    const rejected=await create(11,20,4,early.data.fingerprint)
    expect(rejected.result.error?.message).toContain('TASK10_PREVIEW_CONFLICT')
    expect(localSql(`SELECT count(*) FROM public.bookings WHERE client_request_id='${rejected.requestId}';`)).toBe('0')
    expect(localSql(`SELECT count(*) FROM public.schedule_slots WHERE date>='2031-11-01' AND date<'2031-12-01';`)).toBe('0')
    const bypass=await client.from('bookings').update({total_sessions:99}).eq('id',created[0].id)
    expect(bypass.error?.message).toContain('TASK10_GUARDED_BOOKING')
    const primary=await client.from('pricing_tiers').update({price_per_session:1}).eq('course_type_id',f.kidsCourseId)
    expect(primary.error?.message).toContain('TASK10_VERSIONED_CATALOG_REQUIRED')
    setDisposableClock('2031-08-01T00:00:00+07:00')
  })
})


test.describe('Task10 accepted receipts and physical cancellation',()=>{
  test.beforeAll(()=>{
    setDisposableClock('2031-08-01T00:00:00+07:00')
    const ids=Object.values(readTask10Fixture().lifecycle!).map(sqlLiteral).join(',')
    localSql(`BEGIN; UPDATE public.task10_policy_activation SET state='active',expiry_enabled=true;
      INSERT INTO public.task10_booking_expiry_cohort(booking_id,effective_at,deadline_at_cutover,evidence)
      SELECT b.id,a.effective_at,public.task10_booking_deadline_v1(b.id),'{}' FROM public.bookings b CROSS JOIN public.task10_policy_activation a
      WHERE b.id IN (${ids}) AND b.status::text IN ('pending_payment','paid') AND public.task10_booking_deadline_v1(b.id)>a.effective_at; COMMIT;`)
  })
  const expire=(id:string)=>createLocalAdmin().rpc('task10_expire_booking_v1',{p_booking_id:id})
  async function accept(id:string,requestId=randomUUID()) {
    const f=readTask10Fixture(); const slip=await uploadTask10Slip(f.otherUserId)
    const result=await createLocalAdmin().rpc('task10_accept_legacy_slip_v1',{p_user_id:f.otherUserId,p_booking_ids:[id],p_storage_path:slip.storagePath,
      p_public_url:slip.publicUrl,p_sha256:slip.sha256,p_expected_amount:500,p_request_id:requestId})
    return {result,requestId,slip}
  }
  test('Earlier original expiry wins; two simultaneous workers cancel once and only the exact bill',async()=>{
    const f=readTask10Fixture();const id=f.lifecycle!.earlierExpiry
    setDisposableClock('2031-08-01T11:59:59.999+07:00')
    expect((await expire(id)).data.cancelled).toBe(false)
    setDisposableClock('2031-08-01T12:00:00+07:00')
    const results=await Promise.all([expire(id),expire(id)])
    expect(results.every((r)=>!r.error)).toBe(true)
    expect(results.filter((r)=>r.data.cancelled)).toHaveLength(1)
    const evidence=JSON.parse(localSql(`SELECT jsonb_build_object('cancellations',(SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${id}'),'sessions',(SELECT count(*) FROM booking_sessions WHERE booking_id='${id}' AND cancelled_at IS NOT NULL),'other',(SELECT status FROM bookings WHERE id='${f.lifecycle!.adultDue}'),'expiry',(SELECT expires_at FROM bookings WHERE id='${id}'));`))
    expect(evidence).toMatchObject({cancellations:1,sessions:1,other:'pending_payment',expiry:'2031-08-01T05:00:00+00:00'})
  })
  test('On-time committed receipt survives deadline while awaiting review; review is atomic and replayable',async()=>{
    const f=readTask10Fixture();const id=f.lifecycle!.onTime;const client=createLocalAdmin()
    setDisposableClock('2031-08-02T10:59:59.999+07:00')
    const accepted=await accept(id);expect(accepted.result.error).toBeNull()
    const paymentId=accepted.result.data.payments[0].paymentId
    setDisposableClock('2031-08-02T11:00:00.001+07:00')
    expect((await expire(id)).data.cancelled).toBe(false)
    expect((await client.from('bookings').select('status').eq('id',id).single()).data?.status).toBe('paid')
    const args={p_actor_id:f.adminUserId,p_payment_id:paymentId,p_action:'approve',p_notes:'Task10 local review',p_request_id:randomUUID()}
    const review=await client.rpc('task10_review_legacy_payment_v1',args);expect(review.error).toBeNull();expect(review.data.bookingStatus).toBe('verified')
    expect((await client.rpc('task10_review_legacy_payment_v1',args)).data).toEqual(review.data)
    expect((await expire(id)).data.cancelled).toBe(false)
  })
  test('Storage alone, failed receipt, exact-deadline and late upload never protect or resurrect a cancelled bill',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin()
    const stored=await uploadTask10Slip(f.otherUserId)
    setDisposableClock('2031-08-02T12:00:00+07:00')
    const missing=await client.rpc('task10_accept_legacy_slip_v1',{p_user_id:f.otherUserId,p_booking_ids:[f.lifecycle!.storageOnly],p_storage_path:stored.storagePath+'.missing',p_public_url:stored.publicUrl,p_sha256:stored.sha256,p_expected_amount:500,p_request_id:randomUUID()})
    expect(missing.error?.message).toContain('TASK10_INVALID_RECEIPT')
    const exact=await accept(f.lifecycle!.storageOnly);expect(exact.result.error?.message).toContain('TASK10_BOOKING_DEADLINE')
    expect((await expire(f.lifecycle!.storageOnly)).data.cancelled).toBe(true)
    setDisposableClock('2031-08-02T13:00:00.001+07:00')
    expect((await accept(f.lifecycle!.late)).result.error?.message).toContain('TASK10_BOOKING_DEADLINE')
    expect((await expire(f.lifecycle!.late)).data.cancelled).toBe(true)
    expect((await accept(f.lifecycle!.late)).result.error?.message).toContain('TASK10_BOOKING_CANCELLED')
    expect(localSql(`SELECT count(*) FROM task10_accepted_receipts WHERE booking_id IN ('${f.lifecycle!.late}','${f.lifecycle!.storageOnly}');`)).toBe('0')
    expect(localSql(`SELECT count(*) FROM payments WHERE booking_id IN ('${f.lifecycle!.late}','${f.lifecycle!.storageOnly}');`)).toBe('0')
  })
  test('Returned slip retains its on-time receipt; expiry covers Kids/Adult/Private and excludes old overdue/verified bills',async()=>{
    const f=readTask10Fixture();const client=createLocalAdmin()
    setDisposableClock('2031-08-02T16:59:59.999+07:00')
    const accepted=await accept(f.lifecycle!.sendBack);expect(accepted.result.error).toBeNull()
    setDisposableClock('2031-08-03T00:00:00+07:00')
    const review=await client.rpc('task10_review_legacy_payment_v1',{p_actor_id:f.adminUserId,p_payment_id:accepted.result.data.payments[0].paymentId,p_action:'send_back',p_notes:'Re-upload',p_request_id:randomUUID()})
    expect(review.error).toBeNull();expect(review.data.bookingStatus).toBe('pending_payment')
    for(const name of ['sendBack','oldOverdue','verified']) expect((await expire(f.lifecycle![name])).data.cancelled).toBe(false)
    for(const name of ['kidsDue','adultDue','privateDue']) { const result=await expire(f.lifecycle![name]);expect(result.error).toBeNull();expect(result.data.cancelled).toBe(true) }
    const bypass=await client.from('bookings').update({status:'verified'}).eq('id',f.lifecycle!.adultDue)
    expect(bypass.error?.message).toContain('TASK10_BOOKING_CANCELLED')
    setDisposableClock('2031-08-01T00:00:00+07:00')
  })
})

test('Concurrent Wallet Redeem, Return and Reschedule cannot double-consume a family Makeup source; denied Makeup access fails closed',async()=>{
  test.setTimeout(180_000)
  const family=await seedTask10Family();const f=readTask10Fixture();const client=createLocalAdmin()
  setDisposableClock('2031-07-31T18:01:00+07:00')
  localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8);
    UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}');
    UPDATE lesson_wallet_credits SET status='active' WHERE id='${family.credits[0]}';
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      VALUES('${f.branchId}','${f.kidsCourseId}',extract(dow FROM '2031-07-31'::date),'20:00','22:00',true); COMMIT;`)
  const template=localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM '2031-08-20'::date) AND start_time='17:00' AND end_time='19:00' AND is_active;`)
  const walletTemplate=localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND start_time='20:00' AND end_time='22:00' AND is_active;`)
  const stateArgs={p_actor_id:f.makeupAdminId,p_parent_id:family.parentId,p_source_month:'2031-07-01'}
  const state=await client.rpc('task10_family_makeup_state_v1',stateArgs);expect(state.error).toBeNull();expect(state.data.eligible).toBe(true)
  expect(state.data.sources.map((s:{sourceSessionId:string})=>s.sourceSessionId)).toContain(family.sources[6])
  expect(()=>localSql(`BEGIN; INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":[]}')
    ON CONFLICT(key) DO UPDATE SET value=excluded.value;
    SELECT public.task10_family_makeup_state_v1('${f.deniedAdminId}','${family.parentId}','2031-07-01'); ROLLBACK;`)).toThrow('TASK10_UNAUTHORIZED')
  const [makeup,redeem,returned,reschedule]=await Promise.all([
    client.rpc('task10_consume_family_makeup_v1',{p_actor_id:f.makeupAdminId,p_source_session_id:family.sources[6],p_attending_child_id:family.children[0],
      p_template_id:template,p_branch_id:f.branchId,p_target_date:'2031-08-20',p_start_time:'17:00',p_end_time:'19:00',p_request_id:randomUUID()}),
    client.rpc('lesson_wallet_redeem_v2',{p_user_id:family.parentId,p_credit_id:family.credits[0],p_target_date:'2031-07-31',
      p_start_time:'20:00',p_end_time:'22:00',p_branch_id:f.branchId,p_schedule_template_id:walletTemplate}),
    client.rpc('task10_return_kids_entitlement_v1',{p_actor_id:f.makeupAdminId,p_session_id:family.sources[6],p_reason:'Concurrent disposable source review'}),
    client.rpc('task10_reschedule_kids_v1',{p_user_id:family.parentId,p_session_id:family.sources[6],p_target_date:'2031-07-31',
      p_start_time:'20:00',p_end_time:'22:00',p_branch_id:f.branchId,p_template_id:walletTemplate}),
  ])
  expect([makeup,redeem].filter(r=>!r.error),JSON.stringify([makeup.error,redeem.error])).toHaveLength(1)
  expect(reschedule.error?.message).toMatch(/TASK10_SOURCE_(CONFLICT|ALREADY_USED)/)
  if(returned.error) expect(returned.error.message).toMatch(/TASK10_SOURCE_(CONFLICT|ALREADY_USED)/)
  const result=await client.rpc('task10_family_makeup_state_v1',stateArgs);expect(result.error).toBeNull()
  expect(result.data).toMatchObject({sourcePurchase:{quantity:20},destinationPurchase:{quantity:2},used:makeup.error?0:1})
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE id<>'${family.sources[6]}' AND public.task10_source_root_v1(id)='${family.sources[6]}' AND status='scheduled' AND cancelled_at IS NULL;`)).toBe('1')
  expect(localSql(`SELECT count(*) FROM payments WHERE booking_id IN (${family.bookings.map(sqlLiteral).join(',')});`)).toBe('0')
  setDisposableClock('2031-08-01T00:00:00+07:00')
})

test('Independent receipt, review and expiry transactions serialize both winners without resurrection or partial payment writes',async()=>{
  test.setTimeout(240_000)
  const f=readTask10Fixture();const client=createLocalAdmin()
  if(!f.family) await seedTask10Family()
  setDisposableClock('2034-02-01T10:00:00+07:00')
  localSql(`UPDATE task10_policy_activation SET state='active',expiry_enabled=true;
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.adultCourseId}',d,'10:00','11:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.adultCourseId}' AND day_of_week=d AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  const ids:string[]=[]
  for(const day of [20,21]) {
    const created=await client.rpc('task10_write_legacy_booking_v1',{p_user_id:f.userId,p_action:'create',p_request_id:randomUUID(),p_input:{
      learnerType:'self',childId:null,branchId:f.branchId,courseTypeId:f.adultCourseId,month:2,year:2034,totalSessions:1,totalAmount:500,expectedTotalPrice:500,
      sessions:[{date:`2034-02-${day}`,startTime:'10:00',endTime:'11:00',branchId:f.branchId,childId:null}]}})
    expect(created.error).toBeNull();ids.push(created.data.bookingId)
  }
  const slip=await uploadTask10Slip(f.userId);const requestId=randomUUID()
  setDisposableClock('2034-02-20T09:59:59+07:00')
  const holder=await holdLocalTransaction(`SELECT public.task10_accept_legacy_slip_v1('${f.userId}',ARRAY['${ids[0]}']::uuid[],
    ${sqlLiteral(slip.storagePath)},${sqlLiteral(slip.publicUrl)},'${slip.sha256}',500,'${requestId}');`,`task10-receipt-${randomUUID()}`)
  try {
    setDisposableClock('2034-02-20T10:00:00+07:00')
    const worker=client.rpc('task10_expire_booking_v1',{p_booking_id:ids[0]}).then(r=>r)
    await expect.poll(()=>localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_expire_booking_v1%';")).toBe('1')
    await holder.finish();const result=await worker;expect(result.error).toBeNull();expect(result.data.cancelled).toBe(false)
  } finally { await holder.finish() }
  const payment=localSql(`SELECT id FROM payments WHERE booking_id='${ids[0]}';`)
  const reviewer=await holdLocalTransaction(`SELECT public.task10_review_legacy_payment_v1('${f.adminUserId}','${payment}','approve','Disposable review race','${randomUUID()}');`,`task10-review-${randomUUID()}`)
  try {
    const worker=client.rpc('task10_expire_booking_v1',{p_booking_id:ids[0]}).then(r=>r)
    await expect.poll(()=>localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_expire_booking_v1%';")).toBe('1')
    await reviewer.finish();const result=await worker;expect(result.error).toBeNull();expect(result.data.cancelled).toBe(false)
  } finally { await reviewer.finish() }
  expect(localSql(`SELECT status FROM bookings WHERE id='${ids[0]}';`)).toBe('verified')
  expect(localSql(`SELECT count(*) FROM task10_accepted_receipts WHERE booking_id='${ids[0]}';`)).toBe('1')
  setDisposableClock('2034-02-21T10:00:00+07:00')
  const cancellation=await holdLocalTransaction(`SELECT public.task10_expire_booking_v1('${ids[1]}');`,`task10-cancel-${randomUUID()}`)
  try {
    const receipt=client.rpc('task10_accept_legacy_slip_v1',{p_user_id:f.userId,p_booking_ids:[ids[1]],p_storage_path:slip.storagePath,
      p_public_url:slip.publicUrl,p_sha256:slip.sha256,p_expected_amount:500,p_request_id:randomUUID()}).then(r=>r)
    await expect.poll(()=>localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%task10_accept_legacy_slip_v1%';")).toBe('1')
    await cancellation.finish();expect((await receipt).error?.message).toContain('TASK10_BOOKING_CANCELLED')
  } finally { await cancellation.finish() }
  expect(localSql(`SELECT count(*) FROM payments WHERE booking_id='${ids[1]}';`)).toBe('0')
  expect(localSql(`SELECT count(*) FROM task10_accepted_receipts WHERE booking_id='${ids[1]}';`)).toBe('0')
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${ids[1]}' AND cancelled_at IS NOT NULL;`)).toBe('1')
  setDisposableClock('2031-08-01T00:00:00+07:00')
})

test('Paused policy blocks new Kids consumption while an existing catalog bill can be edited without rewriting its origin',async()=>{
  const f=readTask10Fixture();const client=createLocalAdmin()
  if(!f.family) await seedTask10Family()
  setDisposableClock('2033-09-17T10:00:00+07:00')
  const policyArgs={p_user_id:f.userId,p_course_type_id:f.kidsCourseId,p_lesson_month:'2033-09-01',p_formula:'progressive',p_booking_id:null}
  const policy=await client.rpc('task10_booking_policy_quote_v1',policyArgs);expect(policy.error).toBeNull()
  const baseline=await client.rpc('progressive_legacy_baseline_v1',{p_user_id:f.userId,p_course_type_id:f.kidsCourseId,p_lesson_year:2033,p_lesson_month:9});expect(baseline.error).toBeNull()
  const sessions=[25,26].map(day=>({date:`2033-09-${day}`,start_time:'17:00',end_time:'19:00',branch_id:f.branchId,child_id:f.mainChildId}))
  const created=await client.rpc('task10_create_progressive_booking_v1',{p_user_id:f.userId,p_learner_type:'child',p_child_id:f.mainChildId,p_branch_id:f.branchId,
    p_course_type_id:f.kidsCourseId,p_sessions:sessions.slice(0,1),p_coupon_id:null,p_client_request_id:randomUUID(),p_expected_scope_revision:0,
    p_expected_legacy_baseline_sessions:baseline.data[0].baseline_sessions,p_expected_legacy_baseline_fingerprint:baseline.data[0].baseline_fingerprint,p_expected_policy_fingerprint:policy.data.fingerprint})
  expect(created.error).toBeNull();const id=created.data.bookingId
  const evidence=localSql(`SELECT to_jsonb(e) FROM task10_booking_pricing_evidence e WHERE booking_id='${id}';`)
  const before=JSON.parse(localSql('SELECT row_to_json(a) FROM task10_policy_activation a;'))
  const artifact={sourceSha:'a'.repeat(40),deploymentId:'dpl_local_disposable_fixture',productionPromotionConfirmed:true,healthChecksPassed:true}
  localSql(`SELECT public.task10_pause_v1('${f.adminUserId}',${before.revision},true,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
  try {
    expect((await client.rpc('task10_booking_policy_quote_v1',policyArgs)).error?.message).toContain('TASK10_PRICING_PAUSED')
    const retained=await client.rpc('task10_booking_policy_quote_v1',{...policyArgs,p_booking_id:id});expect(retained.error).toBeNull()
    expect(retained.data.catalog.versionId).toBe(policy.data.catalog.versionId)
    const changed=await client.rpc('task10_update_progressive_booking_v1',{p_user_id:f.userId,p_booking_id:id,p_branch_id:f.branchId,p_sessions:sessions,
      p_client_request_id:randomUUID(),p_expected_scope_revision:created.data.scopeRevision,p_expected_policy_fingerprint:retained.data.fingerprint})
    expect(changed.error).toBeNull();expect(changed.data).toMatchObject({totalPrice:1250,expiresAt:created.data.expiresAt})
    expect(localSql(`SELECT to_jsonb(e) FROM task10_booking_pricing_evidence e WHERE booking_id='${id}';`)).toBe(evidence)
    const family=readTask10Fixture().family!
    const blocked=await client.rpc('task10_consume_family_makeup_v1',{p_actor_id:f.makeupAdminId,p_source_session_id:family.sources[0],
      p_attending_child_id:family.children[0],p_template_id:null,p_branch_id:f.branchId,p_target_date:'2031-08-20',p_start_time:'17:00',p_end_time:'19:00',p_request_id:randomUUID()})
    expect(blocked.error?.message).toContain('TASK10_MAKEUP_PAUSED')
    expect(JSON.parse(localSql('SELECT public.task10_run_expiry_v1(50);'))).toMatchObject({status:'inactive',cancelled:0})
    expect(JSON.parse(localSql('SELECT public.task10_policy_status_v1();'))).toMatchObject({state:'paused',effectiveAt:before.effective_at})
  } finally {
    localSql(`BEGIN; SELECT public.task10_pause_v1('${f.adminUserId}',${before.revision+1},false,${sqlLiteral(JSON.stringify(artifact))}::jsonb);
      SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';
      UPDATE task10_policy_activation SET expiry_enabled=false; COMMIT;`)
    setDisposableClock('2031-08-01T00:00:00+07:00')
  }
})
