import { Trophy } from 'lucide-react'
import { unstable_noStore as noStore } from 'next/cache'

import { RankingBoard, type RankingAchievement, type RankingBranch, type RankingStudent } from '@/components/shared/ranking-board'
import { getServiceRoleClient } from '@/lib/auth/admin'
import type { LevelCategory } from '@/types/database'

interface RankingContentProps {
  mode?: 'public' | 'admin'
  enableSearch?: boolean
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

interface SessionBranchRankingRow {
  child_id: string | null
  branches: {
    id: string
    name: string | null
  } | null
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
  id: string
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

const CHILD_SESSION_BRANCH_STATUSES = ['scheduled', 'completed', 'absent'] as const
const IN_FILTER_CHUNK_SIZE = 100
const PAGE_SIZE = 1000

interface QueryError {
  message?: string
}

interface QueryRowsResult<T> {
  data: T[] | null
  error: QueryError | null
}

function getQueryErrorMessage(error: QueryError | null | undefined) {
  return error?.message || 'Unknown query error'
}

async function readAllRangePages<T>(
  label: string,
  buildQuery: (from: number, to: number) => PromiseLike<QueryRowsResult<T>>,
) {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildQuery(from, to)

    if (error) {
      throw new Error(`[ranking] ${label} read failed: ${getQueryErrorMessage(error)}`)
    }

    const pageRows = data || []
    rows.push(...pageRows)

    if (pageRows.length < PAGE_SIZE) break
  }

