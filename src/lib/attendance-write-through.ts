import { expectedBookingStatusFromAttendanceStatus } from '@/lib/session-attendance-status'
import type { AttendanceStatus, SessionStatus } from '@/types/database'

type WritableSessionStatus = Extract<SessionStatus, 'completed' | 'absent'>
type SyncError = { message: string }
type SyncedSessionRow = { id: string; status: SessionStatus }
type SupabaseMaybeSingleResult = {
  data: SyncedSessionRow | null
  error: SyncError | null
}

interface BookingSessionStatusSupabase {
  from(table: 'booking_sessions'): {
    update(values: { status: WritableSessionStatus }): {
      eq(column: 'id', value: string): {
        select(columns: 'id, status'): {
          maybeSingle(): PromiseLike<SupabaseMaybeSingleResult>
        }
      }
    }
  }
}

export interface AttendanceSessionSyncResult {
  bookingSessionId: string
  attendanceStatus: AttendanceStatus
  sessionStatus: WritableSessionStatus
}

export async function syncBookingSessionStatusFromAttendance({
  supabase,
  bookingSessionId,
  attendanceStatus,
}: {
  supabase: BookingSessionStatusSupabase
  bookingSessionId: string
  attendanceStatus: AttendanceStatus
}): Promise<AttendanceSessionSyncResult> {
  const sessionStatus = expectedBookingStatusFromAttendanceStatus(attendanceStatus) as WritableSessionStatus

  const { data, error } = await supabase
    .from('booking_sessions')
    .update({ status: sessionStatus })
    .eq('id', bookingSessionId)
    .select('id, status')
    .maybeSingle()

  if (error) {
    throw new Error(`Sync booking session status failed: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Sync booking session status failed: booking session ${bookingSessionId} was not found`)
  }

  if (data.status !== sessionStatus) {
    throw new Error(`Sync booking session status failed: expected ${sessionStatus}, got ${data.status}`)
  }

  return {
    bookingSessionId,
    attendanceStatus,
    sessionStatus,
  }
}
