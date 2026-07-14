import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProgressivePaymentDrainAvailable } from '@/lib/progressive-pricing-feature'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'

const PAYMENT_ERROR_CONTRACT = {
  PROGRESSIVE_INVALID_REQUEST: { status: 400, error: 'Invalid progressive payment request', refreshRequired: false },
  PROGRESSIVE_UNAUTHORIZED: { status: 403, error: 'Progressive payment access denied', refreshRequired: false },
  PROGRESSIVE_USER_MISMATCH: { status: 403, error: 'Progressive payment access denied', refreshRequired: false },
  PROGRESSIVE_BATCH_NOT_FOUND: { status: 404, error: 'Progressive payment batch was not found', refreshRequired: true },
  PROGRESSIVE_SCOPE_REVISION_CONFLICT: { status: 409, error: 'Progressive payment scope changed', refreshRequired: true },
  PROGRESSIVE_PAYMENT_PREFIX_REQUIRED: { status: 409, error: 'Progressive payment prefix is required', refreshRequired: true },
  PROGRESSIVE_BOOKING_EXPIRED: { status: 409, error: 'Progressive payment booking expired', refreshRequired: true },
  PROGRESSIVE_COUPON_STATE_CONFLICT: { status: 409, error: 'Progressive payment coupon state changed', refreshRequired: true },
  PROGRESSIVE_IDEMPOTENCY_CONFLICT: { status: 409, error: 'Progressive payment request conflict', refreshRequired: false },
  PROGRESSIVE_SCOPE_LOCKED: { status: 409, error: 'Progressive payment scope is locked', refreshRequired: true },
  PROGRESSIVE_PAYMENT_EXISTS: { status: 409, error: 'Progressive payment already exists', refreshRequired: true },
  PROGRESSIVE_BOOKING_NOT_PENDING: { status: 409, error: 'Progressive payment booking is no longer pending', refreshRequired: true },
  PROGRESSIVE_BATCH_AMOUNT_MISMATCH: { status: 409, error: 'Progressive payment amount changed', refreshRequired: true },
  PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT: { status: 409, error: 'Progressive payment booking state changed', refreshRequired: true },
  PROGRESSIVE_CURRENCY_MISMATCH: { status: 409, error: 'Progressive payment currency changed', refreshRequired: true },
  PROGRESSIVE_BATCH_NOT_SUBMITTABLE: { status: 409, error: 'Progressive payment batch is not available', refreshRequired: true },
  PROGRESSIVE_BATCH_EXPIRED: { status: 409, error: 'Progressive payment batch expired', refreshRequired: true },
  PROGRESSIVE_RPC_UNAVAILABLE: { status: 503, error: 'Progressive payment service is unavailable', refreshRequired: false },
  PROGRESSIVE_WRITES_DISABLED: { status: 503, error: 'Progressive payment service is unavailable', refreshRequired: false },
  PROGRESSIVE_PAYMENT_BATCH_DISABLED: { status: 503, error: 'Progressive payment service is unavailable', refreshRequired: false },
  PROGRESSIVE_COUPON_LIFECYCLE_DISABLED: { status: 503, error: 'Progressive payment service is unavailable', refreshRequired: false },
} as const

type PaymentErrorCode = keyof typeof PAYMENT_ERROR_CONTRACT

function getPaymentErrorCode(error: unknown): PaymentErrorCode | null {
  const directCode = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : ''
  if (directCode in PAYMENT_ERROR_CONTRACT) return directCode as PaymentErrorCode

  const message = error instanceof Error ? error.message : ''
  return (Object.keys(PAYMENT_ERROR_CONTRACT) as PaymentErrorCode[])
    .find((code) => message.includes(code)) || null
}

export async function requireProgressivePaymentUser(
  request: NextRequest,
  options: { mutation?: boolean } = {},
) {
  if (options.mutation && !isSameOriginMutation(request)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!isProgressivePaymentDrainAvailable()) {
    return {
      ok: false as const,
      response: NextResponse.json({
        error: 'Progressive payment dependencies are unavailable',
        code: 'PROGRESSIVE_PAYMENT_DEPENDENCY_UNAVAILABLE',
      }, { status: 503 }),
    }
  }

  return { ok: true as const, user }
}

export function progressivePaymentError(error: unknown) {
  const code = getPaymentErrorCode(error)
  if (!code) {
    return NextResponse.json({
      code: 'PROGRESSIVE_PAYMENT_UNKNOWN_ERROR',
      error: 'Unable to process progressive payment',
      refreshRequired: false,
    }, { status: 500 })
  }

  const contract = PAYMENT_ERROR_CONTRACT[code]
  return NextResponse.json({ code, error: contract.error, refreshRequired: contract.refreshRequired }, {
    status: contract.status,
  })
}
