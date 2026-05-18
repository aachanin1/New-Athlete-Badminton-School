import { PaymentSettingsClient } from '@/components/admin/payment-settings-client'
import { createClient } from '@/lib/supabase/server'
import {
  PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings,
} from '@/lib/payment-settings'

export default async function PaymentSettingsPage() {
  const supabase = createClient()
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', PAYMENT_TRANSFER_SETTING_KEY)
    .maybeSingle() as unknown as { data: { value: unknown } | null }

  return <PaymentSettingsClient settings={normalizePaymentTransferSettings(setting?.value)} />
}
