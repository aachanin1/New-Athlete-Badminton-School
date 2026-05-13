import Image from 'next/image'
import { Medal, Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getLevelDisplay } from '@/constants/levels'
import { getServiceRoleClient } from '@/lib/auth/admin'

interface BookingRankingRow {
  id: string
  user_id: string
  learner_type: 'self' | 'child'
  child_id: string | null
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  branches: {
    name: string | null
  } | null
}

interface ChildRankingRow {
  id: string
  parent_id: string
  full_name: string
  nickname: string | null
  avatar_url: string | null
  created_at: string
}

interface ParentProfileRow {
  id: string
  avatar_url: string | null
}

interface StudentLevelRow {
  student_id: string
  student_type: 'adult' | 'child'
  level: number
  notes: string | null
  created_at: string
  profiles: {
    full_name: string | null
  } | null
}

interface RankingStudent {
  id: string
  type: 'kid' | 'adult'
  name: string
  branchName: string | null
  avatarUrl: string | null
  level: number
  levelUpdatedAt: string | null
  evaluatedBy: string | null
  notes: string | null
}

function getInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

function formatDate(date: string | null) {
  if (!date) return 'ยังไม่ได้ประเมิน'
  return new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function getRankClass(index: number) {
  if (index === 0) return 'bg-amber-100 text-amber-700'
  if (index === 1) return 'bg-slate-100 text-slate-700'
  if (index === 2) return 'bg-orange-100 text-orange-700'
  return 'bg-blue-50 text-[#2748bf]'
}

function sortRanking(students: RankingStudent[]) {
  return students.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    if (a.levelUpdatedAt && b.levelUpdatedAt) return new Date(b.levelUpdatedAt).getTime() - new Date(a.levelUpdatedAt).getTime()
    if (a.levelUpdatedAt) return -1
    if (b.levelUpdatedAt) return 1
    return a.name.localeCompare(b.name, 'th')
  })
}

function getLatestLevelMap(levels: StudentLevelRow[]) {
  const latestLevels = new Map<string, StudentLevelRow>()
  for (const level of levels) {
    if (!latestLevels.has(level.student_id)) latestLevels.set(level.student_id, level)
  }
  return latestLevels
}

function getLatestBookingMap(bookings: BookingRankingRow[]) {
  const latestBookings = new Map<string, BookingRankingRow>()
  for (const booking of bookings) {
    const studentId = booking.learner_type === 'child' && booking.child_id ? booking.child_id : booking.user_id
    if (!latestBookings.has(studentId)) latestBookings.set(studentId, booking)
  }
  return latestBookings
}

function buildKids(
  children: ChildRankingRow[],
  levels: StudentLevelRow[],
  bookings: BookingRankingRow[],
  parentProfiles: ParentProfileRow[],
) {
  const latestLevels = getLatestLevelMap(levels)
  const latestBookings = getLatestBookingMap(bookings)
  const parentAvatarById = new Map(parentProfiles.map((profile) => [profile.id, profile.avatar_url]))

  return sortRanking(children.map((child) => {
    const latestLevel = latestLevels.get(child.id)
    const latestBooking = latestBookings.get(child.id)

    return {
      id: child.id,
      type: 'kid' as const,
      name: child.nickname ? `${child.full_name} (${child.nickname})` : child.full_name,
      branchName: latestBooking?.branches?.name || null,
      avatarUrl: child.avatar_url || parentAvatarById.get(child.parent_id) || null,
      level: latestLevel?.level ?? 0,
      levelUpdatedAt: latestLevel?.created_at || null,
      evaluatedBy: latestLevel?.profiles?.full_name || null,
      notes: latestLevel?.notes || null,
    }
  }))
}

function buildAdults(bookings: BookingRankingRow[], levels: StudentLevelRow[]) {
  const latestLevels = getLatestLevelMap(levels)
  const adults = new Map<string, RankingStudent>()

  for (const booking of bookings) {
    if (booking.learner_type !== 'self' || adults.has(booking.user_id)) continue

    const latestLevel = latestLevels.get(booking.user_id)
    adults.set(booking.user_id, {
      id: booking.user_id,
      type: 'adult',
      name: booking.profiles?.full_name || 'นักเรียน',
      branchName: booking.branches?.name || null,
      avatarUrl: booking.profiles?.avatar_url || null,
      level: latestLevel?.level ?? 0,
      levelUpdatedAt: latestLevel?.created_at || null,
      evaluatedBy: latestLevel?.profiles?.full_name || null,
      notes: latestLevel?.notes || null,
    })
  }

  return sortRanking(Array.from(adults.values()))
}

