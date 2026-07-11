import { NextRequest, NextResponse } from 'next/server'
import { cancelProgressivePreparedBatch, expireProgressiveBatchIfNeeded } from '@/lib/progressive-payment-integration'
import { progressivePaymentError, requireProgressivePaymentUser } from '@/lib/progressive-payment-route'

export async function POST(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const access = await requireProgressivePaymentUser(request, { mutation: true })
  if (!access.ok) return access.response

  try {
    const { batchId } = await context.params
    const batch = await expireProgressiveBatchIfNeeded(batchId)
    if (batch.userId !== access.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const result = await cancelProgressivePreparedBatch(batchId, access.user.id)
    return NextResponse.json({ batch: result })
  } catch (error) {
    return progressivePaymentError(error)
  }
}
