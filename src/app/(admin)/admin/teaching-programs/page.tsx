import { redirect } from 'next/navigation'

import { TeachingProgramsClient } from '@/components/admin/teaching-programs-client'
import {
  getAdminTeachingProgramMonthRange,
  readAdminTeachingProgramsForRange,
  resolveAdminTeachingProgramDateRange,
} from '@/lib/admin-teaching-programs-read'
import { requireAdminMenuAccess } from '@/lib/auth/admin'
import { getBangkokDateString } from '@/lib/utils'
import type { ProgramStatus } from '@/types/database'

interface AdminTeachingProgramsPageProps {
  searchParams?: Promise<{
    from?: string
    to?: string
    status?: string
    coach?: string
    branch?: string
    course?: string
    q?: string
  }>
}

const PROGRAM_STATUSES = new Set<ProgramStatus | 'all'>(['all', 'draft', 'submitted', 'approved', 'rejected'])

function normalizedFilter(value: string | undefined, fallback: string) {
  const normalized = value?.trim() || ''
  return normalized.slice(0, 200) || fallback
}

export default async function AdminTeachingProgramsPage({ searchParams }: AdminTeachingProgramsPageProps) {
  const access = await requireAdminMenuAccess('teaching_programs')

  if (!access.ok) {
    redirect(access.status === 401 ? '/auth/login' : '/admin')
  }

  const { supabase } = access.ctx
  const params = await searchParams
  const bangkokToday = getBangkokDateString()
  const currentMonthRange = getAdminTeachingProgramMonthRange(bangkokToday)
  const dateRangeResult = resolveAdminTeachingProgramDateRange({
    from: params?.from,
    to: params?.to,
    bangkokToday,
  })
  const selectedRange = dateRangeResult.ok ? dateRangeResult.range : currentMonthRange
  const readResult = dateRangeResult.ok
    ? await readAdminTeachingProgramsForRange(supabase, selectedRange)
    : {
        ok: false,
        programs: [],
        totalCount: 0,
        isTruncated: false,
        error: dateRangeResult.error,
      }
  const requestedStatus = normalizedFilter(params?.status, 'submitted')
  const initialStatus = PROGRAM_STATUSES.has(requestedStatus as ProgramStatus | 'all') ? requestedStatus : 'submitted'

  return (
    <TeachingProgramsClient
      programs={readResult.programs}
      initialFilters={{
        status: initialStatus,
        coachId: normalizedFilter(params?.coach, 'all'),
        branch: normalizedFilter(params?.branch, 'all'),
        course: normalizedFilter(params?.course, 'all'),
        search: normalizedFilter(params?.q, ''),
        fromDate: selectedRange.from,
        toDate: selectedRange.to,
      }}
      currentMonthRange={currentMonthRange}
      totalCount={readResult.totalCount}
      isTruncated={readResult.isTruncated}
      readError={readResult.error}
    />
  )
}
