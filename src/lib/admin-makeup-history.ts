import type { KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
export interface MakeupHistorySubject {
  parentId: string; childId?: string | null; month: string; course: string; title: string; reference?: string
}
export interface MakeupHistoryLesson {
  id: string; date: string; startTime: string; endTime: string; branchName: string; courseType?: string; isMakeup?: boolean; referenceOnly?: boolean
}
export interface MakeupHistoryEvent {
  id: string; kind: 'wallet' | 'absent' | 'use'; title: string; at: string | null; timeLabel: string
  learner: string; actor: string | null; reason: string | null; status: string; walletExpiresAt: string | null
  source: MakeupHistoryLesson; destination: MakeupHistoryLesson | null; participants: Array<{ childId: string | null; name: string }>
  walletQuantity?: number | null
}
export interface MakeupHistoryBalance {
  walletQuantity: number; walletSourceCount: number; absentSourceCount: number; unit: string
  sources: Array<{ creditId: string; date: string; startTime: string; endTime: string; branchName: string; quantity: number; expiresAt: string }>
}
export interface MakeupHistoryResult {
  items: MakeupHistoryEvent[]; total: number; counts: Record<'all' | 'wallet' | 'absent' | 'use', number>
  page: number; pageSize: number; summary?: KidsFamilyMakeupState | null
  historyScope: 'all_months'; balance: MakeupHistoryBalance | null
}
