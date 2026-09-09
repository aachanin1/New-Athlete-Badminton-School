import type { ProgressivePricingTier } from '@/lib/progressive-booking-pricing'
import type { PricingTierInput } from '@/lib/pricing'
import { callTask10, Task10Error, type KidsPricingRegime, type Task10RpcClient } from '@/lib/task10-policy'

export interface KidsRateTier {
  id: string | null
  minSessions: number
  maxSessions: number | null
  ratePerSession: number
}

export interface KidsRateCatalog {
  versionId: string
  regime: KidsPricingRegime
  revision: number
  hash: string
  tiers: KidsRateTier[]
}

export interface BookingPricingPolicyEvidence {
  activationRevision: number
  createdAt: string
  bangkokDate: string
  lessonMonth: string
  formula: 'legacy' | 'progressive'
  catalog: KidsRateCatalog
  calculationRevision: number
  fingerprint: string
}

export interface BookingPricingPolicyQuote {
  kind: 'booking_catalog' | 'legacy_compatibility'
  activationRevision: number
  serverTime: string
  bangkokDate: string
  lessonMonth: string
  formula: 'legacy' | 'progressive'
  catalog: KidsRateCatalog | null
  calculationRevision: number
  fingerprint: string
}

export function loadBookingPricingPolicy(client: Task10RpcClient, input: {
  userId: string; courseTypeId: string; month: number; year: number; formula: 'legacy' | 'progressive'; bookingId?: string | null
}) {
  return callTask10<BookingPricingPolicyQuote>(client, 'task10_booking_policy_quote_v1', {
    p_user_id: input.userId, p_course_type_id: input.courseTypeId,
    p_lesson_month: `${input.year}-${String(input.month).padStart(2, '0')}-01`,
    p_formula: input.formula, p_booking_id: input.bookingId || null,
  })
}

export const INITIAL_LATE_KIDS_TIERS: readonly KidsRateTier[] = [
  { id: null, minSessions: 1, maxSessions: 1, ratePerSession: 700 },
  { id: null, minSessions: 2, maxSessions: 3, ratePerSession: 625 },
  { id: null, minSessions: 4, maxSessions: 5, ratePerSession: 500 },
  { id: null, minSessions: 6, maxSessions: 7, ratePerSession: 433 },
  { id: null, minSessions: 8, maxSessions: 9, ratePerSession: 406 },
  { id: null, minSessions: 10, maxSessions: null, ratePerSession: 350 },
]

export function validateKidsTierSet(value: unknown): KidsRateTier[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Task10Error('TASK10_INVALID_REQUEST', 'ต้องมีชุดราคาครบทุกช่วง', 400)
  }
  const tiers: KidsRateTier[] = value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Task10Error('TASK10_INVALID_REQUEST', 'ข้อมูลราคาไม่ถูกต้อง', 400)
    const row = raw as Record<string, unknown>
    if (!Number.isSafeInteger(row.minSessions) || Number(row.minSessions) < 1
      || (row.maxSessions !== null && (!Number.isSafeInteger(row.maxSessions) || Number(row.maxSessions) < Number(row.minSessions)))
      || typeof row.ratePerSession !== 'number' || !Number.isFinite(row.ratePerSession) || row.ratePerSession < 0
      || Math.abs(row.ratePerSession * 100 - Math.round(row.ratePerSession * 100)) > 0.000001) {
      throw new Task10Error('TASK10_INVALID_REQUEST', 'ช่วงจำนวนหรือราคาไม่ถูกต้อง', 400)
    }
    return { id: typeof row.id === 'string' ? row.id : null,
      minSessions: Number(row.minSessions), maxSessions: row.maxSessions === null ? null : Number(row.maxSessions),
      ratePerSession: row.ratePerSession }
  }).sort((a, b) => a.minSessions - b.minSessions)
  let expected = 1
  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i]
    if (tier.minSessions !== expected || (tier.maxSessions === null && i !== tiers.length - 1)) {
      throw new Task10Error('TASK10_INVALID_REQUEST', 'ช่วงราคาต้องต่อเนื่องและไม่ทับซ้อน', 400)
    }
    expected = (tier.maxSessions ?? tier.minSessions) + 1
  }
  if (tiers[tiers.length - 1].maxSessions !== null) {
    throw new Task10Error('TASK10_INVALID_REQUEST', 'ช่วงราคาสุดท้ายต้องรองรับจำนวนไม่จำกัด', 400)
  }
  return tiers
}

export function progressiveTiersFromPolicy(catalog: KidsRateCatalog): ProgressivePricingTier[] {
  return validateKidsTierSet(catalog.tiers).map((tier) => ({ ...tier, packagePrice: null }))
}

export function legacyTiersFromPolicy(catalog: KidsRateCatalog): PricingTierInput[] {
  return validateKidsTierSet(catalog.tiers).map((tier) => ({
    id: tier.id || undefined, course_type_name: 'kids_group', min_sessions: tier.minSessions,
    max_sessions: tier.maxSessions, price_per_session: tier.ratePerSession,
    package_price: tier.minSessions * tier.ratePerSession,
  }))
}

// Both pricing settings entries call this loader; no privileged client import.
export async function loadKidsPricingCatalogs(client: Task10RpcClient, actorId: string) {
  return callTask10<{ early: KidsRateCatalog | null; late: KidsRateCatalog; active: boolean }>(
    client, 'task10_read_pricing_catalogs_v1', { p_actor_id: actorId },
  )
}
