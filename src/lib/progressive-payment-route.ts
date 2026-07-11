import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isProgressivePaymentEntryAvailableForUser,
  isProgressivePaymentDrainAvailableForUser,
} from '@/lib/progressive-pricing-feature'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'

export async function requireProgressivePaymentUser(
  request: NextRequest,
  options: { mutation?: boolean; requireEntry?: boolean } = {},
) {
  if (options.mutation && !isSameOriginMutation(request)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const allowed = options.requireEntry
    ? isProgressivePaymentEntryAvailableForUser(user.id)
    : isProgressivePaymentDrainAvailableForUser(user.id)
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: 'Progressive payment is not available for this account' }, { status: 403 }) }
  }

  return { ok: true as const, user }
}

export function progressivePaymentError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown progressive payment error'
  const status = message.includes('UNAUTHORIZED') ? 403
    : message.includes('NOT_FOUND') ? 404
      : message.includes('EXPIRED') || message.includes('CONFLICT') || message.includes('REQUIRED') ? 409
        : 500
  return NextResponse.json({ error: message }, { status })
}
