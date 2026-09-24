import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { getBangkokDateKey } from '../../src/lib/date-format'

const requireLocal = createRequire(__filename)
type Row = Record<string, unknown>

// Execute the actual server page. The fake transport models PostgREST's default
// nested-null filtering and 1000-row cap; it records every query and sign call.
async function renderPayments(month = '2031-10', failPath?: string, sameMonthCount = 621, role = 'super_admin') {
  const queries: Array<{ table: string; select: string; filters: Array<[string, unknown]>; range?: number[] }> = []
  let concurrent = 0; let peak = 0
  const signed: string[] = []
  const rows: Record<string, Row[]> = {
    payments: [9, 10, 12].map(m => ({ id: `legacy-${m}`, booking_id: `booking-${m}`, user_id: 'parent', created_at: '2031-09-01T00:00:00Z', status: 'approved', bookings: { month: m, year: 2031, status: 'verified', total_sessions: 1 }, profiles: { full_name: 'Parent' } })),
    bookings: [9, 10, 12].map(m => ({ id: `incomplete-${m}`, user_id: 'parent', month: m, year: 2031, status: 'pending_payment', created_at: '2031-09-01T00:00:00Z', payments: [] })),
    payment_review_queue_v1: Array.from({ length: sameMonthCount + 2 }, (_, i) => ({ source_id: `batch-${i}`, source_kind: 'progressive', user_id: 'parent', course_type_id: 'course', status: 'approved', submitted_at: '2031-09-25T00:00:00Z', lesson_month: i < sameMonthCount ? 10 : 9, lesson_year: 2031, slip_storage_path: `private/${i}`, booking_count: 2, total_amount: 1000 })),
    progressive_payment_batch_bookings: Array.from({ length: (sameMonthCount + 2) * 2 }, (_, i) => ({ payment_batch_id: `batch-${Math.floor(i / 2)}`, booking_id: `member-${i}`, bookings: { learner_type: 'child', total_sessions: 1, branches: { name: 'Branch' }, children: { full_name: `Child ${i}` } } })),
    profiles: [{ id: 'parent', full_name: 'Parent', email: '' }], course_types: [{ id: 'course', name: 'kids_group' }],
    booking_sessions: [], children: [], branches: [], system_settings: [],
  }
  const db = { from(table: string) {
    const query: typeof queries[number] = { table, select: '', filters: [] }; queries.push(query)
    const predicates: Array<(row: Row) => boolean> = []
    let single = false
    const builder = {
      select(value: string) { query.select = value; return builder },
      eq(key: string, value: unknown) { query.filters.push([key, value]); predicates.push(row => key.startsWith('bookings.')
        ? (row.bookings as Row)?.[key.slice(9)] === value : row[key] === value); return builder },
      in(key: string, values: unknown[]) { predicates.push(row => values.includes(row[key])); return builder },
      not() { return builder }, order() { return builder },
      range(start: number, end: number) { query.range = [start, end]; return builder },
      maybeSingle() { single = true; return builder },
      then(done: (value: { data: unknown; error: null }) => unknown, rejected?: (reason: unknown) => unknown) {
        const data = (rows[table] || []).flatMap(row => predicates.every(p => p(row)) ? [row]
          : table === 'payments' && !query.select.includes('bookings!inner(') ? [{ ...row, bookings: null }] : [])
        const [start, end] = query.range || [0, 999]
        return Promise.resolve({ data: single ? data[0] || null : data.slice(start, end + 1), error: null }).then(done, rejected)
      },
    }
    return builder
  } }
  const sign = async (path: string | null) => {
    if (!path) return null
    concurrent++; peak = Math.max(peak, concurrent); signed.push(path)
    await new Promise(resolvePromise => setImmediate(resolvePromise))
    concurrent--
    if (path === failPath) throw new Error('Storage signing failed')
    return `signed:${path}`
  }
  const mocks: Record<string, unknown> = {
    '@/components/admin/payments-client': { PaymentsClient: 'PaymentsClient' },
    '@/lib/auth/admin': { requireAdminPageAccess: async () => ({ supabase: db, role }), getServiceRoleClient: () => db },
    '@/lib/progressive-payment-integration': { createProgressiveSlipSignedUrl: sign },
    '@/lib/progressive-pricing-feature': { isProgressivePaymentReviewEnabled: () => true },
    '@/lib/booking-payment-lifecycle': { loadBookingPaymentLifecycle: async () => new Map(), bookingPaymentLifecycleMessage: () => null },
    '@/lib/payment-settings': { PAYMENT_TRANSFER_SETTING_KEY: 'payment_transfer_settings', normalizePaymentTransferSettings: () => ({}) },
  }
  const moduleCache = new Map<string, { exports: Record<string, unknown> }>()
  function load(path: string): Record<string, unknown> {
    if (moduleCache.has(path)) return moduleCache.get(path)!.exports
    const compiled = { exports: {} }; moduleCache.set(path, compiled)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    runInNewContext(code, { exports: compiled.exports, module: compiled, process, console, require: (id: string) => {
      if (id in mocks) return mocks[id]
      if (id.startsWith('@/lib/')) return load(resolve(__dirname, '../../src', id.slice(2) + '.ts'))
      return requireLocal(id)
    } }, { filename: path })
    return compiled.exports
  }
  const page = load(resolve(__dirname, '../../src/app/(admin)/admin/payments/page.tsx')).default as (props: unknown) => Promise<{ props: { payments: Array<Row>; incompleteBookings: Array<Row>; selectedMonth: string } }>
  const result = await page({ searchParams: Promise.resolve({ month }) })
  return { props: result.props, queries, signed, peak }
}

