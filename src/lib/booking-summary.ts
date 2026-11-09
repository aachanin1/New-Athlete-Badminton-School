/** Display only: keep bill boundaries and prices outside this grouping. */
export function bookingSummaryRounds<T extends { branch_id: string; date: string; start_time: string; end_time: string; child_id: string | null }>(sessions: T[], family: boolean) {
  const rounds = new Map<string, { session: T; members: T[] }>()
  sessions.forEach((session, index) => {
    const key = family ? JSON.stringify([session.branch_id, session.date, session.start_time, session.end_time]) : String(index)
    const existing = rounds.get(key)
    if (existing) existing.members.push(session)
    else rounds.set(key, { session, members: [session] })
  })
  const branches = new Map<string, Array<{ session: T; members: T[] }>>()
  for (const round of rounds.values()) {
    const group = branches.get(round.session.branch_id) || []
    group.push(round)
    branches.set(round.session.branch_id, group)
  }
  for (const group of branches.values()) group.sort((a, b) => (a.session.date + a.session.start_time).localeCompare(b.session.date + b.session.start_time))
  return { count: rounds.size, branches }
}

/** Private quantity is elapsed hours of each Family round, never participant rows. */
export function bookingSummaryQuantity<T extends { branch_id: string; date: string; start_time: string; end_time: string; child_id: string | null }>(sessions: T[], family: boolean): number {
  const grouped = bookingSummaryRounds(sessions, family)
  if (!family) return grouped.count
  const minutes = (value: string) => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins }
  return [...grouped.branches.values()].flat().reduce((sum, { session }) => sum + (minutes(session.end_time) - minutes(session.start_time)) / 60, 0)
}
