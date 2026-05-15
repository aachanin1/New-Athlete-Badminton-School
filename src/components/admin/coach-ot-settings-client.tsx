'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BriefcaseBusiness, CheckCircle2, Clock, Loader2, RotateCcw, Save, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  COACH_TEACHING_RULES,
  getCoachTeachingOptions,
  normalizeCoachTeachingRulesSettings,
  type CoachTeachingRules,
} from '@/lib/coach-teaching-rules'

interface CoachOtSettingsClientProps {
  settings: CoachTeachingRules
  updatedAt: string | null
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'ยังไม่เคยบันทึก'
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function serializeRules(settings: CoachTeachingRules) {
  return {
    full_time: {
      thresholdHours: settings.full_time.thresholdHours,
      privateRate: settings.full_time.privateRate,
      groupRate: settings.full_time.groupRate,
    },
    half_time: {
      thresholdHours: settings.half_time.thresholdHours,
      privateRate: settings.half_time.privateRate,
      groupRate: settings.half_time.groupRate,
    },
    part_time: {
      thresholdHours: settings.part_time.thresholdHours,
      privateRate: settings.part_time.privateRate,
      groupRate: settings.part_time.groupRate,
    },
  }
}

export function CoachOtSettingsClient({ settings, updatedAt }: CoachOtSettingsClientProps) {
  const router = useRouter()
  const [form, setForm] = useState<CoachTeachingRules>(() => normalizeCoachTeachingRulesSettings(settings))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const rules = useMemo(() => getCoachTeachingOptions(form), [form])

  const updateRule = (
    employmentType: keyof CoachTeachingRules,
    field: 'thresholdHours' | 'privateRate' | 'groupRate',
    value: string,
  ) => {
    const parsed = Number(value)
    setError(null)
    setSuccess(null)
    setForm((current) => ({
      ...current,
      [employmentType]: {
        ...current[employmentType],
        [field]: Number.isFinite(parsed) ? parsed : 0,
      },
    }))
  }

  const resetDefaults = () => {
    setForm(normalizeCoachTeachingRulesSettings(COACH_TEACHING_RULES))
    setError(null)
    setSuccess(null)
  }

  const saveSettings = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/coach-ot-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: serializeRules(form) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || 'บันทึกกฎชั่วโมงสอนไม่สำเร็จ')
      }

      setSuccess('บันทึกกฎชั่วโมงสอนโค้ชสำเร็จ')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <BriefcaseBusiness className="h-4 w-4" />
            Coach Teaching Rules
          </div>
          <h2 className="mt-1 text-2xl font-bold text-[#153c85]">กฎชั่วโมงสอนโค้ช</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            ตั้งค่าเกณฑ์รายสัปดาห์และเรทต่อชั่วโมงที่ใช้จริงในหน้า “คำนวณชั่วโมงสอน”
            โดยแยกจากสิทธิ์ Head Coach / Coach และไม่รวมเงินเดือนฐานของโค้ช
          </p>
          <p className="mt-1 text-xs text-gray-400">อัปเดตล่าสุด: {formatUpdatedAt(updatedAt)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={resetDefaults} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            ค่าเริ่มต้น
          </Button>
          <Button type="button" className="bg-[#2748bf] hover:bg-[#153c85]" onClick={saveSettings} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            บันทึกกฎ
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {rules.map((rule) => (
          <Card key={rule.employmentType} className="border-gray-200">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[#153c85]">{rule.label}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {rule.paysAllHours ? 'คิดค่าสอนทุกชั่วโมง' : `คิดเฉพาะชั่วโมงที่เกิน ${rule.thresholdHours} ชม./สัปดาห์`}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2748bf]/10 text-[#2748bf]">
                  <Clock className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>{rule.paysAllHours ? 'เกณฑ์ชั่วโมง' : 'เกินกี่ชั่วโมง/สัปดาห์'}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    step={0.5}
                    value={rule.thresholdHours}
                    onChange={(event) => updateRule(rule.employmentType, 'thresholdHours', event.target.value)}
                    disabled={rule.paysAllHours}
                  />
                  {rule.paysAllHours && <p className="text-xs text-gray-400">Part-Time คิดทุกชั่วโมง จึงไม่ใช้เกณฑ์ OT</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5 rounded-lg bg-orange-50 p-3">
                    <Label className="text-xs text-gray-500">Private / ชม.</Label>
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={rule.privateRate}
                      onChange={(event) => updateRule(rule.employmentType, 'privateRate', event.target.value)}
                    />
                    <p className="text-xs font-semibold text-orange-600">฿{formatCurrency(rule.privateRate)}</p>
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-blue-50 p-3">
                    <Label className="text-xs text-gray-500">กลุ่ม / ชม.</Label>
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={rule.groupRate}
                      onChange={(event) => updateRule(rule.employmentType, 'groupRate', event.target.value)}
                    />
                    <p className="text-xs font-semibold text-blue-600">฿{formatCurrency(rule.groupRate)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-800">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">หมายเหตุ</p>
            <p className="mt-1">
              ค่านี้จะถูกใช้กับการคำนวณรายสัปดาห์ครั้งใหม่ทันที ส่วนสรุปสัปดาห์ที่ปิดไปแล้วจะเก็บ snapshot เรทเดิมไว้
              เพื่อให้ยอดย้อนหลังไม่เปลี่ยนเอง
            </p>
          </div>
        </CardContent>
      </Card>

      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
        สรุปรายสัปดาห์
      </Badge>
    </div>
  )
}
