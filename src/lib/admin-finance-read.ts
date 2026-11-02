import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentLedgerAllocationRow } from '@/types/database'
import type { FinancePeriod } from '@/lib/admin-finance-period'

interface FinanceReadResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

const FINANCE_PAGE_SIZE = 500

export async function readCompleteFinanceRows<T>(
  label: string,
  readPage: (start: number, end: number) => PromiseLike<FinanceReadResult<T>>,
  rowKey: (row: T) => string,
): Promise<T[]> {
  const rows: T[] = []
  const keys = new Set<string>()
  let expectedCount: number | undefined

  for (let start = 0; ; start += FINANCE_PAGE_SIZE) {
    const { data, error, count } = await readPage(start, start + FINANCE_PAGE_SIZE - 1)
    if (error) throw new Error(`[admin/finance] ${label} read failed: ${error.message}`)
    if (!data || count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`[admin/finance] ${label} read missing exact count or rows`)
    }
    expectedCount ??= count
    if (count !== expectedCount || data.length !== Math.min(FINANCE_PAGE_SIZE, Math.max(0, count - start))) {
      throw new Error(`[admin/finance] ${label} read incomplete or changed during pagination`)
    }
    for (const row of data) {
      const key = rowKey(row)
      if (!key || keys.has(key)) throw new Error(`[admin/finance] ${label} read duplicate row`)
      keys.add(key)
      rows.push(row)
    }
    if (rows.length === expectedCount) return rows
  }
}

export async function loadProgressiveFinanceAllocations(service: SupabaseClient, period: FinancePeriod) {
  // The UNION ledger view has no usable embedded Booking relationship. Select
  // the period's IDs first, then constrain every ledger request to bounded IDs.
  const bookingIds = await readCompleteFinanceRows<{ id: string }>('period booking IDs', (start, end) => {
    let query = service.from('bookings').select('id', { count: 'exact' }).eq('year', period.year)
    if (period.mode === 'month') query = query.eq('month', period.month)
    return query.order('id').range(start, end)
  }, (row) => row.id)

  const allocations: PaymentLedgerAllocationRow[] = []
  for (let offset = 0; offset < bookingIds.length; offset += BOOKING_READ_SIZE * BOOKING_READ_CONCURRENCY) {
    const chunks: string[][] = []
    for (let index = offset; index < Math.min(offset + BOOKING_READ_SIZE * BOOKING_READ_CONCURRENCY, bookingIds.length); index += BOOKING_READ_SIZE) {
      chunks.push(bookingIds.slice(index, index + BOOKING_READ_SIZE).map((row) => row.id))
    }
    const results = await Promise.all(chunks.map((ids) => readCompleteFinanceRows<PaymentLedgerAllocationRow>(
      'progressive ledger',
      (start, end) => service.from('payment_ledger_allocations_v1')
        .select('*', { count: 'exact' })
        .eq('source_kind', 'progressive').eq('status', 'approved').in('booking_id', ids)
        .order('source_id').order('booking_id').range(start, end),
      (row) => `${row.source_id}:${row.booking_id}`,
    )))
    allocations.push(...results.flat())
  }
  return allocations
}

export async function loadFinanceYears(supabase: SupabaseClient, period: FinancePeriod) {
  const bounds = await Promise.all([
    ['bookings', 'year'], ['finance_expenses', 'expense_date'], ['coach_weekly_teaching_summaries', 'week_start'],
  ].flatMap(([table, column]) => [true, false].map(async (ascending) => {
    const { data, error } = await supabase.from(table).select(column)
      .not(column, 'is', null).order(column, { ascending }).limit(1)
    if (error) throw new Error(`[admin/finance] year options read failed: ${error.message}`)
    const value = (data as unknown as Record<string, string | number>[] | null)?.[0]?.[column]
    return value === undefined ? undefined : Number(String(value).slice(0, 4))
  })))
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date()))
  const years = [...bounds, currentYear, period.year].filter((value): value is number => value !== undefined && Number.isInteger(value) && value >= 1000 && value <= 9999)
  const first = Math.min(...years), last = Math.max(...years)
  return Array.from({ length: last - first + 1 }, (_, index) => last - index)
}

export interface ProgressiveFinanceBookingRow {
  id: string
  total_price: number | string
  month: number
  year: number
  total_sessions: number
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

const BOOKING_READ_SIZE = 100
const BOOKING_READ_CONCURRENCY = 4

export async function loadProgressiveFinanceBookings(
  service: SupabaseClient,
  bookingIds: string[],
): Promise<ProgressiveFinanceBookingRow[]> {
  const ids = Array.from(new Set(bookingIds))
  const bookings: ProgressiveFinanceBookingRow[] = []

  // Bound URL size and concurrency without changing the selected ledger scope.
  for (let offset = 0; offset < ids.length; offset += BOOKING_READ_SIZE * BOOKING_READ_CONCURRENCY) {
    const chunks: string[][] = []
    for (let index = offset; index < Math.min(offset + BOOKING_READ_SIZE * BOOKING_READ_CONCURRENCY, ids.length); index += BOOKING_READ_SIZE) {
      chunks.push(ids.slice(index, index + BOOKING_READ_SIZE))
    }
    const results = await Promise.all(chunks.map(async (chunk) => {
      const { data, error } = await service.from('bookings').select(`
        id, total_price, month, year, total_sessions,
        branches(name), course_types(name), profiles!bookings_user_id_fkey(full_name, email)
      `).in('id', chunk)
      if (error) throw new Error(`[admin/finance] progressive booking read failed: ${error.message}`)

      const rows = (data || []) as unknown as ProgressiveFinanceBookingRow[]
      const returnedIds = new Set(rows.map((row) => row.id))
      if (rows.length !== chunk.length || returnedIds.size !== chunk.length || chunk.some((id) => !returnedIds.has(id))) {
        throw new Error('[admin/finance] progressive booking read incomplete')
      }
      return rows
    }))
    bookings.push(...results.flat())
  }

  return bookings
}
