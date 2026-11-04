import type { KidsFamilyMakeupState } from './kids-family-makeup'

export interface WalletRules {
  version: string
  bands: Array<{ min: number; max: number | null; quota: number }>
}
export type WalletActor = 'parent' | 'admin' | 'unknown'
export interface WalletHistoryRow {
  hourTotal?: number
  hourUsed?: number
  hourRemaining?: number
  id: string
  kind: 'wallet' | 'package'
  participants: Array<string | null>
  status: 'stored' | 'redeemed' | 'normal_expired' | 'expired'
  at: string
  originalDate?: string
  originalStart?: string
  originalEnd?: string
  storedAt: string | null
  usedAt: string | null
  expiresAt: string
  storedBy: WalletActor
  usedBy: WalletActor
  destinations: Array<{date: string; start: string; end: string; childId: string | null; branchName: string; cancelled: boolean}>
}
export interface WalletHistoryPage {
  month: string
  course: string
  rows: WalletHistoryRow[]
  nextOffset: number | null
}
export const walletActorLabel = (actor: WalletActor, operation: 'store' | 'use') => actor === 'admin'
  ? operation === 'store' ? 'แอดมินเก็บให้' : 'แอดมินใช้สิทธิให้'
  : actor === 'parent' ? operation === 'store' ? 'ผู้ปกครองเก็บ' : 'ผู้ปกครองใช้สิทธิ' : 'ไม่พบข้อมูลผู้ดำเนินการ'
export const walletSelfUseCount = (state: KidsFamilyMakeupState) => state.eligible ? Math.min(state.remaining, state.sources.length) : 0
