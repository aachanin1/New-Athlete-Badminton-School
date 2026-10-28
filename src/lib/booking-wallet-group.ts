// Display grouping only. Every selection keeps its exact source ID for the
// existing atomic writer; bookings, credits and Family units are never merged.
export interface WalletGroupingSource {
  kind: 'wallet' | 'package'
  course: string
  participants: Array<string | null>
  expires: string
  policy: string
  groupId?:string
  originalMonth?: string
  makeup?: { sourceMonth: string; destinationMonth: string; eligible: boolean }
}
export function walletGroupKey(source: WalletGroupingSource) {
  if(source.groupId)return source.groupId
  return JSON.stringify([source.kind, source.course,
    source.participants.map(id => id ?? 'self').sort(),
    Date.parse(source.expires), source.policy, source.originalMonth || '',
    source.makeup?.eligible ? [source.makeup.sourceMonth, source.makeup.destinationMonth] : null])
}
