'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Banknote, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PaymentTransferSettings } from '@/lib/payment-settings'

interface PaymentSettingsClientProps {
  settings: PaymentTransferSettings
  compact?: boolean
}

export function PaymentSettingsClient({ settings, compact = false }: PaymentSettingsClientProps) {
  const router = useRouter()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateField = (field: keyof PaymentTransferSettings, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setMessage(null)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/payment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'บันทึกข้อมูลการชำระเงินไม่สำเร็จ')
        return
      }

      setMessage('บันทึกข้อมูลการชำระเงินเรียบร้อยแล้ว')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className={`flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between ${compact ? 'hidden' : ''}`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <Banknote className="h-4 w-4" />
            Payment Settings
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่าการชำระเงิน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ข้อมูลนี้จะแสดงให้ผู้ใช้เห็นในหน้าแนบสลิปโอนเงิน
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/payments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับหน้าตรวจชำระเงิน
          </Link>
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">เลขบัญชีที่แสดงในระบบต้องตรงกับบัญชีที่ตั้งไว้ใน SlipOK</p>
            <p className="mt-1 text-amber-700">
              ถ้าเลขบัญชีหรือบัญชีรับเงินไม่ตรงกัน ผู้ใช้อาจโอนถูกตามหน้าระบบ แต่ SlipOK ตรวจไม่ผ่านหรือทำให้ทีมตรวจสอบสับสนได้
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardContent className={`grid gap-5 p-4 ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2'}`}>
          <div className="space-y-2">
            <Label htmlFor="bankName">ธนาคาร</Label>
            <Input
              id="bankName"
              value={form.bankName}
              onChange={(event) => updateField('bankName', event.target.value)}
              placeholder="เช่น กสิกรไทย"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountName">ชื่อบัญชี</Label>
            <Input
              id="accountName"
              value={form.accountName}
              onChange={(event) => updateField('accountName', event.target.value)}
              placeholder="ชื่อบัญชีที่รับโอน"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountNumber">เลขบัญชี</Label>
            <Input
              id="accountNumber"
              value={form.accountNumber}
              onChange={(event) => updateField('accountNumber', event.target.value)}
              placeholder="เลขบัญชีที่ต้องตรงกับ SlipOK"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promptPay">PromptPay / พร้อมเพย์</Label>
            <Input
              id="promptPay"
              value={form.promptPay}
              onChange={(event) => updateField('promptPay', event.target.value)}
              placeholder="ถ้ามี"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchName">สาขาบัญชี</Label>
            <Input
              id="branchName"
              value={form.branchName}
              onChange={(event) => updateField('branchName', event.target.value)}
              placeholder="ถ้ามี"
            />
          </div>
          <div className={`space-y-2 ${compact ? 'md:col-span-2' : 'lg:col-span-2'}`}>
            <Label htmlFor="instructions">ข้อความแนะนำผู้ใช้</Label>
            <Textarea
              id="instructions"
              value={form.instructions}
              onChange={(event) => updateField('instructions', event.target.value)}
              placeholder="เช่น โอนยอดให้ตรงกับยอดชำระ และแนบสลิปที่เห็นวันเวลา/ยอดเงินชัดเจน"
              className="min-h-28"
            />
          </div>

          {(message || error) && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${compact ? 'md:col-span-2' : 'lg:col-span-2'} ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}

          <div className={`flex justify-end ${compact ? 'md:col-span-2' : 'lg:col-span-2'}`}>
            <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              บันทึกการตั้งค่า
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
