'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock, Loader2, Save, ShieldCheck, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CoachOtSettings } from '@/lib/coach-ot-settings'

interface CoachOtSettingsClientProps {
  settings: CoachOtSettings
  updatedAt: string | null
}

function formatMoney(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`
}

function formatDate(value: string | null) {
  if (!value) return 'ยังไม่เคยบันทึก'
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toInputNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function CoachOtSettingsClient({ settings, updatedAt }: CoachOtSettingsClientProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    weeklyThreshold: String(settings.weeklyThreshold),
    privateRate: String(settings.privateRate),
    groupRate: String(settings.groupRate),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const preview = useMemo(() => ({
    weeklyThreshold: toInputNumber(form.weeklyThreshold),
    privateRate: toInputNumber(form.privateRate),
    groupRate: toInputNumber(form.groupRate),
  }), [form.groupRate, form.privateRate, form.weeklyThreshold])

  const hasInvalidValue = preview.weeklyThreshold <= 0
    || preview.weeklyThreshold > 168
    || preview.privateRate < 0
    || preview.groupRate < 0

  const updateForm = (key: keyof CoachOtSettings, value: string) => {
    setError(null)
    setSuccess(null)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const saveSettings = async () => {
    if (hasInvalidValue) {
      setError('กรุณาตรวจสอบตัวเลขอีกครั้ง: เกณฑ์ OT ต้องมากกว่า 0 และเรทต้องไม่ติดลบ')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/coach-ot-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกเรท OT ไม่สำเร็จ')
        return
      }

      setSuccess('บันทึกเรท OT เรียบร้อยแล้ว')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <Wallet className="h-4 w-4" />
            Coach OT Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่าเรท OT โค้ช</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            ใช้เป็นแหล่งข้อมูลกลางสำหรับหน้าเงินเดือนโค้ชและรายรับ-รายจ่าย เมื่อชั่วโมงสอนของโค้ชเกินเกณฑ์รายสัปดาห์
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Super Admin เท่านั้น
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">เกณฑ์ OT</p>
            <p className="mt-1 text-2xl font-bold text-[#153c85]">{preview.weeklyThreshold || 0} ชม./สัปดาห์</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Private</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{formatMoney(preview.privateRate)}/ชม.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">กลุ่ม</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatMoney(preview.groupRate)}/ชม.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-5 p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="weekly-threshold">เกณฑ์ชั่วโมงต่อสัปดาห์</Label>
              <Input
                id="weekly-threshold"
                type="number"
                min={0.5}
                max={168}
                step="0.5"
                value={form.weeklyThreshold}
                onChange={(event) => updateForm('weeklyThreshold', event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="private-rate">เรท OT Private / ชม.</Label>
              <Input
                id="private-rate"
                type="number"
                min={0}
                step="1"
                value={form.privateRate}
                onChange={(event) => updateForm('privateRate', event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-rate">เรท OT กลุ่ม / ชม.</Label>
              <Input
                id="group-rate"
                type="number"
                min={0}
                step="1"
                value={form.groupRate}
                onChange={(event) => updateForm('groupRate', event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
            <div className="flex items-center gap-2 font-semibold text-[#153c85]">
              <Clock className="h-4 w-4" />
              วิธีที่ระบบนำไปคำนวณ
            </div>
            <p className="mt-1">
              ระบบนับชั่วโมงสอนที่เช็คอินพร้อมรูปหลักฐานครบ แยกเป็นรายสัปดาห์ ถ้าเกิน {preview.weeklyThreshold || 0} ชม.
              ชั่วโมงส่วนเกินจะคำนวณเป็น OT ตามประเภทคอร์ส: Private {formatMoney(preview.privateRate)}/ชม.
              และกลุ่ม {formatMoney(preview.groupRate)}/ชม.
            </p>
            <p className="mt-1 text-xs text-gray-400">อัปเดตล่าสุด: {formatDate(updatedAt)}</p>
          </div>

          {hasInvalidValue && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>เกณฑ์ OT ต้องมากกว่า 0 และไม่เกิน 168 ชั่วโมงต่อสัปดาห์ ส่วนเรท OT ต้องไม่ติดลบ</span>
            </div>
          )}
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

          <Button className="w-full bg-[#2748bf] hover:bg-[#153c85] sm:w-auto" onClick={saveSettings} disabled={loading || hasInvalidValue}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            บันทึกเรท OT
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