test('selected lesson month filters all three queues before hydration and signs at most four at once', async () => {
  const { props, signed, peak, queries } = await renderPayments()
  expect(props.payments).toHaveLength(622)
  expect(props.incompleteBookings.map(row => row.id)).toEqual(['incomplete-10'])
  expect(props.payments.every(row => row.booking_month === 10 && row.booking_year === 2031)).toBe(true)
  expect(signed).toHaveLength(621)
  expect(new Set(signed).size).toBe(621)
  expect(peak).toBeLessThanOrEqual(4)
  expect(peak).toBeGreaterThan(0)
  expect(props.payments.filter(row => row.source_kind === 'progressive').every(row => row.total_sessions === 2)).toBe(true)
  expect(queries.find(q => q.table === 'payments')?.select).toContain('bookings!inner(')
})

test('more than one page of batches keeps every member and stable payment identity', async () => {
  const result = await renderPayments('2031-10', undefined, 1005)
  expect(result.props.payments).toHaveLength(1006)
  expect(new Set(result.props.payments.map(p => p.id)).size).toBe(1006)
  expect(result.props.payments.filter(p => p.source_kind === 'progressive').every(p => p.total_sessions === 2)).toBe(true)
  expect(result.peak).toBeLessThanOrEqual(4)
})

test('empty and year-boundary months never sign other months', async () => {
  for (const month of ['2031-11', '2032-01', '2030-12']) {
    const result = await renderPayments(month)
    expect(result.props.payments).toEqual([])
    expect(result.props.incompleteBookings).toEqual([])
    expect(result.signed).toEqual([])
  }
  const december = await renderPayments('2031-12')
  expect(december.props.payments.map(p => p.id)).toEqual(['legacy-12'])
})

test('invalid month defaults to the Bangkok month without signing unrelated history', async () => {
  const result = await renderPayments('2031-99')
  expect(result.props.selectedMonth).toBe(getBangkokDateKey().slice(0, 7))
  expect(result.signed).toEqual([])
})

test('signing failure rejects the page instead of hiding a payment or claiming success', async () => {
  await expect(renderPayments('2031-10', 'private/5')).rejects.toThrow('Storage signing failed')
})

test('permitted standard Admin receives no financial amount in serialized page props', async () => {
  const result = await renderPayments('2031-10', undefined, 621, 'admin')
  expect(result.props.payments.every(row => !Object.hasOwn(row, 'amount'))).toBe(true)
  expect(result.props.incompleteBookings.every(row => !Object.hasOwn(row, 'total_price'))).toBe(true)
  expect(result.queries.find(q => q.table === 'payments')?.select).not.toMatch(/\bamount\b/)
})
