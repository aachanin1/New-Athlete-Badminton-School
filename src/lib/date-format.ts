const BANGKOK_TIME_ZONE = 'Asia/Bangkok'
const INPUT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_COMPACT_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const thaiShortDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: BANGKOK_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: '2-digit',
})

const thaiLongDateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: BANGKOK_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const thaiTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const thaiMonthYearFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: BANGKOK_TIME_ZONE,
  month: 'long',
  year: 'numeric',
})

const thaiShortMonthYearFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: BANGKOK_TIME_ZONE,
  month: 'short',
  year: '2-digit',
})

const bangkokDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function partsToDateKey(parts: Intl.DateTimeFormatPart[]) {
  const values = parts.reduce((map, part) => {
    if (part.type !== 'literal') map[part.type] = part.value
    return map
  }, {} as Record<string, string>)

  return `${values.year}-${values.month}-${values.day}`
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime())
}

export function isValidDateKey(value: string) {
  if (!INPUT_DATE_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export function getBangkokDateKey(date: Date | string = new Date()): string {
  if (typeof date === 'string' && INPUT_DATE_PATTERN.test(date)) return date

  const parsed = typeof date === 'string' ? new Date(date) : date
  if (!isValidDate(parsed)) return typeof date === 'string' ? date.slice(0, 10) : ''

  return partsToDateKey(bangkokDateKeyFormatter.formatToParts(parsed))
}

export function parseBangkokDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+07:00`)
}

export function addCalendarDaysToDateKey(dateKey: string, days: number): string {
  if (!isValidDateKey(dateKey) || !Number.isInteger(days)) return dateKey

  const [year, month, day] = dateKey.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function getWeekday(dateKey: string, compact = false) {
  if (!INPUT_DATE_PATTERN.test(dateKey)) return ''

  const [year, month, day] = dateKey.split('-').map(Number)
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return compact ? THAI_COMPACT_WEEKDAYS[weekdayIndex] : THAI_WEEKDAYS[weekdayIndex]
}

export function formatThaiShortDate(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return thaiShortDateFormatter.format(parseBangkokDate(dateKey))
}

export function formatNotificationSlotDateTime(
  dateKey: string,
  startTime: string,
  endTime: string,
): string {
  return `${formatThaiShortDate(dateKey)} ${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`
}

export function formatThaiLongDate(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return thaiLongDateFormatter.format(parseBangkokDate(dateKey))
}

export function formatThaiDateWithWeekday(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return `${getWeekday(dateKey)} ${formatThaiShortDate(dateKey)}`
}

export function formatThaiCompactDateWithWeekday(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return `${getWeekday(dateKey, true)} ${formatThaiShortDate(dateKey)}`
}

export function formatThaiDateRangeWithWeekday(start: Date | string, end: Date | string): string {
  return `${formatThaiDateWithWeekday(start)} - ${formatThaiDateWithWeekday(end)}`
}

export function formatThaiDateTimeWithWeekday(value: Date | string): string {
  const parsed = typeof value === 'string'
    ? INPUT_DATE_PATTERN.test(value) ? parseBangkokDate(value) : new Date(value)
    : value

  if (!isValidDate(parsed)) return typeof value === 'string' ? value : '-'

  return `${formatThaiDateWithWeekday(parsed)} ${thaiTimeFormatter.format(parsed)}`
}

export function formatThaiMonthYear(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return thaiMonthYearFormatter.format(parseBangkokDate(dateKey))
}

export function formatThaiShortMonthYear(value: Date | string): string {
  const dateKey = getBangkokDateKey(value)
  if (!INPUT_DATE_PATTERN.test(dateKey)) return dateKey || '-'
  return thaiShortMonthYearFormatter.format(parseBangkokDate(dateKey))
}
