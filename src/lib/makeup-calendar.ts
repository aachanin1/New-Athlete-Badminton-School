import { addCalendarDaysToDateKey, getBangkokDateKey, isValidDateKey, parseBangkokDate } from './date-format'
import { getBangkokDayOfWeek, normalizeScheduleTime, type ScheduleTemplateOption, type TimeSlot } from './schedule-template-utils'

export interface MakeupCalendarBranch { id: string; name: string; slug: string }
export interface MakeupCalendarDay {
  dateInput: string
  dayOfWeek: number
  slotsByBranch: { branch: MakeupCalendarBranch; slots: TimeSlot[] }[]
}
export interface MakeupCalendarSlot {
  date: string; dayOfWeek: number; start: string; end: string
  branchId: string; branchName: string; templateId?: string
}

export function makeupMonthDates(month: string): string[] {
  const first = `${month}-01`
  if (!/^\d{4}-\d{2}$/.test(month) || !isValidDateKey(first)) return []
  const dates: string[] = []
  for (let date = first; date.startsWith(`${month}-`); date = addCalendarDaysToDateKey(date, 1)) dates.push(date)
  return dates
}

export function makeupCalendarCells(month: string, days: MakeupCalendarDay[]) {
  const dates = makeupMonthDates(month)
  const byDate = new Map(days.map(day => [day.dateInput, day]))
  const cells: ({ dateInput: string; availableDay: MakeupCalendarDay | null } | null)[] = []
  for (let n = 0; n < (getBangkokDayOfWeek(dates[0] || '') || 0); n++) cells.push(null)
  for (const dateInput of dates) cells.push({ dateInput, availableDay: byDate.get(dateInput) || null })
  return cells
}

// Presentation availability only. Server state and atomic consume remain authoritative.
export function kidsMakeupCalendarDays(month: string, branches: MakeupCalendarBranch[], templates: ScheduleTemplateOption[], now: Date): MakeupCalendarDay[] {
  const today = getBangkokDateKey(now)
  if (!today) return []
  return makeupMonthDates(month).filter(date => date >= today).flatMap(dateInput => {
    const dayOfWeek = getBangkokDayOfWeek(dateInput)!
    const slotsByBranch = branches.map(branch => ({ branch, slots: templates.flatMap(template => {
      if (!template.is_active || template.course_type_name !== 'kids_group' || template.branch_id !== branch.id
        || template.branch_slug !== branch.slug || template.day_of_week !== dayOfWeek) return []
      const start = normalizeScheduleTime(template.start_time, dateInput)
      const end = normalizeScheduleTime(template.end_time, dateInput)
      if (!start || !end || end <= start) return []
      const [hours, minutes, seconds] = start.split(':').map(Number)
      const startsAt = parseBangkokDate(dateInput).getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1000
      if (startsAt <= now.getTime()) return []
      return [{ start, end, templateId: template.id }]
    }).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.templateId.localeCompare(b.templateId)) }))
      .filter(item => item.slots.length > 0)
    return slotsByBranch.length ? [{ dateInput, dayOfWeek, slotsByBranch }] : []
  })
}

export function findKidsMakeupSlot(month: string, date: string, templateId: string, branches: MakeupCalendarBranch[], templates: ScheduleTemplateOption[], now: Date): MakeupCalendarSlot | null {
  const day = kidsMakeupCalendarDays(month, branches, templates, now).find(item => item.dateInput === date)
  for (const item of day?.slotsByBranch || []) {
    const slot = item.slots.find(candidate => candidate.templateId === templateId)
    if (slot) return { ...slot, date, dayOfWeek: day!.dayOfWeek, branchId: item.branch.id, branchName: item.branch.name }
  }
  return null
}
