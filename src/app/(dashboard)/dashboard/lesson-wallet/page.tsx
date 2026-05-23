import { redirect } from 'next/navigation'

import { LessonWalletClient } from '@/components/dashboard/lesson-wallet-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import type { CourseTypeName } from '@/types/database'

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

export default async function LessonWalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const adminSupabase = getServiceRoleClient()
  const nowIso = new Date().toISOString()

  await adminSupabase
    .from('lesson_wallet_credits')
    .update({ status: 'expired', expired_at: nowIso })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lt('expires_at', nowIso)

  const [{ data: credits }, { data: branches }, { data: scheduleTemplates }, { data: existingSessions }] = await Promise.all([
    adminSupabase
      .from('lesson_wallet_credits')
      .select(`
        id, user_id, booking_id, original_session_id, redeemed_session_id, child_id, branch_id, course_type_id,
        original_schedule_slot_id, original_date, original_start_time, original_end_time,
        status, stored_at, expires_at, redeemed_at, expired_at, notes,
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
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">กระเป๋าวันเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">
          เก็บสิทธิ์วันเรียนที่ชำระแล้วไว้ใช้ใหม่ภายในเดือนเดียวกัน โดยต้องเก็บก่อนเวลาเรียนอย่างน้อย 48 ชั่วโมง
        </p>
      </div>

      <LessonWalletClient
        credits={credits || []}
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
        scheduleTemplates={(scheduleTemplates || []).map((template) => ({
          id: template.id,
          branch_id: template.branch_id,
          branch_slug: template.branches?.slug || '',
          course_type_id: template.course_type_id,
          course_type_name: template.course_types?.name || 'kids_group',
          day_of_week: template.day_of_week,
          start_time: template.start_time,
          end_time: template.end_time,
          is_active: template.is_active,
          notes: template.notes,
        }))}
      />
    </div>
  )
}
