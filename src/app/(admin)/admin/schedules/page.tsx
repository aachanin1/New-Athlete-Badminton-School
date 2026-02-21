import { createClient } from '@/lib/supabase/server'
import { SchedulesClient } from '@/components/admin/schedules-client'
import { ALL_BRANCH_SCHEDULES, DAY_LABELS_FULL } from '@/lib/branch-schedules'

export default async function SchedulesPage() {
  const supabase = createClient()
  const { data: branches } = await (supabase.from('branches').select('id, name, slug, is_active').order('name') as any)

  // Group schedules by branch
  const branchSchedules = (branches || []).map((b: any) => {
    const schedules = ALL_BRANCH_SCHEDULES.filter((s) => s.branchSlug === b.slug)
    const byType: Record<string, { dayOfWeek: number; dayLabel: string; slots: { start: string; end: string }[] }[]> = {}

    for (const s of schedules) {
      const typeKey = s.courseType
      if (!byType[typeKey]) byType[typeKey] = []
      byType[typeKey].push({
        dayOfWeek: s.dayOfWeek,
        dayLabel: DAY_LABELS_FULL[s.dayOfWeek] || `${s.dayOfWeek}`,
        slots: s.slots,
      })
    }

    // Sort by dayOfWeek
    for (const key in byType) {
      byType[key].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    }

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      is_active: b.is_active,
      schedules: byType,
    }
  })

  return <SchedulesClient branches={branchSchedules} />
}
