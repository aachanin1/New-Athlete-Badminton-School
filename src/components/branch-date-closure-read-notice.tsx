'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function BranchDateClosureReadNotice() {
  const router = useRouter(), [pending, startTransition] = useTransition()
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <p>ยังตรวจสอบวันเปิดสาขาไม่ได้ จึงยังเลือกวัน/รอบใหม่ไม่ได้ รายการเดิมยังดูได้ตามปกติ</p>
    <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'กำลังอ่านใหม่...' : 'ลองอ่านใหม่'}</Button>
  </div>
}
