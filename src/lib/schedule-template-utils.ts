import { getAvailableSlots as getFallbackSlots, hasAvailableSlots as hasFallbackSlots, type TimeSlot } from '@/lib/branch-schedules'
import type { CourseTypeName } from '@/types/database'

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

  if (matches.length === 0) {
    return getFallbackSlots(branchSlug, courseType, dayOfWeek)
  }

  return matches.flatMap((template) => {
    const slot = { start: toShortTime(template.start_time), end: toShortTime(template.end_time) }
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
  const hasDbTemplate = templates.some((template) =>
    template.is_active &&
    template.branch_slug === branchSlug &&
    template.course_type_name === courseType &&
    template.day_of_week === dayOfWeek
  )

  if (!hasDbTemplate) return hasFallbackSlots(branchSlug, courseType, date)
  return getTemplateSlots(templates, branchSlug, courseType, dayOfWeek).length > 0
}
