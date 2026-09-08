import { PaymentSettingsClient } from '@/components/admin/payment-settings-client'
import { createClient } from '@/lib/supabase/server'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

export default async function PaymentSettingsPage() {
  const supabase = await createClient()
  const [setting, roster] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', PAYMENT_TRANSFER_SETTING_KEY).maybeSingle() as unknown as Promise<{ data: { value: unknown } | null; error: { message: string } | null }>,
    supabase.from('branches').select('id,name,slug,is_active').order('name'),
  ])
  if (setting.error || roster.error) throw new Error('[payment-settings] Unable to load transfer settings or branches')
  return <PaymentSettingsClient settings={normalizePaymentTransferSettings(setting.data?.value, roster.data || [])} branches={roster.data || []} />
}
