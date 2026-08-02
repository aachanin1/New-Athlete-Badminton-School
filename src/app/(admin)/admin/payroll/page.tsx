import { PayrollClient } from '@/components/admin/payroll-client'
import { loadAdminPayrollMonthSummary, parseAdminPayrollMonth } from '@/lib/admin-payroll-read'
import { getServiceRoleClient, requireAdminPageAccess } from '@/lib/auth/admin'

interface PayrollPageProps {
  searchParams?: Promise<{
    year?: string
    month?: string
  }>
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  await requireAdminPageAccess()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const { year, month } = parseAdminPayrollMonth(
    resolvedSearchParams.year || null,
    resolvedSearchParams.month || null,
  )
  const read = await loadAdminPayrollMonthSummary(getServiceRoleClient(), year, month)

  return (
    <PayrollClient
      key={`${year}-${month}`}
      coaches={read.coaches}
      totals={read.totals}
      currentMonth={month}
      currentYear={year}
      teachingRules={read.teachingRules}
      initialPerformance={read.metrics}
    />
  )
}
