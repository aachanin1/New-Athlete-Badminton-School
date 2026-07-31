import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  expireProgressiveBatchIfNeeded,
  inspectProgressiveSlip,
  PROGRESSIVE_PAYMENT_BUCKET,
  PROGRESSIVE_PAYMENT_MAX_FILE_BYTES,
  recordProgressivePaymentUpload,
} from '@/lib/progressive-payment-integration'
import { requireProgressivePaymentUser } from '@/lib/progressive-payment-route'

export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_REQUEST_ID_PATTERN = /^[a-z0-9:._-]{1,128}$/i
const SAFE_MIME_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

const UPLOAD_ERROR_CONTRACT = {
  PROGRESSIVE_UPLOAD_INVALID_PAYLOAD: {
    status: 400,
    error: 'ข้อมูลอัปโหลดสลิปไม่ครบ กรุณาเลือกรูปสลิปแล้วลองใหม่',
  },
  PROGRESSIVE_UPLOAD_FILE_TOO_LARGE: {
    status: 413,
    error: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB',
  },
  PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE: {
    status: 400,
    error: 'เนื้อไฟล์ไม่ใช่ JPEG, PNG หรือ WebP ที่ระบบรองรับ',
  },
  PROGRESSIVE_UPLOAD_ACCESS_DENIED: {
    status: 403,
    error: 'ไม่สามารถอัปโหลดสลิปให้รายการชำระเงินนี้ได้',
  },
  PROGRESSIVE_UPLOAD_BATCH_NOT_READY: {
    status: 409,
    error: 'รายการชำระเงินนี้ไม่พร้อมรับสลิป กรุณาอัปเดตรายการแล้วลองใหม่',
  },
  PROGRESSIVE_UPLOAD_STORAGE_FAILED: {
    status: 500,
    error: 'จัดเก็บไฟล์สลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  },
  PROGRESSIVE_UPLOAD_INTERNAL_ERROR: {
    status: 500,
    error: 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  },
} as const

type UploadErrorCode = keyof typeof UPLOAD_ERROR_CONTRACT

interface UploadLogContext {
  sizeBytes: number | null
  declaredMimeType: string | null
  detectedMimeType: string | null
}

function requestIdentifier(request: NextRequest) {
  const vercelId = request.headers.get('x-vercel-id')?.trim() || ''
  return SAFE_REQUEST_ID_PATTERN.test(vercelId) ? vercelId : randomUUID()
}

function safeDeclaredMimeType(file: File | null) {
  if (!file) return null
  const value = file.type.trim().toLowerCase()
  if (!value) return 'empty'
  return SAFE_MIME_PATTERN.test(value) ? value.slice(0, 100) : 'invalid'
}

function hasErrorCode(error: unknown, codes: string[]) {
  const message = error instanceof Error ? error.message : ''
  return codes.some((code) => message.includes(code))
}

function uploadError(
  code: UploadErrorCode,
  requestId: string,
  context: UploadLogContext,
) {
  const contract = UPLOAD_ERROR_CONTRACT[code]
  console.warn('[progressive-payment-upload]', {
    requestId,
    code,
    status: contract.status,
    sizeBytes: context.sizeBytes,
    declaredMimeType: context.declaredMimeType,
    detectedMimeType: context.detectedMimeType,
  })
  return NextResponse.json({ code, error: contract.error, requestId }, { status: contract.status })
}

export async function POST(request: NextRequest) {
  const access = await requireProgressivePaymentUser(request, { mutation: true })
  if (!access.ok) return access.response

  const requestId = requestIdentifier(request)
  let file: File | null = null
  const logContext: UploadLogContext = {
    sizeBytes: null,
    declaredMimeType: null,
    detectedMimeType: null,
  }
  let phase: 'request' | 'batch' | 'storage' | 'record' = 'request'

  try {
    const form = await request.formData()
    const batchId = form.get('batchId')
    const formFile = form.get('file')
    file = formFile instanceof File ? formFile : null
    logContext.sizeBytes = file?.size ?? null
    logContext.declaredMimeType = safeDeclaredMimeType(file)

    if (typeof batchId !== 'string' || !UUID_PATTERN.test(batchId) || !file) {
      return uploadError('PROGRESSIVE_UPLOAD_INVALID_PAYLOAD', requestId, logContext)
    }
    if (file.size > PROGRESSIVE_PAYMENT_MAX_FILE_BYTES) {
      return uploadError('PROGRESSIVE_UPLOAD_FILE_TOO_LARGE', requestId, logContext)
    }
    if (file.size < 12) {
      return uploadError('PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE', requestId, logContext)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const inspected = inspectProgressiveSlip(buffer)
    logContext.detectedMimeType = inspected?.mimeType ?? null
    if (!inspected) {
      return uploadError('PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE', requestId, logContext)
    }

    phase = 'batch'
    const batch = await expireProgressiveBatchIfNeeded(batchId)
    if (batch.userId !== access.user.id) {
      return uploadError('PROGRESSIVE_UPLOAD_ACCESS_DENIED', requestId, logContext)
    }
    if (batch.status !== 'prepared') {
      return uploadError('PROGRESSIVE_UPLOAD_BATCH_NOT_READY', requestId, logContext)
    }

    const storagePath = `${access.user.id}/batches/${batchId}/${inspected.sha256}.${inspected.extension}`
    const service = getServiceRoleClient()
    phase = 'storage'
    const { error: storageError } = await service.storage
      .from(PROGRESSIVE_PAYMENT_BUCKET)
      .upload(storagePath, buffer, { contentType: inspected.mimeType, upsert: true })
    if (storageError) {
      return uploadError('PROGRESSIVE_UPLOAD_STORAGE_FAILED', requestId, logContext)
    }

    phase = 'record'
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
    if (hasErrorCode(error, ['PROGRESSIVE_BATCH_NOT_FOUND', 'PROGRESSIVE_BATCH_NOT_SUBMITTABLE', 'PROGRESSIVE_BATCH_EXPIRED', 'PROGRESSIVE_PAYMENT_EXISTS'])) {
      return uploadError('PROGRESSIVE_UPLOAD_BATCH_NOT_READY', requestId, logContext)
    }
    if (hasErrorCode(error, ['PROGRESSIVE_UNAUTHORIZED'])) {
      return uploadError('PROGRESSIVE_UPLOAD_ACCESS_DENIED', requestId, logContext)
    }
    if (phase === 'request') {
      return uploadError('PROGRESSIVE_UPLOAD_INVALID_PAYLOAD', requestId, logContext)
    }
    return uploadError(
      phase === 'storage' ? 'PROGRESSIVE_UPLOAD_STORAGE_FAILED' : 'PROGRESSIVE_UPLOAD_INTERNAL_ERROR',
      requestId,
      logContext,
    )
  }
}
