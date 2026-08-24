export interface FamilyPrivateScheduleSession {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  branch_id: string
  date: string
  start_time: string
  end_time: string
  child_id: string | null
  bookings: {
    course_types: { name: string | null } | null
  } | null
}

export interface FamilyPrivateScheduleUnit<T extends FamilyPrivateScheduleSession> {
  key: string
  representative: T
  sessions: T[]
  isFamilyPrivate: boolean
  isConsistent: boolean
  participantCount: number
}

function familyPrivateUnitKey(session: FamilyPrivateScheduleSession) {
  return [
    session.booking_id,
    session.date,
    session.start_time,
    session.end_time,
    session.branch_id,
    session.schedule_slot_id || 'missing-slot',
  ].join('|')
}

function sortParticipantSessions<T extends FamilyPrivateScheduleSession>(sessions: T[]) {
  return sessions.slice().sort((left, right) => {
    if (left.child_id === null && right.child_id !== null) return -1
    if (left.child_id !== null && right.child_id === null) return 1
    return (left.child_id || '').localeCompare(right.child_id || '') || left.id.localeCompare(right.id)
  })
}

function buildUnit<T extends FamilyPrivateScheduleSession>(key: string, sessions: T[], isFamilyPrivate: boolean) {
  const orderedSessions = sortParticipantSessions(sessions)
  const identityKeys = new Set(orderedSessions.map((session) => session.child_id || 'self'))
  const representative = orderedSessions[0]
  const isConsistent = !isFamilyPrivate || Boolean(
    representative.schedule_slot_id
    && representative.branch_id
    && identityKeys.size === orderedSessions.length,
  )

  return {
    key,
    representative,
    sessions: orderedSessions,
    isFamilyPrivate,
    isConsistent,
    participantCount: orderedSessions.length,
  }
}

export function groupFamilyPrivateScheduleUnits<T extends FamilyPrivateScheduleSession>(sessions: T[]) {
  const unitMembers = new Map<string, T[]>()

  for (const session of sessions) {
    const isFamilyPrivate = session.bookings?.course_types?.name === 'private'
    const key = isFamilyPrivate ? `family:${familyPrivateUnitKey(session)}` : `session:${session.id}`
    const members = unitMembers.get(key) || []
    members.push(session)
    unitMembers.set(key, members)
  }

  return Array.from(unitMembers.entries()).map(([key, members]) => (
    buildUnit(key, members, key.startsWith('family:'))
  )).sort((left, right) => (
    left.representative.date.localeCompare(right.representative.date)
    || left.representative.start_time.localeCompare(right.representative.start_time)
    || left.key.localeCompare(right.key)
  ))
}
