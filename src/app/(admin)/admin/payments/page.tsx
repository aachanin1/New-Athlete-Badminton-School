import { PaymentsClient } from '@/components/admin/payments-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

type PaymentStatus = 'pending' | 'approved' | 'rejected'

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  amount?: number | null
  method: string
  slip_image_url: string | null
  status: PaymentStatus
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  bookings?: {
    month: number | null
    year: number | null
    status: string | null
    total_sessions: number | null
    branch_id: string | null
    course_type_id: string | null
    child_id: string | null
    learner_type: string | null
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
    children?: { full_name: string | null; nickname: string | null } | null
  } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

interface VerifierRow {
  id: string
  full_name: string | null
}

interface IncompleteBookingRow {
  id: string
  user_id: string
  child_id: string | null
  learner_type: string | null
  month: number | null
  year: number | null
  total_sessions: number | null
  total_price?: number | null
  status: string | null
  created_at: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
  children?: { full_name: string | null; nickname: string | null } | null
  profiles?: { full_name: string | null; email: string | null; phone: string | null } | null
  payments?: {
    id: string
    status: PaymentStatus | string | null
    slip_image_url: string | null
    created_at: string | null
  }[] | null
}

type AdminPageSupabase = Awaited<ReturnType<typeof requireAdminPageAccess>>['supabase']

interface SessionChildRow {
  id: string
  booking_id: string
  child_id: string | null
}

interface ChildNameRow {
  id: string
  full_name: string | null
  nickname: string | null
}

interface LearnerAggregate {
  name: string
  sessionCount: number
}

const IN_FILTER_CHUNK_SIZE = 100
const RANGE_READ_PAGE_SIZE = 1000

interface QueryError {
  message?: string
}

interface QueryRowsResult<T> {
  data: T[] | null
  error: QueryError | null
}

function getQueryErrorMessage(error: QueryError | null | undefined) {
  return error?.message || 'Unknown query error'
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size))
  }
  return chunks
}

function dedupeRowsById<T extends { id: string }>(rows: T[]) {
  const rowMap = new Map<string, T>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }
  return Array.from(rowMap.values())
}

async function readAllRangePages<T>(
  label: string,
  buildQuery: (start: number, end: number) => Promise<QueryRowsResult<T>>,
) {
  const rows: T[] = []

  // Explicit ranges avoid silent PostgREST caps as payment history grows.
  for (let start = 0; ; start += RANGE_READ_PAGE_SIZE) {
    const end = start + RANGE_READ_PAGE_SIZE - 1
    const { data, error } = await buildQuery(start, end)

    if (error) {
      throw new Error(`[admin/payments] ${label} read failed: ${getQueryErrorMessage(error)}`)
    }

    const pageRows = data || []
    rows.push(...pageRows)

    if (pageRows.length < RANGE_READ_PAGE_SIZE) break
  }

  return rows
}

async function readChunkedRangePages<T>(
  label: string,
  values: string[],
  buildQuery: (chunk: string[], start: number, end: number) => Promise<QueryRowsResult<T>>,
) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  const chunks = chunkArray(uniqueValues, IN_FILTER_CHUNK_SIZE)
  const rows: T[] = []

  for (const [index, chunk] of chunks.entries()) {
    const chunkRows = await readAllRangePages<T>(
      `${label} chunk ${index + 1}/${chunks.length}`,
      (start, end) => buildQuery(chunk, start, end),
    )
    rows.push(...chunkRows)
  }

  return rows
}

function getChildDisplayName(child: { full_name: string | null; nickname: string | null } | null | undefined) {
  return child?.nickname || child?.full_name || null
}

function formatSessionLearnerSummary(names: string[]) {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)))
  if (uniqueNames.length === 0) return null
  if (uniqueNames.length === 1) return uniqueNames[0]
  if (uniqueNames.length <= 4) return uniqueNames.join(', ')

  return `หลายผู้เรียน: ${uniqueNames.slice(0, 4).join(', ')} และอีก ${uniqueNames.length - 4} คน`
}

function getBookingLearnerName(
  bookingChild: { full_name: string | null; nickname: string | null } | null | undefined,
  learnerType: string | null | undefined,
  sessionLearnerSummary: string | null | undefined
) {
  return getChildDisplayName(bookingChild)
    || sessionLearnerSummary
    || (learnerType === 'self' ? 'ผู้เรียนเอง' : 'ไม่ทราบผู้เรียน')
}

