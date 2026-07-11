import { createHash } from 'node:crypto'
import { getServiceRoleClient } from '@/lib/auth/admin'

export const PROGRESSIVE_PAYMENT_BUCKET = 'progressive-payment-slips'
export const PROGRESSIVE_PAYMENT_MAX_FILE_BYTES = 5 * 1024 * 1024
export const PROGRESSIVE_PAYMENT_SIGNED_URL_TTL_SECONDS = 5 * 60

export type ProgressiveBatchStatus = 'prepared' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled'
export type ProgressiveAttemptDecision = 'approved' | 'rejected' | 'under_review'

export interface ProgressiveBatchStatusResult {
  ok: true
  batchId: string
  userId: string
  status: ProgressiveBatchStatus
  scopeId: string
  scopeRevision: number
  currency: string
  totalAmount: number
  bookingIds: string[]
  preparedExpiresAt: string
  submittedAt: string | null
  underReviewAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  cancelledAt: string | null
  rejectionReason: string | null
  slipStorageBucket: string | null
  slipStoragePath: string | null
  slipMimeType: string | null
  slipSizeBytes: number | null
  slipSha256: string | null
}

interface RpcErrorLike {
  message?: string
  details?: string
  hint?: string
}

interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcErrorLike | null }>
}

function rpcClient() {
  return getServiceRoleClient() as unknown as RpcClient
}

function rpcError(error: RpcErrorLike) {
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(' ') || 'Progressive payment RPC failed.')
}

async function executeRpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await rpcClient().rpc(name, args)
  if (error) throw rpcError(error)
  return data as T
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')
  const allowedOrigins = new Set([requestUrl.origin])
  if (forwardedHost) allowedOrigins.add(`${forwardedProto}://${forwardedHost}`)

  return allowedOrigins.has(origin)
}

export async function expireProgressiveBatchIfNeeded(batchId: string) {
  const status = await executeRpc<ProgressiveBatchStatusResult>('get_progressive_payment_batch_status_v1', { p_batch_id: batchId })
  if (!status || status.ok !== true) throw new Error('PROGRESSIVE_BATCH_NOT_FOUND')
  if (status.status === 'prepared' && new Date(status.preparedExpiresAt).getTime() <= Date.now()) {
    await executeRpc('expire_progressive_prepared_batch_v1', { p_batch_id: batchId })
    return executeRpc<ProgressiveBatchStatusResult>('get_progressive_payment_batch_status_v1', { p_batch_id: batchId })
  }
  return status
}

export function cancelProgressivePreparedBatch(batchId: string, userId: string, reason = 'user_cancelled') {
  return executeRpc('cancel_progressive_prepared_batch_v1', {
    p_batch_id: batchId,
    p_user_id: userId,
    p_reason: reason,
  })
}

export function recordProgressivePaymentUpload(input: {
  batchId: string
  userId: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  sha256: string
}) {
  return executeRpc('record_progressive_payment_upload_v1', {
    p_batch_id: input.batchId,
    p_user_id: input.userId,
    p_storage_bucket: PROGRESSIVE_PAYMENT_BUCKET,
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
    p_sha256: input.sha256,
  })
}

export function recordProgressiveVerificationAttempt(input: {
  batchId: string
  attemptKey: string
  providerMode: 'test' | 'live'
  requestFingerprint: string
}) {
  return executeRpc<{
    ok: true
    attemptId: string
    status: 'processing' | 'resolved'
    decision: ProgressiveAttemptDecision | null
    providerReference: string | null
    resultCode: string | null
    verifiedAmount: number | null
  }>('record_progressive_verification_attempt_v1', {
    p_batch_id: input.batchId,
    p_attempt_key: input.attemptKey,
    p_provider_mode: input.providerMode,
    p_request_fingerprint: input.requestFingerprint,
  })
}

export function resolveProgressiveVerificationAttempt(input: {
  attemptId: string
  decision: ProgressiveAttemptDecision
  providerReference: string | null
  resultCode: string
  verifiedAmount: number | null
}) {
  return executeRpc('resolve_progressive_verification_attempt_v1', {
    p_attempt_id: input.attemptId,
    p_decision: input.decision,
    p_provider_reference: input.providerReference,
    p_result_code: input.resultCode,
    p_verified_amount: input.verifiedAmount,
  })
}

export function markProgressiveBatchUnderReview(batchId: string, resultCode: string) {
  return executeRpc('mark_progressive_batch_under_review_v1', {
    p_batch_id: batchId,
    p_result_code: resultCode,
  })
}

export async function createProgressiveSlipSignedUrl(path: string | null) {
  if (!path) return null
  const { data, error } = await getServiceRoleClient().storage
    .from(PROGRESSIVE_PAYMENT_BUCKET)
    .createSignedUrl(path, PROGRESSIVE_PAYMENT_SIGNED_URL_TTL_SECONDS)
  if (error) throw new Error(`Unable to sign progressive payment slip: ${error.message}`)
  return data.signedUrl
}

export async function downloadProgressivePaymentSlip(path: string) {
  const { data, error } = await getServiceRoleClient().storage
    .from(PROGRESSIVE_PAYMENT_BUCKET)
    .download(path)
  if (error) throw new Error(`Unable to load progressive payment slip: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

export function inspectProgressiveSlip(buffer: Buffer) {
  if (buffer.length < 12 || buffer.length > PROGRESSIVE_PAYMENT_MAX_FILE_BYTES) return null

  let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null = null
  let extension: 'jpg' | 'png' | 'webp' | null = null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    mimeType = 'image/jpeg'
    extension = 'jpg'
  } else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    mimeType = 'image/png'
    extension = 'png'
  } else if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    mimeType = 'image/webp'
    extension = 'webp'
  }
  if (!mimeType || !extension) return null

  return {
    mimeType,
    extension,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    sizeBytes: buffer.length,
  }
}

export function createVerificationRequestFingerprint(status: ProgressiveBatchStatusResult) {
  return createHash('sha256').update([
    status.batchId,
    status.scopeRevision,
    status.totalAmount.toFixed(2),
    status.slipSha256 || '',
    status.bookingIds.join(','),
  ].join('|')).digest('hex')
}
