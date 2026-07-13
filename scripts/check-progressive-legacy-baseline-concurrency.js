const { execFileSync, spawn } = require('node:child_process')
const assert = require('node:assert/strict')

const container = 'supabase_db_New-Athlete-Badminton-School'
const userId = '91000000-0000-0000-0000-000000000001'
const branchId = '92000000-0000-0000-0000-000000000001'
const courseId = '93000000-0000-0000-0000-000000000001'
const legacyId = '94000000-0000-0000-0000-000000000001'

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql],
    { encoding: 'utf8', ...options }
  ).trim()
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sessions(startDay, hour) {
  return Array.from({ length: 4 }, (_, index) => ({
    date: `2030-08-${String(startDay + index).padStart(2, '0')}`,
    start_time: `${String(hour).padStart(2, '0')}:00`,
    end_time: `${String(hour + 2).padStart(2, '0')}:00`,
    branch_id: branchId,
  }))
}

function concurrentCreate(requestId, requestedSessions, baselineSessions, baselineFingerprint) {
  const sql = `
    BEGIN;
    SELECT public.create_progressive_booking_v1(
      '${userId}', 'self', NULL, '${branchId}', '${courseId}',
      ${sqlLiteral(JSON.stringify(requestedSessions))}::jsonb, NULL, '${requestId}',
      0, ${baselineSessions}, '${baselineFingerprint}'
    );
    SELECT pg_sleep(1);
    COMMIT;
  `
  const child = spawn(
    'docker',
    ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  return new Promise((resolve) => child.on('close', (code) => resolve({ code, stdout, stderr })))
}

async function main() {
  const checks = []
  const check = (condition, message) => {
    assert.ok(condition, message)
    checks.push(message)
  }

  try {
    psql(`
      INSERT INTO auth.users (id,email,raw_user_meta_data)
      VALUES ('${userId}','option-a-concurrency@example.invalid','{"full_name":"Option A Concurrency"}');
      INSERT INTO public.branches (id,name,slug)
      VALUES ('${branchId}','Option A Concurrency Branch','option-a-concurrency-branch');
      INSERT INTO public.course_types (id,name,max_students,duration_hours)
      VALUES ('${courseId}','kids_group',20,2);
      INSERT INTO public.pricing_tiers
        (id,course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from)
      VALUES
        ('93100000-0000-0000-0000-000000000001','${courseId}',1,4,625,0,'2020-01-01'),
        ('93100000-0000-0000-0000-000000000002','${courseId}',5,10,500,0,'2020-01-01'),
        ('93100000-0000-0000-0000-000000000003','${courseId}',11,15,433,0,'2020-01-01'),
        ('93100000-0000-0000-0000-000000000004','${courseId}',16,NULL,406,0,'2020-01-01');
      INSERT INTO public.schedule_templates
        (id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT
        ('93200000-0000-0000-0000-' || lpad((day_number + 1)::text,12,'0'))::uuid,
        '${branchId}','${courseId}',day_number,'08:00','18:00',true
      FROM generate_series(0,6) AS day_number;
      INSERT INTO public.bookings
        (id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id)
      VALUES
        ('${legacyId}','${userId}','self','${branchId}','${courseId}',8,2030,4,2500,'verified',NULL);
    `)

    const baseline = psql(`
      SELECT baseline_sessions || '|' || baseline_fingerprint
      FROM public.progressive_legacy_baseline_v1('${userId}','${courseId}',2030,8)
    `).split('|')
    const baselineSessions = Number(baseline[0])
    const baselineFingerprint = baseline[1]
    check(baselineSessions === 4, 'authoritative concurrent baseline is 4')
    check(/^[0-9a-f]{64}$/.test(baselineFingerprint), 'authoritative concurrent fingerprint is SHA-256')

    const [first, second] = await Promise.all([
      concurrentCreate('95000000-0000-0000-0000-000000000001', sessions(1, 10), baselineSessions, baselineFingerprint),
      concurrentCreate('95000000-0000-0000-0000-000000000002', sessions(10, 12), baselineSessions, baselineFingerprint),
    ])
    const outcomes = [first, second]
    check(outcomes.filter((outcome) => outcome.code === 0).length === 1, 'exactly one concurrent first booking succeeds')
    check(outcomes.filter((outcome) => outcome.code !== 0).length === 1, 'exactly one stale concurrent request fails')
    const failure = outcomes.find((outcome) => outcome.code !== 0)
    check(`${failure.stdout}\n${failure.stderr}`.includes('PROGRESSIVE_SCOPE_REVISION_CONFLICT'), 'stale concurrent request requires re-preview')

    const state = psql(`
      SELECT
        count(*) FILTER (WHERE b.pricing_scope_id IS NOT NULL),
        count(DISTINCT s.id),
        min(s.legacy_baseline_sessions),
        min(b.total_price) FILTER (WHERE b.pricing_scope_id IS NOT NULL),
        (SELECT count(*) FROM public.progressive_booking_mutation_receipts r WHERE r.user_id='${userId}'),
        (SELECT count(*) FROM public.payments p JOIN public.bookings pb ON pb.id=p.booking_id WHERE pb.user_id='${userId}')
      FROM public.bookings b
      LEFT JOIN public.booking_pricing_scopes s ON s.id=b.pricing_scope_id
      WHERE b.user_id='${userId}'
    `).split('|').map(Number)
    check(state[0] === 1 && state[1] === 1, 'concurrency creates one Progressive booking in one scope')
    check(state[2] === 4 && state[3] === 2000, 'scope stores baseline once and prices 4 + 4 at 2,000')
    check(state[4] === 1 && state[5] === 0, 'winner writes one receipt and no payment artifacts')

    console.log(`PASS: ${checks.length}/${checks.length} progressive Legacy baseline concurrency checks`)
  } finally {
    psql(`
      DELETE FROM auth.users WHERE id='${userId}';
      DELETE FROM public.schedule_slots WHERE branch_id='${branchId}';
      DELETE FROM public.schedule_templates WHERE branch_id='${branchId}';
      DELETE FROM public.course_types WHERE id='${courseId}';
      DELETE FROM public.branches WHERE id='${branchId}';
    `)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
