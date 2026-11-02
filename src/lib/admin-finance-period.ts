import { getBangkokDateKey } from '@/lib/date-format'

export interface FinancePeriod {
  mode: 'month' | 'year'
  month: number
  year: number
}

export function getFinancePeriod(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
): FinancePeriod {
  const [currentYear, currentMonth] = getBangkokDateKey(now).split('-').map(Number)
  const month = typeof params.month === 'string' && /^(?:[1-9]|1[0-2])$/.test(params.month)
    ? Number(params.month) : currentMonth
  const year = typeof params.year === 'string' && /^[1-9]\d{3}$/.test(params.year)
    ? Number(params.year) : currentYear
  return { mode: params.mode === 'year' ? 'year' : 'month', month, year }
}

export function financePeriodHref(period: FinancePeriod) {
  const params = new URLSearchParams({ mode: period.mode, month: String(period.month), year: String(period.year) })
  return `/admin/finance?${params}`
}

export function financePeriodDateRange(period: FinancePeriod) {
  const startMonth = period.mode === 'year' ? 1 : period.month
  const endMonth = period.mode === 'year' ? 1 : period.month % 12 + 1
  const endYear = period.mode === 'year' || period.month === 12 ? period.year + 1 : period.year
  const dateKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`
  return { start: dateKey(period.year, startMonth), end: dateKey(endYear, endMonth) }
}
