import { formatThaiShortDate, isValidDateKey } from '@/lib/date-format'

interface NotificationDisplayInput {
  title: string
  message: string
  linkUrl: string | null
}

const COACH_NOTIFICATION_TITLES_WITH_SLOT_DATE = new Set([
  'ได้รับมอบหมายรอบสอน',
  'เช็คอินสำเร็จ อย่าลืมเช็คชื่อ',
  'ยังเช็คชื่อนักเรียนไม่ครบ',
])

const INTERNAL_COACH_ORIGIN = 'https://notification-display.invalid'
const SLOT_DATE_TOKEN_PATTERN = /^((?:คุณได้รับมอบหมายให้สอน|รอบ)\s+)(\d{1,2}\s[^\s\d]+\s\d{2})(?=\s\d{2}:\d{2}-\d{2}:\d{2}(?:\s|$))/

function getCoachLinkDateKey(linkUrl: string | null): string | null {
  if (!linkUrl?.startsWith('/coach/')) return null

  try {
    const parsed = new URL(linkUrl, INTERNAL_COACH_ORIGIN)
    if (parsed.origin !== INTERNAL_COACH_ORIGIN || !parsed.pathname.startsWith('/coach/')) return null

    const dateValues = parsed.searchParams.getAll('date')
    if (dateValues.length !== 1 || !isValidDateKey(dateValues[0])) return null
    return dateValues[0]
  } catch {
    return null
  }
}

export function normalizeNotificationDisplayMessage({
  title,
  message,
  linkUrl,
}: NotificationDisplayInput): string {
  if (!COACH_NOTIFICATION_TITLES_WITH_SLOT_DATE.has(title)) return message

  const dateKey = getCoachLinkDateKey(linkUrl)
  if (!dateKey) return message

  const match = message.match(SLOT_DATE_TOKEN_PATTERN)
  if (!match) return message

  const canonicalDate = formatThaiShortDate(dateKey)
  if (match[2] === canonicalDate) return message

  return message.replace(SLOT_DATE_TOKEN_PATTERN, `$1${canonicalDate}`)
}

export function matchesNotificationDisplaySearch(
  title: string,
  displayMessage: string,
  search: string,
): boolean {
  const query = search.toLowerCase()
  return title.toLowerCase().includes(query) || displayMessage.toLowerCase().includes(query)
}
