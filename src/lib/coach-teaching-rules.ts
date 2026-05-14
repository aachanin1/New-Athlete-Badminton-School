export type CoachEmploymentType = 'full_time' | 'half_time' | 'part_time'

export interface CoachTeachingRule {
  employmentType: CoachEmploymentType
  label: string
  shortLabel: string
  thresholdHours: number
  privateRate: number
  groupRate: number
  paysAllHours: boolean
}

export interface TeachingSlotForCalculation {
  date: string
  start_time: string
  end_time: string
  course_type: string
}

export interface TeachingPayEntry<TSlot extends TeachingSlotForCalculation> {
  row: TSlot
  hours: number
  regularHours: number
  payableHours: number
  payableAmount: number
  isPrivate: boolean
  weekKey: string
  weekEnd: string
  weekLabel: string
}

export const COACH_TEACHING_RULES: Record<CoachEmploymentType, CoachTeachingRule> = {
  full_time: {
    employmentType: 'full_time',
    label: 'Full-Time',
    shortLabel: 'FT',
    thresholdHours: 25,
    privateRate: 400,
    groupRate: 200,
    paysAllHours: false,
  },
  half_time: {
    employmentType: 'half_time',
    label: 'Half-Time',
    shortLabel: 'HT',
    thresholdHours: 12.5,
    privateRate: 400,
    groupRate: 200,
    paysAllHours: false,
  },
  part_time: {
    employmentType: 'part_time',
    label: 'Part-Time',
    shortLabel: 'PT',
    thresholdHours: 0,
    privateRate: 400,
    groupRate: 250,
    paysAllHours: true,
  },
}

export const COACH_EMPLOYMENT_OPTIONS = Object.values(COACH_TEACHING_RULES)

export function normalizeCoachEmploymentType(value: unknown): CoachEmploymentType | null {
  return value === 'full_time' || value === 'half_time' || value === 'part_time' ? value : null
}

export function getCoachTeachingRule(employmentType: CoachEmploymentType) {
  return COACH_TEACHING_RULES[employmentType]
}

export function getHoursBetween(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
}

export function isPrivateCourse(courseType: string) {
  const value = courseType.toLowerCase()
  return value.includes('private') || value.includes('ส่วน') || value.includes('personal')
}

export function formatInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekInfo(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    key: formatInputDate(start),
    end: formatInputDate(end),
  }
}

export function calculateTeachingPayEntries<TSlot extends TeachingSlotForCalculation>(
  rows: TSlot[],
  rule: CoachTeachingRule,
): TeachingPayEntry<TSlot>[] {
  const weeklyHours = new Map<string, number>()

  return [...rows]
    .sort((a, b) => `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`))
    .map((row) => {
      const hours = getHoursBetween(row.date, row.start_time, row.end_time)
      const week = getWeekInfo(row.date)
      const usedHours = weeklyHours.get(week.key) || 0
      const regularCapacity = rule.paysAllHours ? 0 : Math.max(0, rule.thresholdHours - usedHours)
      const regularHours = rule.paysAllHours ? 0 : Math.min(hours, regularCapacity)
      const payableHours = rule.paysAllHours ? hours : Math.max(0, hours - regularHours)
      const isPrivate = isPrivateCourse(row.course_type)
      const payableAmount = payableHours * (isPrivate ? rule.privateRate : rule.groupRate)

      weeklyHours.set(week.key, usedHours + hours)

      return {
        row,
        hours,
        regularHours,
        payableHours,
        payableAmount,
        isPrivate,
        weekKey: week.key,
        weekEnd: week.end,
        weekLabel: `${week.key} - ${week.end}`,
      }
    })
}
