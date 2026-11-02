'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function FinanceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6" role="alert">
        <h1 className="text-xl font-bold text-[#153c85]">โหลดรายรับ–รายจ่ายไม่สำเร็จ</h1>
        <p className="text-sm text-gray-600">ยังอ่านข้อมูลรายงานได้ไม่ครบ กรุณาลองใหม่เพื่อแสดงยอดที่ครบถ้วน</p>
        <Button onClick={retry}>ลองใหม่</Button>
      </CardContent>
    </Card>
  )
}
