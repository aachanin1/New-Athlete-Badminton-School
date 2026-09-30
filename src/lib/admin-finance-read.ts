import type { SupabaseClient } from '@supabase/supabase-js'

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
