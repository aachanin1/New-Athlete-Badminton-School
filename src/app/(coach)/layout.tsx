import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CoachSidebar } from '@/components/layout/coach-sidebar'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  createCoachAttendanceGapNotifications,
  createCoachCheckinWindowNotifications,
} from '@/lib/coach-notifications'
import type { UserRole } from '@/types/database'

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const assignmentDiagnosticSample = requestHeaders.get('x-assignment-diagnostic-sample')
  const layoutStartedAt = new Date().toISOString()
  const layoutStartedMs = performance.now()
  const logDiagnosticPhase = (
    phase: string,
    startedAt: string,
    startedMs: number,
    success: boolean,
    metrics: Record<string, number> = {},
  ) => {
    if (!assignmentDiagnosticSample) return
    console.info('[assignment-diagnostic]', {
      sampleId: assignmentDiagnosticSample,
      phase,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Number((performance.now() - startedMs).toFixed(1)),
      success,
      ...metrics,
    })
  }
  const supabase = await createClient()
  const authStartedAt = new Date().toISOString()
  const authStartedMs = performance.now()
  const { data: { user } } = await supabase.auth.getUser()
  logDiagnosticPhase('coach_layout_authentication', authStartedAt, authStartedMs, Boolean(user), { callCount: 1 })

  if (!user) {
    redirect('/auth/login')
  }

  const profileStartedAt = new Date().toISOString()
  const profileStartedMs = performance.now()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single() as { data: { full_name: string; role: UserRole; avatar_url: string | null } | null }
  logDiagnosticPhase('coach_layout_profile', profileStartedAt, profileStartedMs, Boolean(profile), {
    callCount: 1,
    rowCount: profile ? 1 : 0,
  })

  const isHeadCoach = profile?.role === 'head_coach' || profile?.role === 'super_admin'
  if (profile?.role === 'coach' || profile?.role === 'head_coach') {
    try {
      const adminSupabase = getServiceRoleClient()
      const checkinNotificationStartedAt = new Date().toISOString()
      const checkinNotificationStartedMs = performance.now()
      await createCoachCheckinWindowNotifications(adminSupabase, user.id)
      logDiagnosticPhase('coach_layout_checkin_notifications', checkinNotificationStartedAt, checkinNotificationStartedMs, true, { callCount: 1 })
      const attendanceNotificationStartedAt = new Date().toISOString()
      const attendanceNotificationStartedMs = performance.now()
      await createCoachAttendanceGapNotifications(adminSupabase, user.id)
      logDiagnosticPhase('coach_layout_attendance_notifications', attendanceNotificationStartedAt, attendanceNotificationStartedMs, true, { callCount: 1 })
    } catch (error) {
      logDiagnosticPhase('coach_layout_notification_generators', layoutStartedAt, layoutStartedMs, false, { callCount: 2 })
      console.error('Coach attendance gap notification error:', error)
    }
  }

  const unreadStartedAt = new Date().toISOString()
  const unreadStartedMs = performance.now()
  const { count: unreadNotificationCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
  logDiagnosticPhase('coach_layout_unread_notifications', unreadStartedAt, unreadStartedMs, unreadNotificationCount !== null, {
    callCount: 1,
    rowCount: unreadNotificationCount || 0,
  })
  logDiagnosticPhase('coach_layout_complete', layoutStartedAt, layoutStartedMs, true)

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachSidebar
        userName={profile?.full_name}
        userAvatarUrl={profile?.avatar_url}
        isHeadCoach={isHeadCoach}
        notificationUnreadCount={unreadNotificationCount || 0}
      />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
