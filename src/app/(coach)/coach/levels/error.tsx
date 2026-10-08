'use client'

import { Button } from '@/components/ui/button'

export default function LevelsError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-5">
      <h1 className="font-semibold text-red-800">โหลดข้อมูลสำหรับประเมิน Level ไม่สำเร็จ</h1>
      <p className="text-sm text-gray-700">ยังไม่สามารถตรวจสอบรายชื่อผู้เรียนและ Level ได้ กรุณาลองโหลดข้อมูลอีกครั้ง</p>
      <Button type="button" onClick={() => retry()}>ลองโหลดอีกครั้ง</Button>
    </div>
  )
}
