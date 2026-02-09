import { PublicNavbar } from '@/components/layout/public-navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Medal } from 'lucide-react'

export default function RankingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#f57e3b]/10 rounded-full flex items-center justify-center">
              <Trophy className="h-8 w-8 text-[#f57e3b]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#153c85]">อันดับนักเรียน</h1>
          <p className="text-gray-500 mt-2">Ranking ของนักเรียน New Athlete School ทุกสาขา</p>
        </div>

        <Tabs defaultValue="kids" className="max-w-3xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kids">🏸 เด็ก</TabsTrigger>
            <TabsTrigger value="adults">💪 ผู้ใหญ่</TabsTrigger>
          </TabsList>

          <TabsContent value="kids">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="h-5 w-5 text-[#f57e3b]" />
                  อันดับนักเรียน (เด็ก)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-400">
                  <Trophy className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">ยังไม่มีข้อมูลอันดับ</p>
                  <p className="text-sm mt-1">ข้อมูลจะแสดงเมื่อมีนักเรียนในระบบ</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adults">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="h-5 w-5 text-[#2748bf]" />
                  อันดับนักเรียน (ผู้ใหญ่)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-400">
                  <Trophy className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">ยังไม่มีข้อมูลอันดับ</p>
                  <p className="text-sm mt-1">ข้อมูลจะแสดงเมื่อมีนักเรียนในระบบ</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
