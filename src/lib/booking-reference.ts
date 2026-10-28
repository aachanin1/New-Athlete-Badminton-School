const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Display only. Routes and mutations always use the complete, authorized UUID. */
export function bookingReference(id: string, visibleIds: string[] = []) {
  if (!uuid.test(id)) return 'ไม่มีข้อมูลรหัสรายการ'
  const full = id.replaceAll('-', '').toUpperCase()
  let length = 12
  while (length < 32 && visibleIds.some(other => other.toLowerCase() !== id.toLowerCase() && other.replaceAll('-', '').toUpperCase().startsWith(full.slice(0, length)))) length += 4
  return 'BK-' + full.slice(0, length).match(/.{1,4}/g)!.join('-')
}

export function historyBookingIds(value: string | string[] | undefined) {
  if (typeof value !== 'string') return []
  const ids = value.split(',')
  if (!ids.length || ids.length > 100 || ids.some(id => !uuid.test(id))) return []
  return [...new Set(ids.map(id => id.toLowerCase()))]
}

export function bookingHistoryHref(ids: string[]) {
  const valid = historyBookingIds(ids.join(','))
  return '/dashboard/history' + (valid.length ? '?orders=' + encodeURIComponent(valid.join(',')) : '')
}
