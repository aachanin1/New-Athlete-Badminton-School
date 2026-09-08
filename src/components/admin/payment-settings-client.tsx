'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { PaymentTransferCard } from '@/components/payments/payment-transfer-card'
import { PAYMENT_BANK_NAMES, paymentTransferReadToken, transferAccountKey, validateTransferAccounts,
  type PaymentBranch, type PaymentTransferAccount, type PaymentTransferSettings } from '@/lib/payment-settings'

interface PaymentSettingsClientProps {
  settings: PaymentTransferSettings
  branches: PaymentBranch[]
  compact?: boolean
}

export function PaymentSettingsClient({ settings, branches, compact = false }: PaymentSettingsClientProps) {
  const router = useRouter()
  const [saved, setSaved] = useState(settings)
  const [observed, setObserved] = useState(settings)
  const [roster, setRoster] = useState(branches)
  const [form, setForm] = useState(settings.accounts)
  const [activeId, setActiveId] = useState<string | null>(settings.accounts[0]?.id || null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<'reload' | 'remove' | null>(null)
  useEffect(() => { setObserved(settings) }, [settings])
  const active = form.find(account => account.id === activeId)
  const dirty = paymentTransferReadToken(form) !== paymentTransferReadToken(saved.accounts)
  const stale = observed.readToken !== saved.readToken
  const clearFeedback = () => { setMessage(null); setError(null) }
  const update = (change: Partial<PaymentTransferAccount>) => {
    setForm(current => current.map(account => account.id === activeId ? { ...account, ...change } : account))
    clearFeedback()
  }
  const acceptSaved = (result: { settings: PaymentTransferSettings; branches: PaymentBranch[] }) => {
    setSaved(result.settings); setObserved(result.settings); setForm(result.settings.accounts); setRoster(result.branches)
    setActiveId(current => result.settings.accounts.some(account => account.id === current) ? current : result.settings.accounts[0]?.id || null)
  }
  const reload = async () => {
    setSaving(true); clearFeedback()
    try {
      const response = await fetch('/api/admin/payment-settings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.settings || !Array.isArray(result.branches)) throw new Error()
      acceptSaved(result)
      setMessage('โหลดข้อมูลล่าสุดแล้ว')
    } catch { setError('โหลดข้อมูลล่าสุดไม่สำเร็จ แบบร่างยังอยู่ กรุณาลองใหม่') }
    finally { setSaving(false) }
  }
  const save = async () => {
    if (saving) return
    clearFeedback()
    const validation = validateTransferAccounts(form, roster)
    if (validation.error) { setError(validation.error); return }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/payment-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 2, accounts: form, expectedReadToken: saved.readToken }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success || result.settings?.source !== 'saved' || !Array.isArray(result.branches)) {
        setError(result?.error || 'บันทึกไม่สำเร็จ แบบร่างยังอยู่ กรุณาโหลดข้อมูลล่าสุดเพื่อตรวจสอบสถานะก่อนลองใหม่')
        return
      }
      acceptSaved(result)
      setMessage('บันทึกข้อมูลการชำระเงินเรียบร้อยแล้ว')
      router.refresh()
    } catch { setError('ยังยืนยันผลการบันทึกไม่ได้ แบบร่างยังอยู่ กรุณาโหลดข้อมูลล่าสุดเพื่อตรวจสอบก่อนลองใหม่') }
    finally { setSaving(false) }
  }
  const add = () => {
    const id = crypto.randomUUID()
    setForm(current => [...current, { id, bankName: 'SCB', accountNumber: '', accountName: '', branchIds: [] }])
    setActiveId(id); clearFeedback()
  }
  return <div className="min-w-0 space-y-4" data-testid="payment-settings-editor">
    {!compact && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold text-[#153c85]">ตั้งค่าการชำระเงิน</h1><p className="text-sm text-slate-600">บัญชีรับเงินและสาขาที่ใช้บัญชีร่วมกัน</p></div>
      <Button variant="outline" asChild><Link href="/admin/payments"><ArrowLeft className="mr-2 h-4 w-4" />กลับหน้าตรวจชำระเงิน</Link></Button>
    </div>}
    <div className="space-y-1 rounded-xl border bg-blue-50 p-4 text-sm text-blue-950">
      <p>ลูกค้าเลือกโอนยอดทั้งหมดเข้าบัญชีใดบัญชีหนึ่งที่เกี่ยวข้องกับชุดชำระ แล้วแนบสลิป 1 ใบ</p>
      <p>การตั้งค่านี้เป็นข้อมูลแนะนำการโอน ไม่ใช่การตรวจผู้รับเงินจริง และไม่แก้ประวัติธุรกรรมย้อนหลัง</p>
    </div>
    <p className="text-sm text-slate-600" data-testid="payment-settings-source">
      {saved.source === 'defaults' ? 'ใช้ข้อมูลตั้งต้นของโรงเรียน — ยังไม่มีชุดบัญชีที่บันทึกใหม่' : saved.source === 'saved' ? 'ใช้ชุดบัญชีที่บันทึกแล้ว' : 'ข้อมูลที่บันทึกผิดรูปแบบ กรุณาตรวจสอบและแก้ไข'}
      {' · '}{dirty ? 'มีแบบร่างที่ยังไม่บันทึก' : 'ไม่มีการแก้ไขในแบบร่าง'}
    </p>
    {saved.error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{saved.error}</p>}
    {stale && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">มีการตั้งค่ารุ่นใหม่แล้ว แบบร่างนี้ยังคงอยู่ กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก</p>}
    {(error || message) && <p role={error ? 'alert' : 'status'} className={'rounded-lg border p-3 text-sm ' + (error ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-900')}>{error || message}</p>}
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {form.map((account, index) => <button key={account.id} type="button" onClick={() => setActiveId(account.id)}
          aria-pressed={activeId === account.id} data-testid="payment-settings-account"
          className={'min-h-16 min-w-0 rounded-lg border p-3 text-left text-sm ' + (activeId === account.id ? 'border-blue-500 bg-blue-50' : 'bg-white')}>
          <span className="block font-semibold">บัญชี {index + 1} · {account.bankName}</span>
          <span className="block break-all font-mono">{account.accountNumber || 'ยังไม่ได้ระบุเลขบัญชี'}</span>
          <span className="block break-words text-slate-600">{account.branchIds.map(id => roster.find(branch => branch.id === id)?.name || 'ไม่พบสาขา').join(' · ') || 'ยังไม่ได้เลือกสาขา'}</span>
        </button>)}
      </div>
      <Button type="button" variant="outline" onClick={add} disabled={form.length >= 100}><Plus className="mr-2 h-4 w-4" />เพิ่มบัญชีรับเงิน</Button>
      {form.length === 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">ไม่มีบัญชีรับเงิน การบันทึกชุดว่างจะไม่แสดงบัญชีให้ลูกค้า และจะไม่คืนข้อมูลตั้งต้นอัตโนมัติ</p>}
      {active && <div className="min-w-0 space-y-4 rounded-xl border bg-white p-4" data-testid="payment-settings-active-account">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="transfer-bank">ธนาคาร</Label>
            <select id="transfer-bank" value={active.bankName} className="h-11 w-full rounded-md border bg-white px-3 text-sm" onChange={event => update({ bankName: event.target.value })}>
              {PAYMENT_BANK_NAMES.map(bank => <option key={bank} value={bank}>{bank}</option>)}
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="transfer-number">เลขบัญชี</Label>
            <Input id="transfer-number" inputMode="numeric" maxLength={40} value={active.accountNumber} onChange={event => update({ accountNumber: event.target.value })} />
          </div>
          <div className="min-w-0 space-y-2 md:col-span-2">
            <Label htmlFor="transfer-recipient">ชื่อบัญชี</Label>
            <Input id="transfer-recipient" maxLength={200} value={active.accountName} onChange={event => update({ accountName: event.target.value })} />
          </div>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">สาขาที่ใช้บัญชีนี้</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roster.map(branch => {
              const checked = active.branchIds.includes(branch.id)
              const elsewhere = form.some(account => account.id !== active.id && account.branchIds.includes(branch.id) && transferAccountKey(account) !== transferAccountKey(active))
              return <label key={branch.id} className={'flex min-h-11 items-center gap-3 rounded-lg border p-2 text-sm ' + (elsewhere ? 'text-slate-400' : 'text-slate-800')}>
                <input type="checkbox" className="h-4 w-4 shrink-0" checked={checked} disabled={elsewhere && !checked}
                  onChange={event => update({ branchIds: event.target.checked ? [...active.branchIds, branch.id] : active.branchIds.filter(id => id !== branch.id) })} />
                <span className="break-words">{branch.name}{!branch.is_active ? ' (ปิดใช้งาน)' : ''}{elsewhere ? ' · ผูกบัญชีอื่นแล้ว' : ''}</span>
              </label>
            })}
          </div>
          {active.branchIds.some(id => !roster.some(branch => branch.id === id)) && <p role="alert" className="text-sm text-red-700">มีสาขาที่ไม่พบในระบบ กรุณาโหลดข้อมูลล่าสุด</p>}
        </fieldset>
        <p className="text-sm font-semibold text-slate-600">ตัวอย่างจากแบบร่าง</p>
        <PaymentTransferCard key={paymentTransferReadToken(active)} account={{ ...active, branches: roster.filter(branch => active.branchIds.includes(branch.id)) }} />
        <Button type="button" variant="outline" className="text-red-700" onClick={() => setConfirmation('remove')}><Trash2 className="mr-2 h-4 w-4" />นำบัญชีนี้ออกจากแบบร่าง</Button>
      </div>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => dirty ? setConfirmation('reload') : void reload()}>โหลดข้อมูลล่าสุด</Button>
        <Button type="button" className="bg-[#2748bf]" onClick={() => void save()} disabled={saving || stale} data-testid="payment-settings-save">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}บันทึกการตั้งค่า
        </Button>
      </div>
    </fieldset>
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>{confirmation === 'reload' ? 'โหลดข้อมูลล่าสุดและละทิ้งแบบร่าง?' : 'นำบัญชีนี้ออกจากแบบร่าง?'}</AlertDialogTitle>
        <AlertDialogDescription>{confirmation === 'reload' ? 'การแก้ไขที่ยังไม่บันทึกจะถูกแทนด้วยค่าล่าสุดเมื่อโหลดสำเร็จ' : 'การนำออกจะมีผลกับข้อมูลรับโอนเมื่อกดบันทึกการตั้งค่า ประวัติธุรกรรมเดิมไม่เปลี่ยน'}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
        <AlertDialogAction onClick={() => {
          if (confirmation === 'reload') void reload()
          else { const remaining = form.filter(account => account.id !== activeId); setForm(remaining); setActiveId(remaining[0]?.id || null); clearFeedback() }
          setConfirmation(null)
        }}>ยืนยัน</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>
}
