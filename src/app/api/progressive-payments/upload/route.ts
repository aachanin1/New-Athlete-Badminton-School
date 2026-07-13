import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  expireProgressiveBatchIfNeeded,
  inspectProgressiveSlip,
  PROGRESSIVE_PAYMENT_BUCKET,
  PROGRESSIVE_PAYMENT_MAX_FILE_BYTES,
  recordProgressivePaymentUpload,
} from '@/lib/progressive-payment-integration'
import { progressivePaymentError, requireProgressivePaymentUser } from '@/lib/progressive-payment-route'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const access = await requireProgressivePaymentUser(request, { mutation: true })
  if (!access.ok) return access.response

  try {
    const form = await request.formData()
    const batchId = form.get('batchId')
    const file = form.get('file')
    if (typeof batchId !== 'string' || !(file instanceof File)) {
      return NextResponse.json({ error: 'batchId and file are required' }, { status: 400 })
    }
    if (file.size < 12 || file.size > PROGRESSIVE_PAYMENT_MAX_FILE_BYTES
      || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP ที่ถูกต้อง ขนาดไม่เกิน 5 MB' }, { status: 400 })
    }

    const batch = await expireProgressiveBatchIfNeeded(batchId)
    if (batch.userId !== access.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (batch.status !== 'prepared') return NextResponse.json({ error: 'Batch is not uploadable' }, { status: 409 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const inspected = inspectProgressiveSlip(buffer)
    if (!inspected || file.type !== inspected.mimeType) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP ที่ถูกต้อง ขนาดไม่เกิน 5 MB' }, { status: 400 })
    }

    const storagePath = `${access.user.id}/batches/${batchId}/${inspected.sha256}.${inspected.extension}`
    const service = getServiceRoleClient()
    const { error: uploadError } = await service.storage
      .from(PROGRESSIVE_PAYMENT_BUCKET)
      .upload(storagePath, buffer, { contentType: inspected.mimeType, upsert: true })
    if (uploadError) throw new Error(`Progressive slip upload failed: ${uploadError.message}`)

    await recordProgressivePaymentUpload({
      batchId,
      userId: access.user.id,
      storagePath,
      mimeType: inspected.mimeType,
      sizeBytes: inspected.sizeBytes,
      sha256: inspected.sha256,
    })

    return NextResponse.json({
      success: true,
      upload: { sha256: inspected.sha256, mimeType: inspected.mimeType, sizeBytes: inspected.sizeBytes },
    })
  } catch (error) {
    return progressivePaymentError(error)
  }
}
