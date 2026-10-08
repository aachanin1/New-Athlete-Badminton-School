import { LevelsClient } from '@/components/coach/levels-client'
import { getCoachVisibleStudents } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'
import type { LevelCategory } from '@/types/database'
import { createCompleteCoachStudentReadClient } from '@/lib/coach-student-reads'
import { toLevelAssessment, type AssessmentRow } from '@/lib/student-level-history'
import type { LevelAssessment } from '@/types/level-assessment'

interface StudentLevelRow {
  id: string
  student_id: string
  student_type: 'adult' | 'child'
  level: number
  created_at: string
}

interface StudentAchievementRow {
  id: string
  student_id: string
  student_type: 'adult' | 'child'
  emoji: string
  title: string
  description: string | null
  awarded_at: string | null
}

interface LevelRow {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean
}

function getStudentKey(type: 'adult' | 'child', id: string) {
  return `${type}:${id}`
}

export default async function LevelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const studentList = await getCoachVisibleStudents(supabase, user)
  const readClient = createCompleteCoachStudentReadClient(supabase)
  const allStudentIds = studentList.map((student) => student.id)
  const levelMap: Record<string, StudentLevelRow> = {}
  const assessmentMap: Record<string, LevelAssessment> = {}
  const achievementMap: Record<string, StudentAchievementRow[]> = {}

  if (allStudentIds.length > 0) {
    const [{ data: levels }, { data: achievements }] = await Promise.all([
      readClient
        .from('student_levels')
        .select('id, student_id, student_type, level, created_at')
        .in('student_id', allStudentIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) as unknown as PromiseLike<{ data: StudentLevelRow[] | null }>,
      readClient
        .from('student_achievements')
        .select('id, student_id, student_type, emoji, title, description, awarded_at, is_active')
        .in('student_id', allStudentIds)
        .eq('is_active', true)
        .order('awarded_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: StudentAchievementRow[] | null }>,
    ])

    ;(levels || []).forEach((level) => {
      const key = getStudentKey(level.student_type, level.student_id)
      if (!levelMap[key]) {
        levelMap[key] = level
      }
    })

    const latestIds = Object.values(levelMap).map((assessment) => assessment.id)
    if (latestIds.length > 0) {
      const { data: latest } = await readClient.from('student_levels')
        .select('id, level, notes, created_at, profiles!student_levels_updated_by_fkey(full_name)')
        .in('id', latestIds) as unknown as { data: AssessmentRow[] | null }
      for (const assessment of latest || []) assessmentMap[assessment.id] = toLevelAssessment(assessment)
      if (latestIds.some((id) => !assessmentMap[id])) throw new Error('Latest assessment details unavailable')
    }

    ;(achievements || []).forEach((achievement) => {
      const key = getStudentKey(achievement.student_type, achievement.student_id)
      achievementMap[key] = achievementMap[key] || []
      achievementMap[key].push(achievement)
    })
  }

  const { data: levels } = await readClient
    .from('levels')
    .select('id, name, description, category, program_name, requirements, is_active')
    .eq('is_active', true)
    .order('id', { ascending: true }) as unknown as { data: LevelRow[] | null }

  const students = studentList.map((student) => {
    const key = getStudentKey(student.type, student.id)
    return {
      ...student,
      currentLevel: levelMap[key]?.level ?? 0,
      lastUpdated: levelMap[key]?.created_at || null,
      latestAssessment: levelMap[key] ? assessmentMap[levelMap[key].id] || null : null,
      achievements: (achievementMap[key] || []).map((achievement) => ({
        id: achievement.id,
        emoji: achievement.emoji,
        title: achievement.title,
        description: achievement.description,
        awardedAt: achievement.awarded_at,
      })),
    }
  })

  students.sort((a, b) => {
    if (!a.currentLevel && b.currentLevel) return -1
    if (a.currentLevel && !b.currentLevel) return 1
    return (b.currentLevel || 0) - (a.currentLevel || 0)
  })

  return <LevelsClient students={students} levels={levels || []} />
}
