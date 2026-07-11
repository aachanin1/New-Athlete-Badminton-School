import { NextRequest, NextResponse } from 'next/server'
import { createProgressiveSlipSignedUrl, expireProgressiveBatchIfNeeded } from '@/lib/progressive-payment-integration'
import { progressivePaymentError, requireProgressivePaymentUser } from '@/lib/progressive-payment-route'

export async function GET(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const access = await requireProgressivePaymentUser(request)
  if (!access.ok) return access.response

  try {
    const { batchId } = await context.params
    const batch = await expireProgressiveBatchIfNeeded(batchId)
    if (batch.userId !== access.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      batch: {
        ...batch,
        slipStorageBucket: undefined,
        slipStoragePath: undefined,
        slipSha256: undefined,
        slipUrl: await createProgressiveSlipSignedUrl(batch.slipStoragePath),
      },
    })
  } catch (error) {
    return progressivePaymentError(error)
  }
}
