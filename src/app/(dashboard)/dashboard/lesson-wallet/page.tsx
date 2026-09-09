import { redirect } from 'next/navigation'

import { LessonWalletClient } from '@/components/dashboard/lesson-wallet-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { normalizeCourseTypeName } from '@/lib/schedule-template-utils'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName } from '@/types/database'
import { loadTask10Policy, nextLessonMonth } from '@/lib/task10-policy'

interface WalletCreditRow {
  id: string
  user_id: string
  booking_id: string
  original_session_id: string
  redeemed_session_id: string | null
  child_id: string | null
  branch_id: string
  course_type_id: string
  original_schedule_slot_id: string | null
  original_date: string
  original_start_time: string
  original_end_time: string
  status: 'active' | 'redeemed' | 'expired'
  stored_at: string
  expires_at: string
  redeemed_at: string | null
  expired_at: string | null
  notes: string | null
  entitlement_unit_type: 'single' | 'family_private' | null
  entitlement_policy: 'same_month' | 'ten_month_package' | null
  entitlement_started_at: string | null
  participant_count: number | null
  lesson_wallet_credit_members?: {
    child_id: string | null
    children?: { full_name: string; nickname: string | null } | null
  }[] | null
  children?: { full_name: string; nickname: string | null } | null
  branches?: { name: string; slug: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

interface BranchRow {
  id: string
  name: string
  slug: string
}

interface ScheduleTemplateRow {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
  branches?: { slug: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

interface ExistingSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  bookings?: {
    user_id: string
    course_type_id: string
    status: string | null
  } | null
}

interface ProfileRow {
  full_name: string | null
}

export default async function LessonWalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const adminSupabase = getServiceRoleClient()
  const nowIso = new Date().toISOString()
  const familyPolicy = await loadTask10Policy(adminSupabase)

  const [{ data: credits }, { data: branches }, { data: scheduleTemplates }, { data: existingSessions }, { data: profile }] = await Promise.all([
    adminSupabase
      .from('lesson_wallet_credits')
      .select(`
        id, user_id, booking_id, original_session_id, redeemed_session_id, child_id, branch_id, course_type_id,
        original_schedule_slot_id, original_date, original_start_time, original_end_time,
        status, stored_at, expires_at, redeemed_at, expired_at, notes,
        entitlement_unit_type, entitlement_policy, entitlement_started_at, participant_count,
        lesson_wallet_credit_members(child_id, children(full_name, nickname)),
        children(full_name, nickname),
        branches(name, slug),
        course_types(name)
      `)
      .eq('user_id', user.id)
      .order('original_date', { ascending: false }) as unknown as PromiseLike<{ data: WalletCreditRow[] | null }>,
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: BranchRow[] | null }>,
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(slug),
        course_types(name)
      `)
      .eq('is_active', true) as unknown as PromiseLike<{ data: ScheduleTemplateRow[] | null }>,
    adminSupabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, branch_id, child_id, status,
        bookings!inner(user_id, course_type_id, status)
      `)
      .eq('bookings.user_id', user.id)
      .neq('bookings.status', 'cancelled')
      .neq('status', 'rescheduled')
      .neq('status', 'walleted') as unknown as PromiseLike<{ data: ExistingSessionRow[] | null }>,
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single() as unknown as PromiseLike<{ data: ProfileRow | null }>,
  ])

  const kidsCreditIds = (credits || []).filter((credit) => credit.course_types?.name === 'kids_group').map((credit) => credit.id)
  const [familyUses, transitions] = familyPolicy.effectiveAt && kidsCreditIds.length
    ? await Promise.all([
      adminSupabase.from('task10_family_makeup_uses').select('credit_id').eq('parent_id', user.id).in('credit_id', kidsCreditIds),
      adminSupabase.from('task10_wallet_transition_evidence').select('credit_id').in('credit_id', kidsCreditIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (familyUses.error || transitions.error) throw new Error('ไม่สามารถตรวจสอบการใช้สิทธิ์ชดเชยร่วมครอบครัวได้')
  const familyUsedCreditIds = new Set((familyUses.data || []).map((row) => row.credit_id))
  const transitionCreditIds = new Set((transitions.data || []).map((row) => row.credit_id))

  const walletScheduleTemplates = (scheduleTemplates || []).flatMap((template) => {
    const courseTypeName = normalizeCourseTypeName(template.course_types?.name)
    const branchSlug = template.branches?.slug

    if (!courseTypeName || !branchSlug) return []

    return [{
      id: template.id,
      branch_id: template.branch_id,
      branch_slug: branchSlug,
      course_type_id: template.course_type_id,
      course_type_name: courseTypeName,
      day_of_week: template.day_of_week,
      start_time: template.start_time,
      end_time: template.end_time,
      is_active: template.is_active,
      notes: template.notes,
    }]
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">กระเป๋าวันเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เก็บสิทธิ์วันเรียนที่ชำระแล้วก่อนเวลาเรียนมากกว่า 48 ชั่วโมง แพ็กเกจ Adult Group/Family Private ที่เข้าเงื่อนไขใช้ได้ถึงวันหมดอายุ ส่วนสิทธิ์อื่นใช้ได้เฉพาะเดือนเดิม
        </p>
      </div>

      <LessonWalletClient
        credits={(credits || []).map((credit) => ({
          ...credit,
          familyMakeupUsed: familyUsedCreditIds.has(credit.id),
          familyMakeupMonth: familyPolicy.effectiveAt && credit.course_types?.name === 'kids_group'
            && !familyUsedCreditIds.has(credit.id) && credit.status !== 'redeemed' && !credit.redeemed_session_id
            && (transitionCreditIds.has(credit.id) || credit.stored_at >= familyPolicy.effectiveAt && credit.expires_at >= credit.stored_at)
            && nextLessonMonth(credit.original_date.slice(0, 7)) >= new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
            ? nextLessonMonth(credit.original_date.slice(0, 7)) : null,
          status: credit.status === 'active' && credit.expires_at < nowIso ? 'expired' as const : credit.status,
        }))}
        branches={branches || []}
        existingSessions={(existingSessions || []).map((session) => ({
          id: session.id,
          date: session.date,
          start_time: session.start_time,
          end_time: session.end_time,
          branch_id: session.branch_id,
          child_id: session.child_id,
          status: session.status,
          course_type_id: session.bookings?.course_type_id || '',
        }))}
        scheduleTemplates={walletScheduleTemplates}
        userName={profile?.full_name || ''}
      />
    </div>
  )
}
