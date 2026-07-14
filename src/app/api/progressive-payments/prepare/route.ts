import { NextRequest, NextResponse } from 'next/server'
import { prepareProgressivePaymentBatch } from '@/lib/progressive-payment-batch'
import { expireProgressiveBatchIfNeeded } from '@/lib/progressive-payment-integration'
import { progressivePaymentError, requireProgressivePaymentUser } from '@/lib/progressive-payment-route'

export async function POST(request: NextRequest) {
  const access = await requireProgressivePaymentUser(request, { mutation: true })
  if (!access.ok) return access.response

  try {
    const body = await request.json() as {
      pricingScopeId?: string
      bookingIds?: string[]
      expectedScopeRevision?: number
      idempotencyKey?: string
    }
    if (!body.pricingScopeId || !body.idempotencyKey || !Array.isArray(body.bookingIds)
      || body.bookingIds.length === 0 || body.bookingIds.length > 100 || !Number.isInteger(body.expectedScopeRevision)) {
      return NextResponse.json({
        code: 'PROGRESSIVE_INVALID_REQUEST',
        error: 'Invalid progressive payment prepare request',
        refreshRequired: false,
      }, { status: 400 })
    }

    const result = await prepareProgressivePaymentBatch({
      userId: access.user.id,
      pricingScopeId: body.pricingScopeId,
      bookingIds: body.bookingIds,
      expectedScopeRevision: body.expectedScopeRevision!,
      idempotencyKey: body.idempotencyKey,
      hasCouponReservation: true,
    })
    const status = await expireProgressiveBatchIfNeeded(result.batchId)

    return NextResponse.json({ batch: status })
  } catch (error) {
    return progressivePaymentError(error)
  }
}
