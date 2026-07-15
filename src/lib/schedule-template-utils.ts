import type { CourseTypeName } from '@/types/database'

const COURSE_TYPE_NAMES: CourseTypeName[] = ['kids_group', 'adult_group', 'private']
const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

export function normalizeCourseTypeName(value: string | null | undefined): CourseTypeName | null {
  return COURSE_TYPE_NAMES.includes(value as CourseTypeName) ? (value as CourseTypeName) : null
}

export function getBangkokDayOfWeek(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  return date.getUTCDay()
}

export function normalizeScheduleTime(value: string, targetDate = '2000-01-01'): string | null {
  const trimmed = value.trim()
  const plainTime = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(trimmed)

  if (plainTime) {
    const hours = Number(plainTime[1])
    const minutes = Number(plainTime[2])
    const seconds = Number(plainTime[3] || 0)
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    return `${plainTime[1]}:${plainTime[2]}:${String(seconds).padStart(2, '0')}`
  }

  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) return null
  const parsed = new Date(trimmed.includes('T') ? trimmed : `${targetDate}T${trimmed}`)
  if (Number.isNaN(parsed.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  const hours = part('hour')
  const minutes = part('minute')
  const seconds = part('second')
  return hours && minutes && seconds ? `${hours}:${minutes}:${seconds}` : null
}

export interface TimeSlot {
  start: string
  end: string
  templateId?: string
}

export interface ScheduleTemplateOption {
  id: string
  branch_id: string
  branch_slug: string
  course_type_id: string
  course_type_name: CourseTypeName
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
}

function toShortTime(value: string) {
  return value.slice(0, 5)
}

function expandPrivateSlot(slot: TimeSlot) {
  const [startH, startM] = slot.start.split(':').map(Number)
  const [endH, endM] = slot.end.split(':').map(Number)
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM
  const duration = endMin - startMin

  if (duration <= 60) return [slot]

  const result: TimeSlot[] = []
  for (let minute = startMin; minute + 60 <= endMin; minute += 60) {
    const h1 = Math.floor(minute / 60)
    const m1 = minute % 60
    const h2 = Math.floor((minute + 60) / 60)
    const m2 = (minute + 60) % 60
    result.push({
      start: `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`,
      end: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`,
      templateId: slot.templateId,
    })
  }

  return result
}

export function getTemplateSlots(
  templates: ScheduleTemplateOption[],
  branchSlug: string,
  courseType: CourseTypeName,
  dayOfWeek: number
) {
  const matches = templates
    .filter((template) =>
      template.is_active &&
      template.branch_slug === branchSlug &&
      template.course_type_name === courseType &&
      template.day_of_week === dayOfWeek
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return matches.flatMap((template) => {
    const slot = { start: toShortTime(template.start_time), end: toShortTime(template.end_time), templateId: template.id }
    return courseType === 'private' ? expandPrivateSlot(slot) : [slot]
  })
}

export function hasTemplateSlots(
  templates: ScheduleTemplateOption[],
  branchSlug: string,
  courseType: CourseTypeName,
  date: Date
) {
  const dayOfWeek = date.getDay()
  return getTemplateSlots(templates, branchSlug, courseType, dayOfWeek).length > 0
}
