import { SchedulesClient } from '@/components/admin/schedules-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import { loadAdminScheduleMonthSummary, parseAdminScheduleMonth } from '@/lib/admin-schedules-read'

interface SchedulesPageProps {
  searchParams?: Promise<{
    year?: string
    month?: string
  }>
}

export default async function SchedulesPage({ searchParams }: SchedulesPageProps) {
  const { supabase } = await requireAdminPageAccess()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const { year, month } = parseAdminScheduleMonth(
    resolvedSearchParams.year || null,
    resolvedSearchParams.month || null,
  )
  const { summary, branches, metrics } = await loadAdminScheduleMonthSummary(supabase, year, month)

  return (
    <SchedulesClient
      key={`${year}-${month}`}
      summary={summary}
      initialPerformance={metrics}
      branches={branches}
      initialYear={year}
      initialMonth={month}
    />
  )
}
