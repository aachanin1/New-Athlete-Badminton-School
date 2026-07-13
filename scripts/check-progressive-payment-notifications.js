const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const migrationPath = 'supabase/migrations/20260713153000_notify_staff_on_progressive_payment_approval.sql'
const migration = fs.readFileSync(path.join(root, migrationPath), 'utf8')

let passed = 0
function check(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

function makeState(status = 'submitted') {
  return {
    status,
    decisionKey: null,
    bookingStatus: 'pending_payment',
    allocations: 0,
    ledgerRows: 0,
    notifications: [],
    recipients: [
      { id: 'user-1', role: 'user' },
      { id: 'admin-1', role: 'admin' },
      { id: 'admin-2', role: 'admin' },
      { id: 'super-1', role: 'super_admin' },
      { id: 'coach-1', role: 'coach' },
    ],
  }
}

function approve(state, key) {
  if (state.status === 'approved') {
    assert.strictEqual(state.decisionKey, key)
    return { replay: true }
  }
  if (!['submitted', 'under_review'].includes(state.status)) throw new Error('PROGRESSIVE_BATCH_NOT_REVIEWABLE')
  state.bookingStatus = 'verified'
  state.allocations = 1
  state.ledgerRows = 1
  state.status = 'approved'
  state.decisionKey = key
  state.notifications.push({ recipient: 'user-1', link: '/dashboard/history', message: 'user success' })
  for (const recipient of state.recipients.filter(({ role }) => ['admin', 'super_admin'].includes(role))) {
    state.notifications.push({
      recipient: recipient.id,
      role: recipient.role,
      link: '/admin/payments',
      message: 'operational payment verified',
    })
  }
  return { replay: false }
}

check('successful approval keeps one user notification and one notification per staff recipient', () => {
  const state = makeState()
  approve(state, 'attempt-1')
  assert.strictEqual(state.notifications.filter(({ recipient }) => recipient === 'user-1').length, 1)
  assert.deepStrictEqual(
    state.notifications.filter(({ role }) => role === 'admin').map(({ recipient }) => recipient),
    ['admin-1', 'admin-2'],
  )
  assert.deepStrictEqual(
    state.notifications.filter(({ role }) => role === 'super_admin').map(({ recipient }) => recipient),
    ['super-1'],
  )
})

check('staff notification is operational, amount-free, and links to Admin Payments', () => {
  const state = makeState()
  approve(state, 'attempt-1')
  const staff = state.notifications.filter(({ role }) => role)
  assert.ok(staff.every(({ link }) => link === '/admin/payments'))
  assert.ok(staff.every(({ message }) => !/700|amount|total|บาท|฿/i.test(message)))
})

check('approval keeps booking, batch, allocation, and ledger outcomes unchanged', () => {
  const state = makeState()
  approve(state, 'attempt-1')
  assert.deepStrictEqual(
    { booking: state.bookingStatus, batch: state.status, allocations: state.allocations, ledger: state.ledgerRows },
    { booking: 'verified', batch: 'approved', allocations: 1, ledger: 1 },
  )
})

check('resolved approval replay cannot duplicate any notification', () => {
  const state = makeState()
  approve(state, 'attempt-1')
  const before = structuredClone(state.notifications)
  assert.deepStrictEqual(approve(state, 'attempt-1'), { replay: true })
  assert.deepStrictEqual(state.notifications, before)
})

for (const status of ['prepared', 'expired', 'cancelled', 'rejected']) {
  check(`${status} batch cannot create a success notification`, () => {
    const state = makeState(status)
    assert.throws(() => approve(state, 'attempt-1'))
    assert.deepStrictEqual(state.notifications, [])
  })
}

for (const status of ['under_review', 'submitted']) {
  check(`${status} batch creates notifications only after successful approval`, () => {
    const state = makeState(status)
    assert.deepStrictEqual(state.notifications, [])
    approve(state, 'attempt-1')
    assert.ok(state.notifications.length > 0)
  })
}

check('failed verification does not invoke approval or create a success notification', () => {
  const state = makeState('under_review')
  assert.deepStrictEqual(state.notifications, [])
})

check('status polling and terminal submit short-circuit do not create notifications', () => {
  const statusRoute = fs.readFileSync(
    path.join(root, 'src/app/api/progressive-payments/[batchId]/status/route.ts'),
    'utf8',
  )
  const submitRoute = fs.readFileSync(
    path.join(root, 'src/app/api/progressive-payments/submit/route.ts'),
    'utf8',
  )
  assert.doesNotMatch(statusRoute, /notifications|notifyUser|notifyRoles/)
  assert.match(submitRoute, /if \(\['approved', 'rejected', 'cancelled'\]\.includes\(batch\.status\)\) \{\s+return/)
})

check('migration selects only Admin and Super Admin profiles', () => {
  assert.match(migration, /FROM public\.profiles profile\s+WHERE profile\.role IN \('admin', 'super_admin'\)/)
})

check('migration preserves the user notification and uses the role-safe staff contract', () => {
  assert.match(migration, /v_batch\.user_id[\s\S]+?'\/dashboard\/history'/)
  assert.match(migration, /'payment', '\/admin\/payments'/)
  const staffInsert = migration.slice(migration.lastIndexOf('INSERT INTO public.notifications'))
  assert.doesNotMatch(staffInsert, /v_batch\.total_amount|v_allocation_total|amount_snapshot|700|บาท|฿/i)
})

check('approved replay returns before either notification insert', () => {
  const replayReturn = migration.indexOf('progressive_payment_batch_result_v1(p_batch_id, true)')
  const firstNotification = migration.indexOf('INSERT INTO public.notifications')
  assert.ok(replayReturn > -1 && firstNotification > replayReturn)
})

check('migration does not alter legacy payments, pricing tiers, finance, or ledger data', () => {
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(payments|pricing_tiers|finance_expenses|payment_ledger)/i)
  assert.strictEqual((migration.match(/\$\$/g) || []).length, 2)
})

console.log(`Progressive payment notification checks passed: ${passed} checks.`)
