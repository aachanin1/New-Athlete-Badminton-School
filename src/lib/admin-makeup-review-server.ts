import 'server-only'
import { getServiceRoleClient } from '@/lib/auth/admin'
import type { BookingSessionData, CoachOption, ReviewFilter } from '@/lib/admin-makeup-read-model'

export interface AdminReviewPage {
  sessions: BookingSessionData[]
  coaches: CoachOption[]
  groups: Array<{ key: string; count: number }>
  total: number
  sessionTotal: number
  stats: { review: number; reviewNoCoach: number; reviewCoachEvidence: number }
  detailFound: boolean
  scopeSessionIds: string[] | null
  page: number
  pageSize: number
  complete: true
}

export async function readAdminMakeupReviewPage(input: {
  actor: string; month: string; filter: ReviewFilter; page: number; pageSize: number; detail?: string; scope?: string
}) {
  const { data, error } = await getServiceRoleClient().rpc('admin_makeup_review_page_v1', {
    p_actor: input.actor, p_month: input.month + '-01', p_search: input.filter.search,
    p_branch: input.filter.branch === 'all' ? null : input.filter.branch, p_course: input.filter.course,
    p_status: input.filter.status, p_page: input.page, p_size: input.pageSize,
    p_target: input.filter.session || null, p_date: input.filter.date || null,
    p_detail: input.detail || null, p_scope: input.scope || null,
  })
  if (error || !data || data.complete !== true || !Array.isArray(data.sessions)) throw new Error(error?.message || 'ADMIN_REVIEW_READ_UNAVAILABLE')
  return data as AdminReviewPage
}
