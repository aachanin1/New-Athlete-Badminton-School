import type { KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
export interface MakeupHistorySubject {
  parentId: string; childId?: string | null; month: string; course: string; title: string
}
export interface MakeupHistoryLesson {
  id: string; date: string; startTime: string; endTime: string; branchName: string; courseType?: string; isMakeup?: boolean
}
export interface MakeupHistoryEvent {
  id: string; kind: 'wallet' | 'absent' | 'use'; title: string; at: string | null; timeLabel: string
  learner: string; actor: string | null; reason: string | null; status: string; walletExpiresAt: string | null
  source: MakeupHistoryLesson; destination: MakeupHistoryLesson | null; participants: Array<{ childId: string | null; name: string }>
}
export interface MakeupHistoryResult {
  items: MakeupHistoryEvent[]; total: number; counts: Record<'all' | 'wallet' | 'absent' | 'use', number>
  page: number; pageSize: number; summary?: KidsFamilyMakeupState | null
}
