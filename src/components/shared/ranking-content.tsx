import { Trophy } from 'lucide-react'
import { unstable_noStore as noStore } from 'next/cache'

import { RankingBoard, type RankingAchievement, type RankingBranch, type RankingStudent } from '@/components/shared/ranking-board'
import { getServiceRoleClient } from '@/lib/auth/admin'
import type { LevelCategory } from '@/types/database'

interface RankingContentProps {
  mode?: 'public' | 'admin'
}

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
    id: string
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

interface LevelDefinitionRow {
  id: number
  name: string
  category: LevelCategory
  is_active: boolean
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

interface StudentAchievementRow {
  id: string
  student_id: string
  student_type: 'adult' | 'child'
  emoji: string
  title: string
  description: string | null
  awarded_at: string | null
  is_active: boolean
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

function getStudentKey(type: 'adult' | 'child', id: string) {
  return `${type}:${id}`
}

function getLatestLevelMap(levels: StudentLevelRow[]) {
  const latestLevels = new Map<string, StudentLevelRow>()
  for (const level of levels) {
    const key = getStudentKey(level.student_type, level.student_id)
    if (!latestLevels.has(key)) latestLevels.set(key, level)
  }
  return latestLevels
}

function buildLevelDefinitionMap(levels: LevelDefinitionRow[]) {
  return new Map(levels.map((level) => [level.id, level]))
}

function buildBookingBranchMap(bookings: BookingRankingRow[]) {
  const map = new Map<string, RankingBranch[]>()

  for (const booking of bookings) {
    if (!booking.branches?.id) continue

    const studentType = booking.learner_type === 'child' && booking.child_id ? 'child' : 'adult'
    const studentId = studentType === 'child' && booking.child_id ? booking.child_id : booking.user_id
    const key = getStudentKey(studentType, studentId)
    const current = map.get(key) || []

    if (!current.some((branch) => branch.id === booking.branches?.id)) {
      current.push({
        id: booking.branches.id,
        name: booking.branches.name || 'ไม่ทราบสาขา',
      })
    }

    map.set(key, current)
  }

  return map
}

function buildAchievementMap(achievements: StudentAchievementRow[]) {
  const map = new Map<string, RankingAchievement[]>()

  for (const achievement of achievements) {
    const key = getStudentKey(achievement.student_type, achievement.student_id)
    const current = map.get(key) || []
    current.push({
      id: achievement.id,
      emoji: achievement.emoji,
      title: achievement.title,
      description: achievement.description,
      awardedAt: achievement.awarded_at,
    })
    map.set(key, current)
  }

  return map
}

function buildKids(
  children: ChildRankingRow[],
  levels: StudentLevelRow[],
  levelDefinitions: LevelDefinitionRow[],
  bookings: BookingRankingRow[],
  parentProfiles: ParentProfileRow[],
  achievements: StudentAchievementRow[],
) {
  const latestLevels = getLatestLevelMap(levels)
  const levelDefinitionMap = buildLevelDefinitionMap(levelDefinitions)
  const branchMap = buildBookingBranchMap(bookings)
  const achievementMap = buildAchievementMap(achievements)
  const parentAvatarById = new Map(parentProfiles.map((profile) => [profile.id, profile.avatar_url]))

  return sortRanking(children.map((child) => {
    const latestLevel = latestLevels.get(getStudentKey('child', child.id))
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null
    const branches = branchMap.get(getStudentKey('child', child.id)) || []

    return {
      id: child.id,
      type: 'kid' as const,
      name: child.nickname ? `${child.full_name} (${child.nickname})` : child.full_name,
      branchIds: branches.map((branch) => branch.id),
      branchNames: branches.map((branch) => branch.name),
      avatarUrl: child.avatar_url || parentAvatarById.get(child.parent_id) || null,
      level: latestLevel?.level ?? 0,
      levelName: levelDefinition?.name || null,
      levelUpdatedAt: latestLevel?.created_at || null,
      evaluatedBy: latestLevel?.profiles?.full_name || null,
      notes: latestLevel?.notes || null,
      achievements: achievementMap.get(getStudentKey('child', child.id)) || [],
    }
  }))
}

function buildAdults(
  bookings: BookingRankingRow[],
  levels: StudentLevelRow[],
  levelDefinitions: LevelDefinitionRow[],
  achievements: StudentAchievementRow[],
) {
  const latestLevels = getLatestLevelMap(levels)
  const levelDefinitionMap = buildLevelDefinitionMap(levelDefinitions)
  const branchMap = buildBookingBranchMap(bookings)
  const achievementMap = buildAchievementMap(achievements)
  const adults = new Map<string, RankingStudent>()

  for (const booking of bookings) {
    if (booking.learner_type !== 'self' || adults.has(booking.user_id)) continue

    const latestLevel = latestLevels.get(getStudentKey('adult', booking.user_id))
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null
    const branches = branchMap.get(getStudentKey('adult', booking.user_id)) || []

    adults.set(booking.user_id, {
      id: booking.user_id,
      type: 'adult',
      name: booking.profiles?.full_name || 'นักเรียน',
      branchIds: branches.map((branch) => branch.id),
      branchNames: branches.map((branch) => branch.name),
      avatarUrl: booking.profiles?.avatar_url || null,
      level: latestLevel?.level ?? 0,
      levelName: levelDefinition?.name || null,
      levelUpdatedAt: latestLevel?.created_at || null,
      evaluatedBy: latestLevel?.profiles?.full_name || null,
      notes: latestLevel?.notes || null,
      achievements: achievementMap.get(getStudentKey('adult', booking.user_id)) || [],
    })
  }

  return sortRanking(Array.from(adults.values()))
}

export async function RankingContent({ mode = 'public' }: RankingContentProps = {}) {
  noStore()
  const supabase = getServiceRoleClient()

  const [{ data: children }, { data: bookings }, { data: branches }, { data: levelDefinitions }] = await Promise.all([
    supabase
      .from('children')
      .select('id, parent_id, full_name, nickname, avatar_url, created_at')
      .order('created_at', { ascending: true }) as unknown as PromiseLike<{ data: ChildRankingRow[] | null }>,
    supabase
      .from('bookings')
      .select('id, user_id, learner_type, child_id, created_at, profiles!bookings_user_id_fkey(id, full_name, avatar_url), branches(id, name)')
      .in('status', ['paid', 'verified'])
      .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: BookingRankingRow[] | null }>,
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: RankingBranch[] | null }>,
    supabase
      .from('levels')
      .select('id, name, category, is_active')
      .order('id', { ascending: true }) as unknown as PromiseLike<{ data: LevelDefinitionRow[] | null }>,
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
  let achievementRows: StudentAchievementRow[] = []
  if (studentIds.length > 0) {
    const [{ data: levels }, { data: achievements }] = await Promise.all([
      supabase
        .from('student_levels')
        .select('student_id, student_type, level, notes, created_at, profiles!student_levels_updated_by_fkey(full_name)')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: StudentLevelRow[] | null }>,
      supabase
        .from('student_achievements')
        .select('id, student_id, student_type, emoji, title, description, awarded_at, is_active')
        .in('student_id', studentIds)
        .eq('is_active', true)
        .order('awarded_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: StudentAchievementRow[] | null }>,
    ])
    levelRows = levels || []
    achievementRows = achievements || []
  }

  const kids = buildKids(children || [], levelRows, levelDefinitions || [], bookings || [], parentProfiles, achievementRows)
  const adults = buildAdults(bookings || [], levelRows, levelDefinitions || [], achievementRows)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f57e3b]/10">
            <Trophy className="h-8 w-8 text-[#f57e3b]" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-[#153c85]">อันดับนักเรียน</h1>
        <p className="mx-auto mt-2 max-w-2xl text-gray-500">
          Ranking ของนักเรียน New Athlete School ทุกสาขา จาก Level ล่าสุดที่ Coach ประเมิน พร้อมอันดับรวม NA และอันดับรายสาขา
        </p>
      </div>

      <RankingBoard kids={kids} adults={adults} branches={branches || []} canManageAchievements={mode === 'admin'} />
    </div>
  )
}
