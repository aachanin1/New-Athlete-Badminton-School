import { callTask10, type Task10RpcClient } from '@/lib/task10-policy'

export interface BookingPaymentLifecycle {
  bookingId: string
  status: string
  inCohort: boolean
  deadline: string | null
  acceptedReceipt: boolean
  due: boolean
  cancelledAt: string | null
  cancellationReason: string | null
  originalExpiresAt: string | null
}

export async function loadBookingPaymentLifecycle(client: Task10RpcClient, bookingIds: string[]) {
  const ids = [...new Set(bookingIds)]
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100))
  const rows = (await Promise.all(chunks.map((chunk) => callTask10<BookingPaymentLifecycle[]>(client,
    'task10_payment_projection_v1', { p_booking_ids: chunk })))).flat()
  return new Map(rows.map((row) => [row.bookingId, row]))
}

export function isBookingPaymentActionable(lifecycle: BookingPaymentLifecycle) {
  return lifecycle.status === 'pending_payment' && !lifecycle.due
}

export function bookingPaymentLifecycleMessage(lifecycle?: BookingPaymentLifecycle) {
  if (lifecycle?.due) return 'หมดเวลารับสลิปแล้ว ระบบกำลังดำเนินการยกเลิกบิลนี้และรอบเรียนในบิล'
  if (lifecycle?.cancellationReason === 'no_accepted_receipt_before_deadline') return 'ยกเลิกอัตโนมัติ เนื่องจากไม่มีหลักฐานรับสลิปสำเร็จก่อนกำหนด'
  return null
}

export function acceptLegacySlip(client: Task10RpcClient, input: {
  userId: string; bookingIds: string[]; storagePath: string; publicUrl: string; sha256: string; expectedAmount: number; requestId: string
}) {
  return callTask10<{ success: true; payments: Array<{ bookingId: string; paymentId: string }> }>(client,
    'task10_accept_legacy_slip_v1', { p_user_id: input.userId, p_booking_ids: input.bookingIds,
      p_storage_path: input.storagePath, p_public_url: input.publicUrl, p_sha256: input.sha256,
      p_expected_amount: input.expectedAmount, p_request_id: input.requestId })
}

export function readLegacySlipRequest(client: Task10RpcClient, userId: string, requestId: string) {
  return callTask10<{ found: boolean; bookingIds?: string[]; storagePath?: string; sha256?: string; totalAmount?: number;
    finalized?: boolean; notes?: string | null }>(client, 'task10_legacy_receipt_request_v1', { p_user_id: userId, p_request_id: requestId })
}

export function finalizeLegacySlip(client: Task10RpcClient, input: { userId: string; requestId: string; approved: boolean; notes: string }) {
  return callTask10<{ success: true; bookingStatus: string }>(client, 'task10_finalize_legacy_slip_v1', {
    p_user_id: input.userId, p_request_id: input.requestId, p_approved: input.approved, p_notes: input.notes,
  })
}

export function writeLegacyBooking(client: Task10RpcClient, input: {
  userId: string; action: 'create' | 'update' | 'cancel'; requestId: string; booking: Record<string, unknown>
}) {
  return callTask10<{ success: true; bookingId: string; status: string; totalPrice?: number; idempotentReplay?: boolean }>(
    client, 'task10_write_legacy_booking_v1', { p_user_id: input.userId, p_action: input.action,
      p_request_id: input.requestId, p_input: input.booking })
}
