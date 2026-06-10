export type LearnerColor = {
  badge: string
  dot: string
}

export const LEARNER_COLORS: LearnerColor[] = [
  { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { badge: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  { badge: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
]

export const SELF_LEARNER_COLOR: LearnerColor = {
  badge: 'bg-blue-100 text-blue-700 border-blue-200',
  dot: 'bg-blue-500',
}

export function buildLearnerColorMap<T extends { id: string }>(learners: T[]) {
  const map: Record<string, LearnerColor> = {}

  learners.forEach((learner, index) => {
    map[learner.id] = LEARNER_COLORS[index % LEARNER_COLORS.length]
  })

  return map
}

export function getLearnerColor(childId: string | null | undefined, childColorMap: Record<string, LearnerColor>) {
  if (childId && childColorMap[childId]) return childColorMap[childId]
  return SELF_LEARNER_COLOR
}
