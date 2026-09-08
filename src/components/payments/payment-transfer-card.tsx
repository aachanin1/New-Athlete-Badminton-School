'use client'

import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import {
  PAYMENT_TRANSFER_INSTRUCTION, PAYMENT_TRANSFER_SETTING_KEY,
  normalizePaymentTransferSettings, paymentTransferReadToken, resolveBookingTransferAccounts,
  transferAccountDetails, transferAccountKey, transferAccountNumber,
  type PaymentBranch, type PaymentTransferDisplayCard, type PaymentTransferSettings,
} from '@/lib/payment-settings'

const BANK_STYLE: Record<string, string> = {
  SCB: 'border-purple-300 bg-purple-50 text-purple-950',
  กรุงศรี: 'border-yellow-400 bg-yellow-50 text-yellow-950',
  TTB: 'border-orange-300 bg-orange-50 text-blue-950',
  'ธ.กรุงเทพ': 'border-blue-300 bg-blue-50 text-blue-950',
}

export function PaymentTransferCard({ account }: { account: PaymentTransferDisplayCard }) {
  const [copying, setCopying] = useState(false)
  const [message, setMessage] = useState('')
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  const copy = async (details: boolean) => {
    const content = details ? transferAccountDetails(account) : transferAccountNumber(account.accountNumber)
    setCopying(true); setMessage(''); setManualCopy(null)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(content)
      setMessage('คัดลอกแล้ว')
    } catch {
      setMessage('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกด้วยตนเอง')
      setManualCopy(content)
    } finally { setCopying(false) }
  }
  return (
    <section className={`min-w-0 space-y-3 rounded-xl border-l-4 p-4 ${BANK_STYLE[account.bankName] || 'border-slate-300 bg-slate-50 text-slate-950'}`}
      data-testid="payment-transfer-card" data-account-id={account.id}>
      <p className="break-words text-sm font-semibold" data-testid="payment-transfer-branches">
        {account.branches.map(branch => branch.name).join(' · ') || 'ยังไม่ได้เลือกสาขา'}
      </p>
      <p className="text-sm font-semibold">ธนาคาร {account.bankName || '—'}</p>
      <div>
        <p className="text-xs">เลขบัญชี</p>
        <p className="select-all break-all font-mono text-2xl font-bold leading-relaxed" data-testid="payment-transfer-number">{account.accountNumber || '—'}</p>
      </div>
      <p className="select-text break-words text-base font-medium" data-testid="payment-transfer-recipient">{account.accountName || 'ยังไม่ได้ระบุชื่อบัญชี'}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="min-h-11 w-full bg-white text-slate-900" disabled={copying || !account.accountNumber} onClick={() => void copy(false)}>
          <Copy className="mr-2 h-4 w-4 shrink-0" />คัดลอกเลขบัญชี
        </Button>
        <Button type="button" variant="outline" className="min-h-11 w-full bg-white text-slate-900" disabled={copying || !account.accountNumber} onClick={() => void copy(true)}>
          <Copy className="mr-2 h-4 w-4 shrink-0" />คัดลอกข้อมูลทั้งหมด
        </Button>
      </div>
      <p role="status" className="break-words text-sm">{message}</p>
      {manualCopy !== null && <Textarea aria-label="ข้อความสำหรับคัดลอกด้วยตนเอง" readOnly value={manualCopy}
        className="min-h-28 bg-white text-slate-900" onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} />}
    </section>
  )
}

interface TransferInstructionsProps {
  settings: PaymentTransferSettings
  branches: PaymentBranch[]
  payBookingIds: string[]
  bookings: Parameters<typeof resolveBookingTransferAccounts>[3]
  bookingSessionsMap: Parameters<typeof resolveBookingTransferAccounts>[4]
  submitted: boolean
}