async function fetchSessionLearnerNameMap(supabase: AdminPageSupabase, bookingIds: string[]) {
  const uniqueBookingIds = Array.from(new Set(bookingIds.filter(Boolean)))
  const learnerNameMap = new Map<string, string>()

  if (uniqueBookingIds.length === 0) return learnerNameMap

  const sessionRows: SessionChildRow[] = []

  // Booking-id chunks can still return many session rows, so each chunk is range-read.
  sessionRows.push(...dedupeRowsById(await readChunkedRangePages<SessionChildRow>(
    'session learner fallback',
    uniqueBookingIds,
    (chunk, start, end) => supabase
      .from('booking_sessions')
      .select('id, booking_id, child_id')
      .in('booking_id', chunk)
      .not('child_id', 'is', null)
      .order('booking_id', { ascending: true })
      .order('id', { ascending: true })
      .range(start, end) as unknown as Promise<QueryRowsResult<SessionChildRow>>,
  )))

  const childIds = Array.from(new Set(sessionRows.map((row) => row.child_id).filter(Boolean))) as string[]
  if (childIds.length === 0) return learnerNameMap

  const childNameMap = new Map<string, string>()

  const childRows = dedupeRowsById(await readChunkedRangePages<ChildNameRow>(
    'child names for payment fallback',
    childIds,
    (chunk, start, end) => supabase
      .from('children')
      .select('id, full_name, nickname')
      .in('id', chunk)
      .order('id', { ascending: true })
      .range(start, end) as unknown as Promise<QueryRowsResult<ChildNameRow>>,
  ))

  for (const child of childRows) {
    const name = getChildDisplayName(child)
    if (name) childNameMap.set(child.id, name)
  }

  const learnersByBooking = new Map<string, Map<string, LearnerAggregate>>()

  for (const row of sessionRows) {
    if (!row.child_id) continue

    const childName = childNameMap.get(row.child_id)
    if (!childName) continue

    const learners = learnersByBooking.get(row.booking_id) || new Map<string, LearnerAggregate>()
    const learner = learners.get(row.child_id) || { name: childName, sessionCount: 0 }
    learner.sessionCount += 1
    learners.set(row.child_id, learner)
    learnersByBooking.set(row.booking_id, learners)
  }

  for (const [bookingId, learners] of learnersByBooking) {
    const learnerEntries = Array.from(learners.entries())
    const allLearnersHaveSameCount = learnerEntries.every(([, learner]) => (
      learner.sessionCount === learnerEntries[0]?.[1].sessionCount
    ))
    const orderedNames = learnerEntries
      .sort(([childIdA, learnerA], [childIdB, learnerB]) => {
        if (learnerA.sessionCount !== learnerB.sessionCount) {
          return learnerB.sessionCount - learnerA.sessionCount
        }

        if (allLearnersHaveSameCount) {
          return learnerA.name.localeCompare(learnerB.name, 'th')
        }

        return childIdA.localeCompare(childIdB)
      })
      .map(([, learner]) => learner.name)
    const summary = formatSessionLearnerSummary(orderedNames)
    if (summary) learnerNameMap.set(bookingId, summary)
  }

  return learnerNameMap
}

