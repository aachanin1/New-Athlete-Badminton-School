import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('payments')
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  try {
    const body = await request.json()
    const value = normalizePaymentTransferSettings(body)

    const adminSupabase = getServiceRoleClient()
    const { data, error } = await adminSupabase
      .from('system_settings')
      .upsert({
        key: PAYMENT_TRANSFER_SETTING_KEY,
        value,
        updated_by: access.ctx.user.id,
      }, { onConflict: 'key' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save payment settings' },
      { status: 500 }
    )
  }
}
