import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  isProgressiveCouponLifecycleEnabled,
  isProgressivePaymentBatchEnabled,
  isProgressivePricingWritesEnabled,
} from '@/lib/progressive-pricing-feature'

export type ProgressivePaymentBatchErrorCode =
  | 'PROGRESSIVE_BATCH_ALREADY_TERMINAL'
  | 'PROGRESSIVE_BATCH_AMOUNT_MISMATCH'
  | 'PROGRESSIVE_BATCH_EXPIRED'
  | 'PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT'
  | 'PROGRESSIVE_BATCH_NOT_FOUND'
  | 'PROGRESSIVE_BATCH_NOT_REVIEWABLE'
  | 'PROGRESSIVE_BATCH_NOT_SUBMITTABLE'
  | 'PROGRESSIVE_BOOKING_EXPIRED'
  | 'PROGRESSIVE_BOOKING_NOT_PENDING'
  | 'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED'
  | 'PROGRESSIVE_COUPON_STATE_CONFLICT'
  | 'PROGRESSIVE_CURRENCY_MISMATCH'
  | 'PROGRESSIVE_IDEMPOTENCY_CONFLICT'
  | 'PROGRESSIVE_INVALID_REQUEST'
  | 'PROGRESSIVE_PAYMENT_BATCH_DISABLED'
  | 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED'
  | 'PROGRESSIVE_PAYMENT_EXISTS'
  | 'PROGRESSIVE_RPC_UNAVAILABLE'
  | 'PROGRESSIVE_SCOPE_LOCKED'
  | 'PROGRESSIVE_SCOPE_REVISION_CONFLICT'
  | 'PROGRESSIVE_UNAUTHORIZED'
  | 'PROGRESSIVE_USER_MISMATCH'
  | 'PROGRESSIVE_WRITES_DISABLED'

const KNOWN_ERROR_CODES = new Set<ProgressivePaymentBatchErrorCode>([
  'PROGRESSIVE_BATCH_ALREADY_TERMINAL',
  'PROGRESSIVE_BATCH_AMOUNT_MISMATCH',
  'PROGRESSIVE_BATCH_EXPIRED',
  'PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT',
  'PROGRESSIVE_BATCH_NOT_FOUND',
  'PROGRESSIVE_BATCH_NOT_REVIEWABLE',
  'PROGRESSIVE_BATCH_NOT_SUBMITTABLE',
  'PROGRESSIVE_BOOKING_EXPIRED',
  'PROGRESSIVE_BOOKING_NOT_PENDING',
  'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED',
  'PROGRESSIVE_COUPON_STATE_CONFLICT',
  'PROGRESSIVE_CURRENCY_MISMATCH',
  'PROGRESSIVE_IDEMPOTENCY_CONFLICT',
  'PROGRESSIVE_INVALID_REQUEST',
  'PROGRESSIVE_PAYMENT_BATCH_DISABLED',
  'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED',
  'PROGRESSIVE_PAYMENT_EXISTS',
  'PROGRESSIVE_RPC_UNAVAILABLE',
  'PROGRESSIVE_SCOPE_LOCKED',
  'PROGRESSIVE_SCOPE_REVISION_CONFLICT',
  'PROGRESSIVE_UNAUTHORIZED',
  'PROGRESSIVE_USER_MISMATCH',
  'PROGRESSIVE_WRITES_DISABLED',
])

interface RpcErrorLike {
  message?: string
  details?: string
  hint?: string
  code?: string
}

interface ProgressiveRpcClient {
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcErrorLike | null }>
}

export interface ProgressivePaymentBatchResult {
  ok: true
  batchId: string
  status: 'prepared' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled'
  scopeId: string
  scopeRevision: number
  totalAmount: number
  bookingIds: string[]
  idempotentReplay: boolean
}

export class ProgressivePaymentBatchError extends Error {
  constructor(
    public readonly code: ProgressivePaymentBatchErrorCode,
    message: string,
    public readonly causeDetails?: RpcErrorLike,
  ) {
    super(message)
    this.name = 'ProgressivePaymentBatchError'
  }
}

