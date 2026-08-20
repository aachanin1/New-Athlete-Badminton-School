export type ScheduleStudentType = 'adult' | 'child'

export interface ScheduleStudentLevelRow {
  id?: string
  student_id: string
  student_type: ScheduleStudentType
  level: number
  created_at: string
}

export interface ScheduleLevelDefinition {
  id: number
  name: string
  is_active?: boolean
}

export interface ScheduleLevelDetails {
  level: number
  levelName: string | null
  label: string
}

export interface SafeScheduleProgram {
  id: string
  programContent: string
  updatedAt: string
}

export interface SafeScheduleProgramResponse {
  program: SafeScheduleProgram | null
}

export function getScheduleStudentKey(studentType: ScheduleStudentType, studentId: string) {
  return `${studentType}:${studentId}`
}

export function buildLatestScheduleStudentLevelMap(rows: ScheduleStudentLevelRow[]) {
  const latest = new Map<string, ScheduleStudentLevelRow>()

  rows.forEach((row) => {
    const key = getScheduleStudentKey(row.student_type, row.student_id)
    const current = latest.get(key)
    if (!current) {
      latest.set(key, row)
      return
    }

    const dateComparison = row.created_at.localeCompare(current.created_at)
    const idComparison = (row.id || '').localeCompare(current.id || '')
    if (dateComparison > 0 || (dateComparison === 0 && idComparison > 0)) {
      latest.set(key, row)
    }
  })

  return latest
}

export function buildActiveScheduleLevelNameMap(levels: ScheduleLevelDefinition[]) {
  return new Map(
    levels
      .filter((level) => level.is_active !== false)
      .map((level) => [level.id, level.name] as const),
  )
}

export function formatScheduleLevel(level: number, levelName: string | null) {
  if (level <= 0) return 'LV 0 / ยังไม่ประเมิน'
  return `LV ${level}${levelName ? ` · ${levelName}` : ''}`
}

export function getScheduleLevelDetails(
  studentType: ScheduleStudentType,
  studentId: string,
  latestLevels: Map<string, ScheduleStudentLevelRow>,
  activeLevelNames: Map<number, string>,
): ScheduleLevelDetails {
  const assessedLevel = latestLevels.get(getScheduleStudentKey(studentType, studentId))?.level ?? 0
  const levelName = assessedLevel > 0 ? activeLevelNames.get(assessedLevel) || null : null

  return {
    level: assessedLevel,
    levelName,
    label: formatScheduleLevel(assessedLevel, levelName),
  }
}

export function toSafeScheduleProgramResponse(program: {
  id: string
  program_content: string
  updated_at: string
} | null): SafeScheduleProgramResponse {
  return {
    program: program
      ? {
          id: program.id,
          programContent: program.program_content,
          updatedAt: program.updated_at,
        }
      : null,
  }
}
