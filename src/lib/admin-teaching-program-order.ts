const PRIMARY_BRANCH_SLUG = 'chaengwattana'

const thaiCollator = new Intl.Collator('th', {
  numeric: true,
  sensitivity: 'base',
})

export interface AdminTeachingProgramOrderKey {
  id: string
  schedule_slot_id: string
  date: string
  start_time: string
  branch_name: string
  branch_slug: string | null
}

function compareText(left: string, right: string) {
  const localized = thaiCollator.compare(left, right)
  if (localized !== 0) return localized
  if (left === right) return 0
  return left < right ? -1 : 1
}

function timeToSeconds(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value.trim())
  if (!match) return Number.MAX_SAFE_INTEGER

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] || 0)

  if (hours > 23 || minutes > 59 || seconds > 59) return Number.MAX_SAFE_INTEGER
  return (hours * 60 * 60) + (minutes * 60) + seconds
}

export function compareAdminTeachingPrograms(
  left: AdminTeachingProgramOrderKey,
  right: AdminTeachingProgramOrderKey,
) {
  const dateOrder = compareText(left.date || '9999-12-31', right.date || '9999-12-31')
  if (dateOrder !== 0) return dateOrder

  const timeOrder = timeToSeconds(left.start_time) - timeToSeconds(right.start_time)
  if (timeOrder !== 0) return timeOrder

  const leftBranchPriority = left.branch_slug === PRIMARY_BRANCH_SLUG ? 0 : 1
  const rightBranchPriority = right.branch_slug === PRIMARY_BRANCH_SLUG ? 0 : 1
  const branchPriorityOrder = leftBranchPriority - rightBranchPriority
  if (branchPriorityOrder !== 0) return branchPriorityOrder

  const branchNameOrder = compareText(left.branch_name, right.branch_name)
  if (branchNameOrder !== 0) return branchNameOrder

  const branchSlugOrder = compareText(left.branch_slug || '', right.branch_slug || '')
  if (branchSlugOrder !== 0) return branchSlugOrder

  const slotOrder = compareText(left.schedule_slot_id, right.schedule_slot_id)
  if (slotOrder !== 0) return slotOrder

  return compareText(left.id, right.id)
}

export function sortAdminTeachingPrograms<T extends AdminTeachingProgramOrderKey>(items: readonly T[]) {
  return [...items].sort(compareAdminTeachingPrograms)
}