export function PaymentTransferInstructions({ settings, branches, payBookingIds, bookings, bookingSessionsMap, submitted }: TransferInstructionsProps) {
  // Mounted separately for each open payment dialog. Receiver changes require an
  // explicit acknowledgement; refresh/polling never replace an in-flight card.
  const [snapshot, setSnapshot] = useState({ settings, branches })
  const [latest, setLatest] = useState({ settings, branches })
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [readError, setReadError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => { setLatest({ settings, branches }) }, [settings, branches])
  useEffect(() => {
    if (submitted) return
    const supabase = createClient()
    let alive = true
    let reading = false
    let controller: AbortController | null = null
    const check = async () => {
      if (reading || document.visibilityState === 'hidden') return
      reading = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 10000)
      try {
        const [setting, roster] = await Promise.all([
          supabase.from('system_settings').select('value').eq('key', PAYMENT_TRANSFER_SETTING_KEY).abortSignal(controller.signal).maybeSingle() as unknown as Promise<{ data: { value: unknown } | null; error: { message: string } | null }>,
          supabase.from('branches').select('id,name,slug,is_active').order('name').abortSignal(controller.signal),
        ])
        if (setting.error || roster.error || !roster.data) throw new Error('settings read failed')
        if (alive) {
          setLatest({ settings: normalizePaymentTransferSettings(setting.data?.value, roster.data), branches: roster.data })
          setCheckedAt(new Date().toLocaleTimeString('th-TH')); setReadError(false)
        }
      } catch { if (alive) setReadError(true) }
      finally { window.clearTimeout(timeout); reading = false }
    }
    void check()
    const timer = window.setInterval(() => void check(), 30000)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      alive = false; controller?.abort(); window.clearInterval(timer)
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus)
    }
  }, [submitted, refreshKey])
  if (submitted) return <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" data-testid="payment-transfer-submitted">
    กำลังดำเนินการหรือได้รับสลิปแล้ว กรุณาอย่าโอนเงินซ้ำ ตรวจสอบสถานะรายการด้านล่าง
  </p>
  const changed = snapshot.settings.readToken !== latest.settings.readToken
    || paymentTransferReadToken(snapshot.branches) !== paymentTransferReadToken(latest.branches)
  if (readError) return <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
    <p>ตรวจสอบบัญชีรับเงินล่าสุดไม่สำเร็จ กรุณาลองใหม่ก่อนโอนเงิน หากโอนแล้วไม่ต้องโอนซ้ำ สามารถแนบสลิปเดิมได้</p>
    <Button type="button" variant="outline" onClick={() => { setReadError(false); setCheckedAt(null); setRefreshKey(key => key + 1) }}>ตรวจสอบอีกครั้ง</Button>
  </div>
  if (!checkedAt) return <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />กำลังตรวจสอบข้อมูลบัญชีรับเงินล่าสุด</p>
  if (changed) return <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="payment-transfer-changed">
    <p>ข้อมูลบัญชีรับเงินเปลี่ยนตั้งแต่เปิดรายการ กรุณาตรวจสอบข้อมูลล่าสุดก่อนโอนเงิน</p>
    <p>หากโอนแล้ว ไม่ต้องโอนซ้ำ ให้แนบสลิปเดิมเพื่อดำเนินการต่อ</p>
    <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setSnapshot(latest)}>แสดงบัญชีรับเงินล่าสุด</Button>
  </div>
  const result = resolveBookingTransferAccounts(snapshot.settings, snapshot.branches, payBookingIds, bookings, bookingSessionsMap)
  return <div className="min-w-0 space-y-3" data-testid="payment-transfer-instructions">
    {result.cards.length > 0 && <p className="text-sm font-semibold text-slate-900">{PAYMENT_TRANSFER_INSTRUCTION}</p>}
    {result.issues.map(issue => <p key={issue} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{issue}</p>)}
    {result.cards.map(account => <PaymentTransferCard key={transferAccountKey(account)} account={account} />)}
    <p className="text-xs text-slate-600">ข้อมูลสำหรับรายการที่กำลังชำระ · ตรวจล่าสุด {checkedAt} หากโอนแล้วไม่ต้องโอนซ้ำ</p>
  </div>
}
