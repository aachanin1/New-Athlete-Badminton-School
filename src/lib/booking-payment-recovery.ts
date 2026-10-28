import {storedSlipCheck,slipResultMessage} from './booking-slip-result'
/** Payment presentation must use the latest decision, not just a historic receipt. */
export interface RecoveryBill {
  id: string
  status: string
  pricing_scope_id?: string | null
  lifecycle?: { due: boolean; deadline: string | null; acceptedReceipt: boolean }
}
export interface RecoveryPayment {
  id?: string
  booking_id: string
  status: string
  notes: string | null
  created_at?: string
  receipts?:Array<{request_id:string}>
}
export interface RecoveryBatch {
  id?: string
  batchId?: string
  pricing_scope_id?: string
  status: string
  created_at?: string
  rejection_reason?: string | null
  upload_recorded_at?: string | null
  slipok_response_code?:string|null
  progressive_payment_batch_bookings?: Array<{ booking_id: string }>
}

export function bookingPaymentRecovery(bill: RecoveryBill, payments: RecoveryPayment[], batches: RecoveryBatch[], now: number) {
  const elapsed = Boolean(bill.lifecycle?.deadline && Date.parse(bill.lifecycle.deadline) <= now)
  const latestPayment = payments.find(p => p.booking_id === bill.id)
  const memberBatches = batches.filter(b => b.progressive_payment_batch_bookings?.some(m => m.booking_id === bill.id))
  const activeBatch = memberBatches.find(b => ['prepared', 'submitted', 'under_review'].includes(b.status))
  const rejectedBatch = memberBatches.find(b => b.status === 'rejected')
  const rejected = bill.status === 'pending_payment' && (latestPayment?.status === 'rejected' || Boolean(rejectedBatch))
  const marker = '[Admin payment review: send_back] '
  const note = latestPayment?.status === 'rejected' ? latestPayment.notes : rejectedBatch?.rejection_reason
  const check=storedSlipCheck(latestPayment?.notes)
  const reason = check?.message || (note?.includes(marker) ? note.slice(note.lastIndexOf(marker) + marker.length) : note || '')
  const kind = bill.status === 'verified' ? 'verified'
    : bill.status === 'cancelled' || bill.lifecycle?.due ? 'closed'
    : bill.status === 'paid' ? 'received'
    : activeBatch?.status === 'prepared' && activeBatch.upload_recorded_at ? 'uploaded'
    : activeBatch && ['submitted', 'under_review'].includes(activeBatch.status) ? 'received'
    : latestPayment && ['pending', 'approved'].includes(latestPayment.status) ? 'received'
    : rejected ? 'returned'
    : bill.lifecycle?.acceptedReceipt ? 'received' : 'payable'
  return { kind, elapsed, reason,
    canSendNew: (!elapsed||Boolean(bill.lifecycle?.acceptedReceipt)) && (kind === 'payable' || kind === 'returned'),
    canRecheck:kind==='received'&&Boolean(activeBatch||latestPayment?.receipts?.length),
    receiptRequestId:check?.receiptRequestId||latestPayment?.receipts?.[0]?.request_id||null,
    checkMessage:kind==='received'?check?.message||slipResultMessage(activeBatch?.slipok_response_code||'UNAVAILABLE'):'',
    retryKey: kind === 'returned' ? latestPayment?.id || rejectedBatch?.id || 'returned' : '',
  }
}
