import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  isProgressiveCouponLifecycleEnabled,
  isProgressivePricingWritesEnabled,
} from '@/lib/progressive-pricing-feature'
import type { LearnerType } from '@/types/database'

export type ProgressiveBookingWriteErrorCode =
  | 'PROGRESSIVE_BOOKING_CONFLICT'
  | 'PROGRESSIVE_BOOKING_EXPIRED'
  | 'PROGRESSIVE_BOOKING_NOT_PENDING'
  | 'PROGRESSIVE_CAPACITY_EXCEEDED'
  | 'PROGRESSIVE_COUPON_ALREADY_USED'
  | 'PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED'
  | 'PROGRESSIVE_COUPON_EXPIRED'
  | 'PROGRESSIVE_COUPON_INACTIVE'
  | 'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED'
  | 'PROGRESSIVE_COUPON_MAX_USES'
  | 'PROGRESSIVE_COUPON_MIN_PURCHASE'
  | 'PROGRESSIVE_COUPON_NOT_FOUND'
  | 'PROGRESSIVE_COUPON_NOT_READY'
  | 'PROGRESSIVE_COUPON_NOT_STARTED'
  | 'PROGRESSIVE_COUPON_RESERVATION_NOT_FOUND'
  | 'PROGRESSIVE_COUPON_STACK_NOT_ALLOWED'
  | 'PROGRESSIVE_COUPON_STATE_CONFLICT'
  | 'PROGRESSIVE_DUPLICATE_SESSION'
  | 'PROGRESSIVE_IDEMPOTENCY_CONFLICT'
  | 'PROGRESSIVE_INVALID_REQUEST'
  | 'PROGRESSIVE_LEGACY_BASELINE_CONFLICT'
  | 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'
  | 'PROGRESSIVE_LEGACY_SCOPE_NOT_READY'
  | 'PROGRESSIVE_MISSING_TIER'
  | 'PROGRESSIVE_MULTI_MONTH_BOOKING'
  | 'PROGRESSIVE_PAYMENT_EXISTS'
  | 'PROGRESSIVE_RPC_UNAVAILABLE'
  | 'PROGRESSIVE_SCOPE_LOCKED'
  | 'PROGRESSIVE_SCOPE_REVISION_CONFLICT'
  | 'PROGRESSIVE_UNAUTHORIZED'
  | 'PROGRESSIVE_WRITES_DISABLED'

const KNOWN_ERROR_CODES = new Set<ProgressiveBookingWriteErrorCode>([
  'PROGRESSIVE_BOOKING_CONFLICT',
  'PROGRESSIVE_BOOKING_EXPIRED',
  'PROGRESSIVE_BOOKING_NOT_PENDING',
  'PROGRESSIVE_CAPACITY_EXCEEDED',
  'PROGRESSIVE_COUPON_ALREADY_USED',
  'PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED',
  'PROGRESSIVE_COUPON_EXPIRED',
  'PROGRESSIVE_COUPON_INACTIVE',
  'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED',
  'PROGRESSIVE_COUPON_MAX_USES',
  'PROGRESSIVE_COUPON_MIN_PURCHASE',
  'PROGRESSIVE_COUPON_NOT_FOUND',
  'PROGRESSIVE_COUPON_NOT_READY',
  'PROGRESSIVE_COUPON_NOT_STARTED',
  'PROGRESSIVE_COUPON_RESERVATION_NOT_FOUND',
  'PROGRESSIVE_COUPON_STACK_NOT_ALLOWED',
  'PROGRESSIVE_COUPON_STATE_CONFLICT',
  'PROGRESSIVE_DUPLICATE_SESSION',
  'PROGRESSIVE_IDEMPOTENCY_CONFLICT',
  'PROGRESSIVE_INVALID_REQUEST',
  'PROGRESSIVE_LEGACY_BASELINE_CONFLICT',
  'PROGRESSIVE_LEGACY_BASELINE_DRIFT',
  'PROGRESSIVE_LEGACY_SCOPE_NOT_READY',
  'PROGRESSIVE_MISSING_TIER',
  'PROGRESSIVE_MULTI_MONTH_BOOKING',
  'PROGRESSIVE_PAYMENT_EXISTS',
  'PROGRESSIVE_RPC_UNAVAILABLE',
  'PROGRESSIVE_SCOPE_LOCKED',
  'PROGRESSIVE_SCOPE_REVISION_CONFLICT',
  'PROGRESSIVE_UNAUTHORIZED',
  'PROGRESSIVE_WRITES_DISABLED',
])

export interface ProgressiveBookingSessionWriteInput {
  date: string
  startTime: string
  endTime: string
  branchId: string
  childId: string | null
  scheduleTemplateId?: string | null
}

export interface ProgressiveBookingMutationResult {
  ok: true
  mutation: 'create' | 'update' | 'cancel'
  bookingId: string
  scopeId: string
  scopeRevision: number
  totalPrice: number
  expiresAt: string | null
  idempotentReplay: boolean
  changedBookings: Array<{
    bookingId: string
    oldPrice: number
    newPrice: number
  }>
}

interface ProgressiveCreateInput {
  userId: string
  learnerType: LearnerType
  childId: string | null
  branchId: string
  courseTypeId: string
  sessions: ProgressiveBookingSessionWriteInput[]
  couponId?: string | null
  clientRequestId: string
  expectedScopeRevision: number
  expectedLegacyBaselineSessions: number
  expectedLegacyBaselineFingerprint: string
}

