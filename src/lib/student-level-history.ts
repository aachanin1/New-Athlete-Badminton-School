import type { LevelAssessment } from '@/types/level-assessment'

export interface AssessmentRow {
  id: string
  level: number
  notes: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

export const isAssessmentUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export function toLevelAssessment(row: AssessmentRow): LevelAssessment {
  return { id: row.id, level: row.level, notes: row.notes, createdAt: row.created_at, evaluatedBy: row.profiles?.full_name || null }
}

interface AssessmentCursor {
  studentId: string
  studentType: 'child' | 'adult'
  createdAt: string
  id: string
}

export function encodeAssessmentCursor(cursor: AssessmentCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeAssessmentCursor(value: string, studentId: string, studentType: string): AssessmentCursor | null {
  try {
    if (value.length > 700 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as AssessmentCursor
    if (cursor.studentId !== studentId || cursor.studentType !== studentType || typeof cursor.id !== 'string' || !isAssessmentUuid(cursor.id)) return null
    // Preserve Postgres microseconds; converting to Date/ISO here can skip rows.
    if (typeof cursor.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.createdAt) || !Number.isFinite(Date.parse(cursor.createdAt))) return null
    return cursor
  } catch {
    return null
  }
}
