import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Trophy, User } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const LEVEL_CATEGORIES: Record<string, { label: string; color: string }> = {
  basic: { label: 'ชุดพื้นฐาน', color: 'bg-blue-100 text-blue-700' },
  athlete_1: { label: 'ชุดนักกีฬา 1', color: 'bg-orange-100 text-orange-700' },
  athlete_2: { label: 'ชุดนักกีฬา 2', color: 'bg-purple-100 text-purple-700' },
  athlete_3: { label: 'ชุดนักกีฬา 3', color: 'bg-red-100 text-red-700' },
}

function getLevelCategory(lv: number) {
  if (lv <= 30) return 'basic'
  if (lv <= 39) return 'athlete_1'
  if (lv <= 43) return 'athlete_2'
  return 'athlete_3'
}

export default async function ProgressPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch student levels for user and their children
  const { data: children } = await (supabase
    .from('children') as any)
    .select('id, full_name, nickname')
    .eq('parent_id', user.id) as { data: { id: string; full_name: string; nickname: string | null }[] | null }

  const studentIds = [user.id, ...(children?.map(c => c.id) || [])]

  const { data: levels } = await (supabase
    .from('student_levels') as any)
    .select('*')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  // Get latest level per student
  const latestLevels: Record<string, any> = {}
  for (const lv of (levels || [])) {
    if (!latestLevels[lv.student_id]) {
      latestLevels[lv.student_id] = lv
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">พัฒนาการ & Ranking</h1>
          <p className="text-gray-500 text-sm mt-1">ดู Level และอันดับของคุณ</p>
        </div>
        <Link href="/ranking">
          <Button variant="outline" className="border-[#2748bf]/30 text-[#2748bf]">
            <Trophy className="h-4 w-4 mr-2" />
            ดู Ranking ทั้งหมด
          </Button>
        </Link>
      </div>

      {Object.keys(latestLevels).length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-gray-400">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ยังไม่มีข้อมูล Level</p>
              <p className="text-sm mt-1">Level จะถูกอัปเดตโดยโค้ชหลังจากเรียน</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User's own level */}
          {latestLevels[user.id] && (() => {
            const lv = latestLevels[user.id]
            const cat = getLevelCategory(lv.level)
            const catInfo = LEVEL_CATEGORIES[cat]
            return (
              <Card key={user.id} className="border-2 border-[#2748bf]/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-[#2748bf]/10 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-[#2748bf]" />
                    </div>
                    <div>
                      <p className="font-bold">ตัวเอง</p>
                      <Badge className={catInfo.color}>{catInfo.label}</Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#2748bf]">LV {lv.level}</p>
                    {lv.notes && <p className="text-sm text-gray-500 mt-2">{lv.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Children levels */}
          {children?.map((child) => {
            const lv = latestLevels[child.id]
            if (!lv) return null
            const cat = getLevelCategory(lv.level)
            const catInfo = LEVEL_CATEGORIES[cat]
            return (
              <Card key={child.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-[#f57e3b]/10 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-[#f57e3b]" />
                    </div>
                    <div>
                      <p className="font-bold">{child.full_name}</p>
                      <Badge className={catInfo.color}>{catInfo.label}</Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#2748bf]">LV {lv.level}</p>
                    {lv.notes && <p className="text-sm text-gray-500 mt-2">{lv.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