function mapRpcError(error: RpcErrorLike) {
  const source = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  const matched = Array.from(KNOWN_ERROR_CODES).find((code) => source.includes(code))
  return new ProgressivePaymentBatchError(
    matched || 'PROGRESSIVE_RPC_UNAVAILABLE',
    source || matched || 'Progressive payment batch RPC is unavailable.',
    error,
  )
}

function parseResult(data: unknown): ProgressivePaymentBatchResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_RPC_UNAVAILABLE', 'Progressive payment batch RPC returned an invalid result.')
  }
  const result = data as Partial<ProgressivePaymentBatchResult>
  if (
    result.ok !== true
    || !result.batchId
    || !result.scopeId
    || !Number.isInteger(result.scopeRevision)
    || typeof result.totalAmount !== 'number'
    || !Array.isArray(result.bookingIds)
    || !result.status
  ) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_RPC_UNAVAILABLE', 'Progressive payment batch result is missing authoritative fields.')
  }
  return result as ProgressivePaymentBatchResult
}

function getRpcClient() {
  return getServiceRoleClient() as unknown as ProgressiveRpcClient
}

async function execute(functionName: string, args: Record<string, unknown>, requireCouponLifecycle = false) {
  if (!isProgressivePricingWritesEnabled()) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_WRITES_DISABLED', 'Progressive pricing writes are disabled.')
  }
  if (!isProgressivePaymentBatchEnabled()) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_PAYMENT_BATCH_DISABLED', 'Progressive payment batches are disabled.')
  }
  if (requireCouponLifecycle && !isProgressiveCouponLifecycleEnabled()) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_COUPON_LIFECYCLE_DISABLED', 'Progressive coupon lifecycle is disabled.')
  }

  const client = getRpcClient()
  const { data: capabilityData, error: capabilityError } = await client.rpc('progressive_payment_batch_capability_v1')
  if (capabilityError) throw mapRpcError(capabilityError)
  const capability = capabilityData as { ready?: unknown; version?: unknown } | null
  if (capability?.ready !== true || capability.version !== 1) {
    throw new ProgressivePaymentBatchError('PROGRESSIVE_RPC_UNAVAILABLE', 'Progressive payment batch database capability is not ready.')
  }

  const { data, error } = await client.rpc(functionName, args)
  if (error) throw mapRpcError(error)
  return parseResult(data)
}

export function prepareProgressivePaymentBatch(input: {
  userId: string
  pricingScopeId: string
  bookingIds: string[]
  expectedScopeRevision: number
  expectedTotal?: number | null
  idempotencyKey: string
  hasCouponReservation?: boolean
}) {
  return execute('prepare_progressive_payment_batch_v1', {
    p_user_id: input.userId,
    p_pricing_scope_id: input.pricingScopeId,
    p_booking_ids: input.bookingIds,
    p_expected_scope_revision: input.expectedScopeRevision,
    p_expected_total: input.expectedTotal ?? null,
    p_idempotency_key: input.idempotencyKey,
  }, Boolean(input.hasCouponReservation))
}

export function submitProgressivePaymentBatch(input: {
  userId: string
  batchId: string
  slipMetadata: Record<string, unknown>
  idempotencyKey: string
}) {
  return execute('submit_progressive_payment_batch_v1', {
    p_batch_id: input.batchId,
    p_user_id: input.userId,
    p_slip_metadata: input.slipMetadata,
    p_idempotency_key: input.idempotencyKey,
  })
}

export function approveProgressivePaymentBatch(input: {
  batchId: string
  actorId: string
  idempotencyKey: string
  hasCouponReservation?: boolean
}) {
  return execute('approve_progressive_payment_batch_v1', {
    p_batch_id: input.batchId,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
  }, Boolean(input.hasCouponReservation))
}

export function rejectProgressivePaymentBatch(input: {
  batchId: string
  actorId: string
  rejectionReason: string
  idempotencyKey: string
  hasCouponReservation?: boolean
}) {
  return execute('reject_progressive_payment_batch_v1', {
    p_batch_id: input.batchId,
    p_actor_id: input.actorId,
    p_rejection_reason: input.rejectionReason,
    p_idempotency_key: input.idempotencyKey,
  }, Boolean(input.hasCouponReservation))
}
