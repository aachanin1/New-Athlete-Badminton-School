import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, TrendingUp, CreditCard, Bell } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">หน้าหลัก</h1>
        <p className="text-gray-500 text-sm mt-1">ยินดีต้อนรับสู่ระบบ New Athlete School</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">คอร์สเรียนเดือนนี้</CardTitle>
            <CalendarDays className="h-4 w-4 text-[#2748bf]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 ครั้ง</div>
            <p className="text-xs text-gray-400 mt-1">ยังไม่มีการจอง</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Level ปัจจุบัน</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#f57e3b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-gray-400 mt-1">ยังไม่มีข้อมูล</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">ยอดค้างชำระ</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿0</div>
            <p className="text-xs text-gray-400 mt-1">ไม่มียอดค้างชำระ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">แจ้งเตือน</CardTitle>
            <Bell className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-400 mt-1">ไม่มีแจ้งเตือนใหม่</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตารางเรียนที่กำลังจะถึง</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>ยังไม่มีตารางเรียน</p>
            <p className="text-sm mt-1">จองคอร์สเรียนเพื่อเริ่มต้น</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
