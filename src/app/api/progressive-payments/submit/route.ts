import { NextRequest, NextResponse } from 'next/server'
import {
  approveProgressivePaymentBatch,
  submitProgressivePaymentBatch,
} from '@/lib/progressive-payment-batch'
import {
  createVerificationRequestFingerprint,
  downloadProgressivePaymentSlip,
  expireProgressiveBatchIfNeeded,
  markProgressiveBatchUnderReview,
  recordProgressiveVerificationAttempt,
  resolveProgressiveVerificationAttempt,
} from '@/lib/progressive-payment-integration'
import { progressivePaymentError, requireProgressivePaymentUser } from '@/lib/progressive-payment-route'
import {
  getProgressiveSlipProviderMode,
  resolveProgressiveSlipVerification,
} from '@/lib/progressive-slipok'

export async function POST(request: NextRequest) {
  const access = await requireProgressivePaymentUser(request, { mutation: true, requireEntry: true })
  if (!access.ok) return access.response

  try {
    const body = await request.json() as { batchId?: string; submitKey?: string; attemptKey?: string }
    if (!body.batchId || !body.submitKey || !body.attemptKey) {
      return NextResponse.json({ error: 'batchId, submitKey and attemptKey are required' }, { status: 400 })
    }

    let batch = await expireProgressiveBatchIfNeeded(body.batchId)
    if (batch.userId !== access.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!batch.slipStorageBucket || !batch.slipStoragePath || !batch.slipMimeType
      || !batch.slipSizeBytes || !batch.slipSha256) {
      return NextResponse.json({ error: 'กรุณาอัปโหลดสลิปก่อนยืนยัน' }, { status: 409 })
    }

    if (batch.status === 'prepared') {
      await submitProgressivePaymentBatch({
        userId: access.user.id,
        batchId: batch.batchId,
        idempotencyKey: body.submitKey,
        slipMetadata: {
          storageBucket: batch.slipStorageBucket,
          storagePath: batch.slipStoragePath,
          mimeType: batch.slipMimeType,
          sizeBytes: batch.slipSizeBytes,
          sha256: batch.slipSha256,
        },
      })
      batch = await expireProgressiveBatchIfNeeded(batch.batchId)
    }

    if (['approved', 'rejected', 'cancelled'].includes(batch.status)) {
      return NextResponse.json({ batch })
    }

    const providerMode = getProgressiveSlipProviderMode()
    const attempt = await recordProgressiveVerificationAttempt({
      batchId: batch.batchId,
      attemptKey: body.attemptKey,
      providerMode,
      requestFingerprint: createVerificationRequestFingerprint(batch),
    })

    const resolution = attempt.status === 'resolved' && attempt.decision
      ? {
          decision: attempt.decision,
          providerReference: attempt.providerReference,
          resultCode: attempt.resultCode || 'RESOLVED',
          verifiedAmount: attempt.verifiedAmount,
        }
      : await resolveProgressiveSlipVerification({
          attemptId: attempt.attemptId,
          totalAmount: batch.totalAmount,
          providerMode,
          loadSlip: async () => ({
            buffer: await downloadProgressivePaymentSlip(batch.slipStoragePath!),
            fileName: batch.slipStoragePath!.split('/').pop() || `${batch.batchId}.jpg`,
          }),
        })

    if (attempt.status !== 'resolved') {
      await resolveProgressiveVerificationAttempt({ attemptId: attempt.attemptId, ...resolution })
    }

    if (resolution.decision === 'approved') {
      if (resolution.verifiedAmount !== batch.totalAmount) {
        await markProgressiveBatchUnderReview(batch.batchId, 'AMOUNT_MISMATCH')
      } else {
        await approveProgressivePaymentBatch({
          batchId: batch.batchId,
          actorId: access.user.id,
          idempotencyKey: attempt.attemptId,
          hasCouponReservation: true,
        })
      }
    } else {
      await markProgressiveBatchUnderReview(batch.batchId, resolution.resultCode)
    }

    batch = await expireProgressiveBatchIfNeeded(batch.batchId)
    return NextResponse.json({ batch })
  } catch (error) {
    return progressivePaymentError(error)
  }
}
