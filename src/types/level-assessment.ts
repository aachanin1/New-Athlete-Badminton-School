export interface LevelAssessment {
  id: string
  level: number
  notes: string | null
  createdAt: string
  evaluatedBy: string | null
}

export interface LevelAssessmentPage {
  items: LevelAssessment[]
  nextCursor: string | null
}
