import { getAdultGroupTotal, getKidsGroupIncremental, getPrivateTotal, type CourseCategory, type PricingTierInput } from '@/lib/pricing'

interface BookingPricingParams {
  supabase: SupabaseQueryClient
  userId: string
  courseTypeId: string
  courseTypeName: CourseCategory
  month: number
  year: number
  newSessions: number
  existingStatuses?: string[]
  excludeBookingId?: string
}

interface SupabaseQueryClient {
  from(table: string): unknown
}

interface ExistingBookingRow {
  id: string
  total_sessions: number
  total_price: number
}

interface ExistingBookingQuery extends PromiseLike<{ data: ExistingBookingRow[] | null }> {
  eq(column: string, value: string | number): ExistingBookingQuery
  in(column: string, values: string[]): ExistingBookingQuery
  neq(column: string, value: string): ExistingBookingQuery
}

interface ExistingBookingTable {
  select(columns: string): ExistingBookingQuery
}

export interface BookingBasePricePreview {
  totalPrice: number
  selectedTier: import('@/lib/pricing').SelectedPricingTierEvidence
  existingSessions: number
  existingPaid: number
  totalSessionsAfter: number
}

export async function fetchPricingTiers(supabase: SupabaseQueryClient) {
  const pricingTable = supabase.from('pricing_tiers') as {
    select(columns: string): {
      order(column: string, options?: { ascending?: boolean }): Promise<{ data: PricingTierInput[] | null }>
    }
  }

  const { data } = await pricingTable
    .select(`
      id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from, valid_to, created_at,
      course_types(name)
    `)
    .order('min_sessions', { ascending: true })

  return (data || []) as PricingTierInput[]
}

export async function calculateBookingBasePricePreview({
  supabase,
  userId,
  courseTypeId,
  courseTypeName,
  month,
  year,
  newSessions,
  existingStatuses = ['paid', 'verified'],
  excludeBookingId,
}: BookingPricingParams) {
  const pricingTiers = await fetchPricingTiers(supabase)

  if (courseTypeName === 'kids_group') {
    const bookingsTable = supabase.from('bookings') as ExistingBookingTable
    let query = bookingsTable
      .select('id, total_sessions, total_price')
      .eq('user_id', userId)
      .eq('course_type_id', courseTypeId)
      .eq('month', month)
      .eq('year', year)
      .in('status', existingStatuses)

    if (excludeBookingId) {
      query = query.neq('id', excludeBookingId)
    }

    const { data: existingBookings } = await query as { data: ExistingBookingRow[] | null }

    const existing = (existingBookings || []) as ExistingBookingRow[]
    const existingSessions = existing.reduce((sum, booking) => sum + Number(booking.total_sessions || 0), 0)
    const existingPaid = existing.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
    const pricing = getKidsGroupIncremental(existingSessions, existingPaid, newSessions, pricingTiers)
    return {
      totalPrice: pricing.incrementalPrice,
      selectedTier: pricing.selectedTier,
      existingSessions,
      existingPaid,
      totalSessionsAfter: pricing.totalSessionsForMonth,
    }
  }

  if (courseTypeName === 'adult_group') {
    const pricing = getAdultGroupTotal(newSessions, pricingTiers)
    return {
      totalPrice: pricing.total,
      selectedTier: pricing.selectedTier,
      existingSessions: 0,
      existingPaid: 0,
      totalSessionsAfter: newSessions,
    }
  }

  const pricing = getPrivateTotal(newSessions, pricingTiers)
  return {
    totalPrice: pricing.total,
    selectedTier: pricing.selectedTier,
    existingSessions: 0,
    existingPaid: 0,
    totalSessionsAfter: newSessions,
  }
}

export async function calculateBookingBasePrice(params: BookingPricingParams) {
  const preview = await calculateBookingBasePricePreview(params)
  return preview.totalPrice
}