function RankingList({ students }: { students: RankingStudent[] }) {
  if (students.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Trophy className="mx-auto mb-4 h-16 w-16 opacity-30" />
        <p className="text-lg">ยังไม่มีข้อมูลอันดับ</p>
        <p className="mt-1 text-sm">ข้อมูลจะแสดงหลังมีผู้เรียนในระบบ</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {students.map((student, index) => {
        const levelInfo = getLevelDisplay(student.level)

        return (
          <div key={student.id} className="grid gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-[72px_minmax(260px,1fr)_180px] md:items-center">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${getRankClass(index)}`}>
                #{index + 1}
              </div>
              <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#153c85]/10 text-sm font-bold text-[#153c85]">
                {student.avatarUrl ? (
                  <Image
                    src={student.avatarUrl}
                    alt={student.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  getInitials(student.name)
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#153c85]">{student.name}</p>
                <Badge className={levelInfo.color}>{levelInfo.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {student.branchName && <span>{student.branchName}</span>}
                <span>ประเมินล่าสุด: {formatDate(student.levelUpdatedAt)}</span>
                {student.evaluatedBy && <span>โดย {student.evaluatedBy}</span>}
              </div>
              {student.notes && <p className="mt-1 line-clamp-1 text-xs text-gray-400">{student.notes}</p>}
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
              <p className="text-xs text-gray-500">Level</p>
              <p className="text-3xl font-bold text-[#2748bf]">{levelInfo.level}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export async function RankingContent() {
  const supabase = getServiceRoleClient()

  const [{ data: children }, { data: bookings }] = await Promise.all([
    supabase
      .from('children')
      .select('id, parent_id, full_name, nickname, avatar_url, created_at')
      .order('created_at', { ascending: true }) as unknown as PromiseLike<{ data: ChildRankingRow[] | null }>,
    supabase
      .from('bookings')
      .select('id, user_id, learner_type, child_id, created_at, profiles!bookings_user_id_fkey(id, full_name, avatar_url), branches(name)')
      .in('status', ['paid', 'verified'])
      .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: BookingRankingRow[] | null }>,
  ])

  const parentIds = Array.from(new Set((children || []).map((child) => child.parent_id)))
  let parentProfiles: ParentProfileRow[] = []
  if (parentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', parentIds) as unknown as { data: ParentProfileRow[] | null }
    parentProfiles = profiles || []
  }

  const adultStudentIds = (bookings || [])
    .filter((booking) => booking.learner_type === 'self')
    .map((booking) => booking.user_id)
  const childStudentIds = (children || []).map((child) => child.id)
  const studentIds = Array.from(new Set([...childStudentIds, ...adultStudentIds]))

  let levelRows: StudentLevelRow[] = []
  if (studentIds.length > 0) {
    const { data: levels } = await supabase
      .from('student_levels')
      .select('student_id, student_type, level, notes, created_at, profiles!student_levels_updated_by_fkey(full_name)')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false }) as unknown as { data: StudentLevelRow[] | null }
    levelRows = levels || []
  }

  const kids = buildKids(children || [], levelRows, bookings || [], parentProfiles)
  const adults = buildAdults(bookings || [], levelRows)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f57e3b]/10">
            <Trophy className="h-8 w-8 text-[#f57e3b]" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-[#153c85]">อันดับนักเรียน</h1>
        <p className="mt-2 text-gray-500">Ranking ของนักเรียน New Athlete School ทุกสาขา จาก Level ล่าสุดที่ Coach ประเมิน</p>
      </div>

      <Tabs defaultValue="kids" className="mx-auto max-w-4xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kids">เด็ก ({kids.length})</TabsTrigger>
          <TabsTrigger value="adults">ผู้ใหญ่ ({adults.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="kids">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Medal className="h-5 w-5 text-[#f57e3b]" />
                อันดับนักเรียน (เด็ก)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankingList students={kids} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adults">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Medal className="h-5 w-5 text-[#2748bf]" />
                อันดับนักเรียน (ผู้ใหญ่)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankingList students={adults} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
