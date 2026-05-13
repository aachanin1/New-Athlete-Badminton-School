import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getLevelDisplay } from '@/constants/levels'
import { createClient } from '@/lib/supabase/server'

interface ChildRow {
  id: string
  full_name: string
  nickname: string | null
}

interface StudentLevelRow {
  student_id: string
  level: number
  notes: string | null
  created_at: string
}

interface ProgressStudent {
  id: string
  name: string
  type: 'self' | 'child'
  level: number
  notes: string | null
}

export default async function ProgressPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: children } = await (supabase
    .from('children') as any)
    .select('id, full_name, nickname')
    .eq('parent_id', user.id) as { data: ChildRow[] | null }

  const studentIds = [user.id, ...(children?.map((child) => child.id) || [])]

  const { data: levels } = await (supabase
    .from('student_levels') as any)
    .select('student_id, level, notes, created_at')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false }) as { data: StudentLevelRow[] | null }

  const latestLevels: Record<string, StudentLevelRow> = {}
  for (const level of levels || []) {
    if (!latestLevels[level.student_id]) latestLevels[level.student_id] = level
  }

  const students: ProgressStudent[] = [
    {
      id: user.id,
      name: 'ตัวเอง',
      type: 'self',
      level: latestLevels[user.id]?.level ?? 0,
      notes: latestLevels[user.id]?.notes || null,
    },
    ...(children || []).map((child) => ({
      id: child.id,
      name: child.nickname ? `${child.full_name} (${child.nickname})` : child.full_name,
      type: 'child' as const,
      level: latestLevels[child.id]?.level ?? 0,
      notes: latestLevels[child.id]?.notes || null,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">พัฒนาการ & Ranking</h1>
          <p className="mt-1 text-sm text-gray-500">ดู Level ล่าสุดของผู้เรียน เริ่มต้นทุกคนที่ LV 0 จนกว่า Coach จะประเมิน</p>
        </div>
        <Link href="/ranking">
          <Button variant="outline" className="border-[#2748bf]/30 text-[#2748bf]">
            <Trophy className="mr-2 h-4 w-4" />
            ดู Ranking ทั้งหมด
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {students.map((student) => {
          const levelInfo = getLevelDisplay(student.level)

          return (
            <Card key={student.id} className={student.type === 'self' ? 'border-2 border-[#2748bf]/20' : ''}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${student.type === 'self' ? 'bg-[#2748bf]/10' : 'bg-[#f57e3b]/10'}`}>
                    <User className={`h-6 w-6 ${student.type === 'self' ? 'text-[#2748bf]' : 'text-[#f57e3b]'}`} />
                  </div>
                  <div>
                    <p className="font-bold">{student.name}</p>
                    <Badge className={levelInfo.color}>{levelInfo.label}</Badge>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-bold text-[#2748bf]">LV {levelInfo.level}</p>
                  {student.notes ? (
                    <p className="mt-2 text-sm text-gray-500">{student.notes}</p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-400">รอ Coach ประเมินหรืออัปเดต Level</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