interface ProgressiveUpdateInput {
  userId: string
  bookingId: string
  branchId: string
  sessions: ProgressiveBookingSessionWriteInput[]
  clientRequestId: string
  expectedScopeRevision: number
}

interface ProgressiveCancelInput {
  userId: string
  bookingId: string
  clientRequestId: string
  expectedScopeRevision: number
}

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

export class ProgressiveBookingWriteError extends Error {
  constructor(
    public readonly code: ProgressiveBookingWriteErrorCode,
    message: string,
    public readonly causeDetails?: RpcErrorLike,
  ) {
    super(message)
    this.name = 'ProgressiveBookingWriteError'
  }
}

function getRpcClient(): ProgressiveRpcClient {
  return getServiceRoleClient() as unknown as ProgressiveRpcClient
}

function mapRpcError(error: RpcErrorLike): ProgressiveBookingWriteError {
  const source = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  const matchedCode = Array.from(KNOWN_ERROR_CODES).find((code) => source.includes(code))
  if (matchedCode) {
    return new ProgressiveBookingWriteError(matchedCode, source || matchedCode, error)
  }
  return new ProgressiveBookingWriteError(
    'PROGRESSIVE_RPC_UNAVAILABLE',
    source || 'Progressive pricing RPC is unavailable.',
    error,
  )
}

function normalizeSessions(sessions: ProgressiveBookingSessionWriteInput[]) {
  return sessions.map((session) => ({
    date: session.date,
    start_time: session.startTime,
    end_time: session.endTime,
    branch_id: session.branchId,
    child_id: session.childId,
    schedule_template_id: session.scheduleTemplateId || null,
  }))
}

function parseMutationResult(data: unknown): ProgressiveBookingMutationResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_RPC_UNAVAILABLE',
      'Progressive pricing RPC returned an invalid result.',
    )
  }

  const result = data as Partial<ProgressiveBookingMutationResult>
  if (
    result.ok !== true
    || !result.bookingId
    || !result.scopeId
    || !Number.isInteger(result.scopeRevision)
    || typeof result.totalPrice !== 'number'
    || !Array.isArray(result.changedBookings)
  ) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_RPC_UNAVAILABLE',
      'Progressive pricing RPC result is missing authoritative fields.',
    )
  }

  return result as ProgressiveBookingMutationResult
}

async function assertProgressiveCapability(client: ProgressiveRpcClient) {
  const { data, error } = await client.rpc('progressive_pricing_writes_capability_v1')
  if (error) throw mapRpcError(error)

  const capability = data as { ready?: unknown; version?: unknown } | null
  if (capability?.ready !== true || capability.version !== 2) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_RPC_UNAVAILABLE',
      'Progressive pricing database capability is not ready.',
    )
  }
}

async function assertProgressiveCouponCapability(client: ProgressiveRpcClient) {
  const { data, error } = await client.rpc('progressive_coupon_lifecycle_capability_v1')
  if (error) throw mapRpcError(error)

  const capability = data as { ready?: unknown; version?: unknown } | null
  if (capability?.ready !== true || capability.version !== 1) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_RPC_UNAVAILABLE',
      'Progressive coupon lifecycle database capability is not ready.',
    )
  }
}

async function executeProgressiveMutation(
  functionName: string,
  args: Record<string, unknown>,
  options: { requireCouponLifecycle?: boolean } = {},
) {
  if (!isProgressivePricingWritesEnabled()) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_WRITES_DISABLED',
      'Progressive pricing writes are disabled.',
    )
  }

  if (options.requireCouponLifecycle && !isProgressiveCouponLifecycleEnabled()) {
    throw new ProgressiveBookingWriteError(
      'PROGRESSIVE_COUPON_LIFECYCLE_DISABLED',
      'Progressive coupon lifecycle is disabled.',
    )
  }

  const client = getRpcClient()
  await assertProgressiveCapability(client)
  if (options.requireCouponLifecycle) await assertProgressiveCouponCapability(client)
  const { data, error } = await client.rpc(functionName, args)
  if (error) throw mapRpcError(error)
  return parseMutationResult(data)
}

export function createProgressiveBooking(input: ProgressiveCreateInput) {
  return executeProgressiveMutation('create_progressive_booking_v1', {
    p_user_id: input.userId,
    p_learner_type: input.learnerType,
    p_child_id: input.childId,
    p_branch_id: input.branchId,
    p_course_type_id: input.courseTypeId,
    p_sessions: normalizeSessions(input.sessions),
    p_coupon_id: input.couponId || null,
    p_client_request_id: input.clientRequestId,
    p_expected_scope_revision: input.expectedScopeRevision,
    p_expected_legacy_baseline_sessions: input.expectedLegacyBaselineSessions,
    p_expected_legacy_baseline_fingerprint: input.expectedLegacyBaselineFingerprint,
  }, { requireCouponLifecycle: Boolean(input.couponId) })
}

export function updateProgressivePendingBooking(input: ProgressiveUpdateInput) {
  return executeProgressiveMutation('update_progressive_pending_booking_v1', {
    p_user_id: input.userId,
    p_booking_id: input.bookingId,
    p_branch_id: input.branchId,
    p_sessions: normalizeSessions(input.sessions),
    p_client_request_id: input.clientRequestId,
    p_expected_scope_revision: input.expectedScopeRevision,
  })
}

export function cancelProgressivePendingBooking(input: ProgressiveCancelInput) {
  return executeProgressiveMutation('cancel_progressive_pending_booking_v1', {
    p_user_id: input.userId,
    p_booking_id: input.bookingId,
    p_client_request_id: input.clientRequestId,
    p_expected_scope_revision: input.expectedScopeRevision,
  })
}