export default async function PaymentsPage() {
  const { supabase, role } = await requireAdminPageAccess()
  const canViewFinancialAmounts = role === 'super_admin'

  const payments = await readAllRangePages<PaymentRow>('payments', (start, end) => supabase
    .from('payments')
    .select(`
      id, booking_id, user_id, ${canViewFinancialAmounts ? 'amount,' : ''} method, slip_image_url,
      status, verified_by, verified_at, notes, created_at,
      bookings(month, year, status, total_sessions, branch_id, course_type_id, child_id, learner_type,
        branches(name),
        course_types(name),
        children(full_name, nickname)
      ),
      profiles!payments_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(start, end) as unknown as Promise<QueryRowsResult<PaymentRow>>
  )

  const incompleteBookings = await readAllRangePages<IncompleteBookingRow>('incomplete bookings', (start, end) => supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      child_id,
      learner_type,
      month,
      year,
      total_sessions,
      ${canViewFinancialAmounts ? 'total_price,' : ''}
      status,
      created_at,
      branches(name),
      course_types(name),
      children(full_name, nickname),
      profiles!bookings_user_id_fkey(full_name, email, phone),
      payments(id, status, slip_image_url, created_at)
    `)
    .in('status', ['pending_payment', 'paid'])
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(start, end) as unknown as Promise<QueryRowsResult<IncompleteBookingRow>>
  )

  const sessionLearnerNameByBookingId = await fetchSessionLearnerNameMap(supabase, [
    ...payments.map((payment) => payment.booking_id),
    ...incompleteBookings.map((booking) => booking.id),
  ])

  // Fetch verifier names
  const verifierIds = Array.from(new Set(payments.map((p) => p.verified_by).filter(Boolean))) as string[]
  let verifierMap: Record<string, string> = {}
  if (verifierIds.length > 0) {
    const verifiers = dedupeRowsById(await readChunkedRangePages<VerifierRow>(
      'payment verifiers',
      verifierIds,
      (chunk, start, end) => supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', chunk)
        .order('id', { ascending: true })
        .range(start, end) as unknown as Promise<QueryRowsResult<VerifierRow>>,
    ))

    verifierMap = verifiers.reduce((m: Record<string, string>, v) => {
      m[v.id] = v.full_name || ''
      return m
    }, {})
  }

  const { data: paymentSetting, error: paymentSettingError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', PAYMENT_TRANSFER_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null; error: QueryError | null }

  if (paymentSettingError) {
    throw new Error(`[admin/payments] payment transfer setting read failed: ${getQueryErrorMessage(paymentSettingError)}`)
  }

  // Transform data
  const paymentList = payments.map((p) => ({
    id: p.id,
    booking_id: p.booking_id,
    user_id: p.user_id,
    amount: canViewFinancialAmounts ? (p.amount ?? 0) : null,
    method: p.method,
    slip_image_url: p.slip_image_url,
    status: ['pending', 'approved', 'rejected'].includes(p.status) ? p.status : 'pending',
    verified_by: p.verified_by,
    verified_at: p.verified_at,
    notes: p.notes,
    created_at: p.created_at,
    user_name: p.profiles?.full_name || 'ไม่ทราบ',
    user_email: p.profiles?.email || '',
    booking_month: p.bookings?.month || 0,
    booking_year: p.bookings?.year || 0,
    booking_status: p.bookings?.status || '',
    branch_name: p.bookings?.branches?.name || 'ไม่ทราบ',
    course_type: p.bookings?.course_types?.name || '',
    total_sessions: p.bookings?.total_sessions || 0,
    learner_name: getBookingLearnerName(
      p.bookings?.children,
      p.bookings?.learner_type,
      sessionLearnerNameByBookingId.get(p.booking_id)
    ),
    verified_by_name: p.verified_by ? (verifierMap[p.verified_by] || null) : null,
  }))

  const incompleteBookingList = incompleteBookings.map((booking) => {
    const latestPayment = [...(booking.payments || [])].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })[0] || null

    return {
      id: booking.id,
      user_id: booking.user_id,
      user_name: booking.profiles?.full_name || 'ไม่ทราบ',
      user_email: booking.profiles?.email || '',
      user_phone: booking.profiles?.phone || '',
      learner_name: getBookingLearnerName(
        booking.children,
        booking.learner_type,
        sessionLearnerNameByBookingId.get(booking.id)
      ),
      branch_name: booking.branches?.name || 'ไม่ทราบ',
      course_type: booking.course_types?.name || '',
      month: booking.month || 0,
      year: booking.year || 0,
      total_sessions: booking.total_sessions || 0,
      total_price: canViewFinancialAmounts ? (booking.total_price || 0) : null,
      status: booking.status || '',
      created_at: booking.created_at,
      latest_payment_id: latestPayment?.id || null,
      latest_payment_status: latestPayment?.status || null,
      has_slip: Boolean(latestPayment?.slip_image_url),
    }
  })

  return (
    <PaymentsClient
      payments={paymentList}
      incompleteBookings={incompleteBookingList}
      paymentTransferSettings={normalizePaymentTransferSettings(paymentSetting?.value)}
      slipOkMode={process.env.SLIPOK_TEST_MODE === 'true' ? 'test' : 'live'}
      canViewFinancialAmounts={canViewFinancialAmounts}
    />
  )
}
