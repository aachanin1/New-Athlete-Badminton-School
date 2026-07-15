export interface LearnerDisplayNameInput {
  fullName?: string | null
  nickname?: string | null
}

function cleanName(value?: string | null) {
  return value?.trim() || ''
}

export function formatLearnerDisplayName({ fullName, nickname }: LearnerDisplayNameInput) {
  const cleanFullName = cleanName(fullName)
  const cleanNickname = cleanName(nickname)

  if (!cleanFullName) return cleanNickname || 'ไม่ระบุชื่อผู้เรียน'
  if (!cleanNickname || cleanNickname.localeCompare(cleanFullName, undefined, { sensitivity: 'base' }) === 0) {
    return cleanFullName
  }
  return `${cleanNickname} - ${cleanFullName}`
}

export function joinLearnerDisplayNames(learners: LearnerDisplayNameInput[]) {
  return learners.map(formatLearnerDisplayName).join(', ')
}
