/** Order by the actual confirmation event; unconfirmed/old records use creation. */
export function bookingHistoryTime(booking: { id: string; status: string; created_at: string }, verifiedAt: Record<string, string>) {
  const confirmed = booking.status === 'verified' ? Date.parse(verifiedAt[booking.id]) : NaN
  const created = Date.parse(booking.created_at)
  return Number.isFinite(confirmed) ? confirmed : Number.isFinite(created) ? created : 0
}

export function bookingHistoryMonth(time: number) {
  return new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}
