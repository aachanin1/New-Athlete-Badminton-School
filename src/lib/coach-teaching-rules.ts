export type CoachEmploymentType = 'full_time' | 'half_time' | 'part_time'

export const COACH_TEACHING_RULES_SETTING_KEY = 'coach_teaching_rules_settings'

export interface CoachTeachingRule {
  employmentType: CoachEmploymentType
  label: string
  shortLabel: string
  thresholdHours: number
  privateRate: number
  groupRate: number
  paysAllHours: boolean
}

export type CoachTeachingRules = Record<CoachEmploymentType, CoachTeachingRule>

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

export interface TeachingWeekInfo {
  key: string
  end: string
  weekStart: string
  weekEnd: string
  label: string
}

export const COACH_TEACHING_RULES: CoachTeachingRules = {
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

const COACH_EMPLOYMENT_ORDER: CoachEmploymentType[] = ['full_time', 'half_time', 'part_time']
const INPUT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/

export const COACH_EMPLOYMENT_OPTIONS = Object.values(COACH_TEACHING_RULES)

export function normalizeCoachEmploymentType(value: unknown): CoachEmploymentType | null {
  return value === 'full_time' || value === 'half_time' || value === 'part_time' ? value : null
}

function toNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function normalizeCoachTeachingRulesSettings(value: unknown): CoachTeachingRules {
  const source = value && typeof value === 'object'
    ? (value as { rules?: unknown })
    : {}
  const rawRules = source.rules && typeof source.rules === 'object'
    ? source.rules as Partial<Record<CoachEmploymentType, Partial<CoachTeachingRule>>>
    : source as Partial<Record<CoachEmploymentType, Partial<CoachTeachingRule>>>

  return COACH_EMPLOYMENT_ORDER.reduce<CoachTeachingRules>((rules, employmentType) => {
    const defaults = COACH_TEACHING_RULES[employmentType]
    const rawRule = rawRules[employmentType] || {}

    rules[employmentType] = {
      ...defaults,
      thresholdHours: defaults.paysAllHours
        ? toNonNegativeNumber(rawRule.thresholdHours, defaults.thresholdHours)
        : toPositiveNumber(rawRule.thresholdHours, defaults.thresholdHours),
      privateRate: toNonNegativeNumber(rawRule.privateRate, defaults.privateRate),
      groupRate: toNonNegativeNumber(rawRule.groupRate, defaults.groupRate),
    }

    return rules
  }, {} as CoachTeachingRules)
}

export function getCoachTeachingOptions(rules: CoachTeachingRules = COACH_TEACHING_RULES) {
  return COACH_EMPLOYMENT_ORDER.map((employmentType) => rules[employmentType])
}

export function getCoachTeachingRule(employmentType: CoachEmploymentType, rules: CoachTeachingRules = COACH_TEACHING_RULES) {
  return rules[employmentType] || COACH_TEACHING_RULES[employmentType]
}

function parseInputDate(value: string) {
  const match = INPUT_DATE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return new Date(Date.UTC(year, month - 1, day))
}

function parseTimeToMinutes(value: string) {
  const match = TIME_PATTERN.exec(value)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  return hour * 60 + minute
}

export function getHoursBetween(date: string, startTime: string, endTime: string) {
  void date
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start === null || end === null) return 0
  return Math.max(0, (end - start) / 60)
}

export function isPrivateCourse(courseType: string) {
  const value = courseType.toLowerCase()
  return value.includes('private') || value.includes('ส่วน') || value.includes('personal')
}

export function formatInputDate(value: Date) {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysToInputDate(dateValue: string, days: number) {
  const date = parseInputDate(dateValue)
  if (!date) return dateValue
  date.setUTCDate(date.getUTCDate() + days)
  return formatInputDate(date)
}

export function getTeachingWeekInfoBangkok(dateValue: string): TeachingWeekInfo {
  const date = parseInputDate(dateValue)
  if (!date) {
    return {
      key: dateValue,
      end: dateValue,
      weekStart: dateValue,
      weekEnd: dateValue,
      label: `${dateValue} - ${dateValue}`,
    }
  }

  const start = new Date(date)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  start.setUTCDate(date.getUTCDate() - daysSinceMonday)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const weekStart = formatInputDate(start)
  const weekEnd = formatInputDate(end)

  return {
    key: weekStart,
    end: weekEnd,
    weekStart,
    weekEnd,
    label: `${weekStart} - ${weekEnd}`,
  }
}

export function getWeekInfo(dateValue: string) {
  return getTeachingWeekInfoBangkok(dateValue)
}

export function isCanonicalTeachingWeekRangeBangkok(weekStart: string, weekEnd: string) {
  const week = getTeachingWeekInfoBangkok(weekStart)
  return week.weekStart === weekStart && week.weekEnd === weekEnd
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
