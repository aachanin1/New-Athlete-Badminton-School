'use client'

import { Button } from '@/components/ui/button'
import { useReviewRoundRequests } from '@/components/admin/use-review-round-requests'

const confirmed = async () => true
const blockWrites = () => true

export function ReviewRequestRecoveryPanel({ actor }: { actor: string }) {
  const { requests, reconcile } = useReviewRoundRequests({ actor, onConfirmed: confirmed, isExternallyBlocked: blockWrites })
  return (
    <section role="status" data-testid="review-request-recovery" className="mb-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">พักการส่งคำขอโค้ชชั่วคราว สามารถตรวจผลคำขอเดิมได้</p>
      {requests.length === 0 && <p>ไม่มีคำขอค้างในเบราว์เซอร์นี้</p>}
      {requests.map(request => (
        <div key={request.requestId} data-testid="review-recovery-result" className="space-y-2 border-t border-amber-300 pt-2">
          <p>{request.message}</p>
          <p className="break-all text-xs">รหัสคำขอ {request.requestId}</p>
          {request.phase !== 'done' && (
            <Button type="button" variant="outline" disabled={request.phase === 'pending'} onClick={() => reconcile(request.requestId)}>
              ตรวจผลคำขอเดิม
            </Button>
          )}
        </div>
      ))}
    </section>
  )
}
