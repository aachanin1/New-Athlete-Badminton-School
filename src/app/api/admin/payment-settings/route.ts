import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
  paymentTransferReadToken,
  validateTransferAccounts,
  type PaymentBranch,
} from '@/lib/payment-settings'

const stale = () => NextResponse.json({ error: 'ข้อมูลการตั้งค่าเปลี่ยนแล้ว หรือหน้าที่ใช้เป็นรุ่นเก่า กรุณาโหลดหน้าล่าสุดก่อนบันทึก', code: 'PAYMENT_SETTINGS_STALE' }, { status: 409 })

export async function GET() {
  const access = await requireAdminMenuAccess('payments')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const supabase = getServiceRoleClient()
  const [setting, roster] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', PAYMENT_TRANSFER_SETTING_KEY).maybeSingle(),
    supabase.from('branches').select('id,name,slug,is_active').order('name'),
  ])
  if (setting.error || roster.error) return NextResponse.json({ error: 'โหลดการตั้งค่าบัญชีไม่สำเร็จ' }, { status: 500 })
  return NextResponse.json({ settings: normalizePaymentTransferSettings(setting.data?.value, roster.data), branches: roster.data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('payments')
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status })
  }

  try {
    const body = await request.json()
    if (!body || body.version !== 2 || typeof body.expectedReadToken !== 'string' || !Array.isArray(body.accounts)) return stale()
    const adminSupabase = getServiceRoleClient()
    const [current, roster] = await Promise.all([
      adminSupabase.from('system_settings').select('id,value').eq('key', PAYMENT_TRANSFER_SETTING_KEY).maybeSingle(),
      adminSupabase.from('branches').select('id,name,slug,is_active').order('name'),
    ])
    if (current.error || roster.error) return NextResponse.json({ error: 'ตรวจสอบการตั้งค่าล่าสุดไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
    if (body.expectedReadToken !== paymentTransferReadToken(current.data?.value)) return stale()
    const validated = validateTransferAccounts(body.accounts, roster.data as PaymentBranch[])
    if (validated.error) return NextResponse.json({ error: validated.error }, { status: 400 })
    const previous = current.data?.value
    // Keep every existing legacy field byte-for-byte for read/rollback compatibility.
    // A stale single-object client cannot reach this update path.
    const preserved = previous && typeof previous === 'object' && !Array.isArray(previous)
      ? previous : previous == null ? {} : { legacyValue: previous }
    const value = { ...preserved, version: 2, revision: crypto.randomUUID(), accounts: validated.accounts }
    const row = { key: PAYMENT_TRANSFER_SETTING_KEY, value, updated_by: access.ctx.user.id, updated_at: new Date().toISOString() }
    // Compare-and-swap happens in the UPDATE statement, not just the earlier read.
    // For the first row, the existing unique key permits only one INSERT winner.
    const result = current.data
      ? await adminSupabase.from('system_settings').update(row)
        .eq('id', current.data.id).eq('value', JSON.stringify(previous)).select('id,value').maybeSingle()
      : await adminSupabase.from('system_settings').insert(row).select('id,value').single()
    if (result.error?.code === '23505' || (!result.error && !result.data)) return stale()
    if (result.error || !result.data) {
      return NextResponse.json({ error: 'บันทึกข้อมูลการชำระเงินไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
    }
    await logActivity({
      userId: access.ctx.user.id, action: 'update_payment_transfer_settings',
      entityType: 'system_settings', entityId: result.data.id,
      details: { version: 2, revision: value.revision, accountCount: validated.accounts.length,
        branchIds: [...new Set(validated.accounts.flatMap(account => account.branchIds))] },
    })
    return NextResponse.json({ success: true, settings: normalizePaymentTransferSettings(result.data.value, roster.data), branches: roster.data })
  } catch {
    return NextResponse.json(
      { error: 'อ่านคำขอบันทึกไม่สำเร็จ กรุณาโหลดหน้าล่าสุดแล้วลองใหม่' },
      { status: 400 }
    )
  }
}
