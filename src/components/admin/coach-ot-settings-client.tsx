'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { COACH_EMPLOYMENT_OPTIONS } from '@/lib/coach-teaching-rules'
import { BriefcaseBusiness, Clock, Wallet } from 'lucide-react'

interface CoachOtSettingsClientProps {
  updatedAt: string | null
}

function formatCurrency(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

export function CoachOtSettingsClient({ updatedAt }: CoachOtSettingsClientProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <BriefcaseBusiness className="h-4 w-4" />
            Coach Teaching Rules
          </div>
          <h2 className="mt-1 text-2xl font-bold text-[#153c85]">กฎชั่วโมงสอนโค้ช</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            ใช้กับหน้า “คำนวณชั่วโมงสอน” โดยแยกจากสิทธิ์ Head Coach / Coach เดิม และไม่รวมเงินเดือนฐานของโค้ช
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
          สรุปรายสัปดาห์
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {COACH_EMPLOYMENT_OPTIONS.map((rule) => (
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

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-orange-50 p-3">
                  <p className="text-xs text-gray-500">Private</p>
                  <p className="mt-1 text-lg font-bold text-orange-600">฿{formatCurrency(rule.privateRate)}</p>
                  <p className="text-xs text-gray-500">ต่อชั่วโมง</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs text-gray-500">กลุ่ม</p>
                  <p className="mt-1 text-lg font-bold text-blue-600">฿{formatCurrency(rule.groupRate)}</p>
                  <p className="text-xs text-gray-500">ต่อชั่วโมง</p>
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
              ระบบนี้คำนวณเฉพาะชั่วโมงสอน/OT รายสัปดาห์ให้เจ้าของตรวจจ่าย ส่วนเงินเดือนฐานของโค้ชจ่ายแยกนอกระบบตาม requirement ใหม่
            </p>
            {updatedAt && <p className="mt-2 text-xs opacity-80">กฎเดิมแบบ single OT ยังถูกเก็บในระบบไว้เป็นข้อมูลเก่า แต่ไม่ใช้กับสูตรใหม่นี้</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
