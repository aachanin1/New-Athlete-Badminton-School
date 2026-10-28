import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkoutRpc, checkoutError } from '@/lib/booking-checkout-server'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'
export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId || '') || typeof body.fullName !== 'string' || !body.fullName.trim() || body.fullName.length > 200 || typeof body.nickname !== 'string' || body.nickname.length > 100) return NextResponse.json({ error: 'กรุณาระบุชื่อ–นามสกุลผู้เรียน' }, { status: 400 })
    const child = await checkoutRpc('booking_ux_child_v1', { p_actor: user.id, p_request: body.requestId, p_name: body.fullName.trim(), p_nickname: body.nickname.trim() })
    return NextResponse.json({ child })
  } catch (error) { return NextResponse.json({ error: checkoutError(error) }, { status: 409 }) }
}