  return rows
}

async function readChunkedRangePages<T>(
  label: string,
  ids: string[],
  buildQuery: (idChunk: string[], from: number, to: number) => PromiseLike<QueryRowsResult<T>>,
) {
  const rows: T[] = []

  for (const [chunkIndex, idChunk] of chunkArray(ids, IN_FILTER_CHUNK_SIZE).entries()) {
    rows.push(...await readAllRangePages(
      `${label} chunk ${chunkIndex + 1}`,
      (from, to) => buildQuery(idChunk, from, to),
    ))
  }

  return rows
}

function dedupeRowsById<T extends { id: string | number }>(rows: T[]) {
  const rowMap = new Map<string | number, T>()
  rows.forEach((row) => rowMap.set(row.id, row))
  return Array.from(rowMap.values())
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
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

function addBranchToMap(map: Map<string, RankingBranch[]>, key: string, branch: RankingBranch) {
  const current = map.get(key) || []

  if (!current.some((item) => item.id === branch.id)) {
    current.push(branch)
  }

  map.set(key, current)
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

function buildSessionBranchMap(sessions: SessionBranchRankingRow[]) {
  const map = new Map<string, RankingBranch[]>()

  for (const session of sessions) {
    if (!session.child_id || !session.branches?.id) continue

    addBranchToMap(map, getStudentKey('child', session.child_id), {
      id: session.branches.id,
      name: session.branches.name || session.branches.id,
    })
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
  sessionBranches: SessionBranchRankingRow[],
  parentProfiles: ParentProfileRow[],
  achievements: StudentAchievementRow[],
) {
  const latestLevels = getLatestLevelMap(levels)
  const levelDefinitionMap = buildLevelDefinitionMap(levelDefinitions)
  const branchMap = buildBookingBranchMap(bookings)
  const sessionBranchMap = buildSessionBranchMap(sessionBranches)
  const achievementMap = buildAchievementMap(achievements)
  const parentAvatarById = new Map(parentProfiles.map((profile) => [profile.id, profile.avatar_url]))

  return sortRanking(children.map((child) => {
    const latestLevel = latestLevels.get(getStudentKey('child', child.id))
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null
    const key = getStudentKey('child', child.id)
    const branches = branchMap.get(key) || sessionBranchMap.get(key) || []

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

async function fetchSessionBranchFallbackRows(
  supabase: ReturnType<typeof getServiceRoleClient>,
  childIds: string[],
) {
  const rows: SessionBranchRankingRow[] = []

  for (const childIdChunk of chunkArray(childIds, IN_FILTER_CHUNK_SIZE)) {
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('booking_sessions')
        .select('child_id, branches(id, name)')
        .in('child_id', childIdChunk)
        .in('status', CHILD_SESSION_BRANCH_STATUSES)
        .not('branch_id', 'is', null)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .range(from, from + PAGE_SIZE - 1) as unknown as QueryRowsResult<SessionBranchRankingRow>

      if (error) {
        throw new Error(`[ranking] session branch fallback read failed: ${getQueryErrorMessage(error)}`)
      }

      const pageRows = data || []
      rows.push(...pageRows)

      if (pageRows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  return rows
}

export async function RankingContent({ mode = 'public', enableSearch = false }: RankingContentProps = {}) {
  noStore()
  const supabase = getServiceRoleClient()

  const [children, bookings, branches, levelDefinitions] = await Promise.all([
    readAllRangePages<ChildRankingRow>(
      'children',
      (from, to) => supabase
        .from('children')
        .select('id, parent_id, full_name, nickname, avatar_url, created_at')
        .order('created_at', { ascending: true })
        .range(from, to) as unknown as PromiseLike<QueryRowsResult<ChildRankingRow>>,
    ),
    readAllRangePages<BookingRankingRow>(
      'bookings',
      (from, to) => supabase
        .from('bookings')
        .select('id, user_id, learner_type, child_id, created_at, profiles!bookings_user_id_fkey(id, full_name, avatar_url), branches(id, name)')
        .in('status', ['paid', 'verified'])
        .order('created_at', { ascending: false })
        .range(from, to) as unknown as PromiseLike<QueryRowsResult<BookingRankingRow>>,
    ),
    readAllRangePages<RankingBranch>(
      'branches',
      (from, to) => supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .range(from, to) as unknown as PromiseLike<QueryRowsResult<RankingBranch>>,
    ),
    readAllRangePages<LevelDefinitionRow>(
      'levels',
      (from, to) => supabase
        .from('levels')
        .select('id, name, category, is_active')
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<QueryRowsResult<LevelDefinitionRow>>,
    ),
  ])

  const parentIds = Array.from(new Set(children.map((child) => child.parent_id)))
  let parentProfiles: ParentProfileRow[] = []
  if (parentIds.length > 0) {
    parentProfiles = dedupeRowsById(await readChunkedRangePages<ParentProfileRow>(
      'parent profiles',
      parentIds,
      (idChunk, from, to) => supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', idChunk)
        .range(from, to) as unknown as PromiseLike<QueryRowsResult<ParentProfileRow>>,
    ))
  }

  const adultStudentIds = bookings
    .filter((booking) => booking.learner_type === 'self')
    .map((booking) => booking.user_id)
  const childStudentIds = children.map((child) => child.id)
  const studentIds = Array.from(new Set([...childStudentIds, ...adultStudentIds]))

  const bookingBranchMap = buildBookingBranchMap(bookings)
  const childIdsMissingBookingBranch = children
    .filter((child) => !bookingBranchMap.has(getStudentKey('child', child.id)))
    .map((child) => child.id)
  const sessionBranchRows = childIdsMissingBookingBranch.length > 0
    ? await fetchSessionBranchFallbackRows(supabase, childIdsMissingBookingBranch)
    : []

  let levelRows: StudentLevelRow[] = []
  let achievementRows: StudentAchievementRow[] = []
  if (studentIds.length > 0) {
    const [levels, achievements] = await Promise.all([
      readChunkedRangePages<StudentLevelRow>(
        'student levels',
        studentIds,
        (idChunk, from, to) => supabase
          .from('student_levels')
          .select('id, student_id, student_type, level, notes, created_at, profiles!student_levels_updated_by_fkey(full_name)')
          .in('student_id', idChunk)
          .order('created_at', { ascending: false })
          .range(from, to) as unknown as PromiseLike<QueryRowsResult<StudentLevelRow>>,
      ),
      readChunkedRangePages<StudentAchievementRow>(
        'student achievements',
        studentIds,
        (idChunk, from, to) => supabase
          .from('student_achievements')
          .select('id, student_id, student_type, emoji, title, description, awarded_at, is_active')
          .in('student_id', idChunk)
          .eq('is_active', true)
          .order('awarded_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .range(from, to) as unknown as PromiseLike<QueryRowsResult<StudentAchievementRow>>,
      ),
    ])
    levelRows = dedupeRowsById(levels)
    achievementRows = dedupeRowsById(achievements)
  }

  const kids = buildKids(children, levelRows, levelDefinitions, bookings, sessionBranchRows, parentProfiles, achievementRows)
  const adults = buildAdults(bookings, levelRows, levelDefinitions, achievementRows)

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

      <RankingBoard kids={kids} adults={adults} branches={branches} canManageAchievements={mode === 'admin'} enableSearch={enableSearch} />
    </div>
  )
}
