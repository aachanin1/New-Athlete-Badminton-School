import type { KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
export interface MakeupLearner { id: string; childId?: string | null; name: string }
export interface MakeupSource { sourceSessionId: string; sourceDate: string; kind: 'wallet' | 'absent'; creditId: string | null; sourceChildId?: string | null; expiresAt?: string; durationMinutes?: number }
export interface MakeupWorkspaceCard {
  reference: string; bookingId: string; parentId: string; parentName: string; month: string
  course: 'kids_group' | 'adult_group' | 'private'; branchIds: string[]; durationMinutes: number
  learners: MakeupLearner[]; sources: MakeupSource[]; family: KidsFamilyMakeupState | null; additionalAvailable: boolean
  destinations: Array<{ id: string; date: string; startTime: string; endTime: string; branchName: string; childName: string; childId: string | null; additional: boolean; grantId?: string; cancelled?: boolean }>
}
export interface MakeupBusy { date: string; start: string; end: string; childId: string | null; cancelled?: boolean }
export function makeupCardDestinations(card: MakeupWorkspaceCard) {
  if (card.course !== 'private') return card.destinations
  const units = new Map<string, MakeupWorkspaceCard['destinations'][number]>()
  for (const destination of card.destinations) {
    const key = destination.additional && destination.grantId ? destination.grantId : destination.id
    const unit = units.get(key)
    if (unit) unit.childName += ' · ' + destination.childName
    else units.set(key, { ...destination })
  }
  return [...units.values()]
}
export function makeupOverlap(busy: MakeupBusy[], date: string, start: string, end: string) {
  const seconds = (time: string) => { const [h, m, s = '0'] = time.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(s) }
  return busy.some(item => item.date === date && seconds(item.start) < seconds(end) && seconds(item.end) > seconds(start))
}
