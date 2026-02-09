// Pricing Engine for New Athlete Badminton School
// Handles kids group (monthly), adult group (package), and private pricing

export type CourseCategory = 'kids_group' | 'adult_group' | 'private'

// ─── Kids Group Pricing (รายเดือน, รีเซ็ตทุกเดือน) ─────────────
const KIDS_GROUP_TIERS = [
  { min: 1, max: 1, package_price: 700, per_session: 700 },
  { min: 2, max: 6, package_price: 2500, per_session: 625 },
  { min: 7, max: 10, package_price: 4000, per_session: 500 },
  { min: 11, max: 14, package_price: 5200, per_session: 433 },
  { min: 15, max: 18, package_price: 6500, per_session: 406 },
  { min: 19, max: null, package_price: 7000, per_session: 350 },
]

// ─── Adult Group Pricing (แพ็กเกจ) ───────────────────────────────
const ADULT_GROUP_TIERS = [
  { min: 1, max: 1, package_price: 600, per_session: 600, expiry_months: null },
  { min: 10, max: 10, package_price: 5500, per_session: 550, expiry_months: 10 },
  { min: 16, max: 16, package_price: 8000, per_session: 500, expiry_months: 10 },
]

// ─── Private Pricing ─────────────────────────────────────────────
const PRIVATE_TIERS = [
  { min: 1, max: 1, package_price: 900, per_hour: 900 },
  { min: 10, max: 10, package_price: 8000, per_hour: 800 },
]

export interface PricingResult {
  sessions: number
  package_price: number
  per_session: number
  tier_label: string
  sibling_discount: boolean
  total_children: number
}

/**
 * Calculate kids group pricing with sibling rule
 * กฎพี่น้อง: รวมจำนวนครั้งของลูกทุกคนภายใต้ parent เดียวกัน แล้วใช้เรทรวม
 */
export function calculateKidsGroupPrice(
  sessionsPerChild: { childId: string; sessions: number }[]
): PricingResult {
  const totalSessions = sessionsPerChild.reduce((sum, c) => sum + c.sessions, 0)
  const tier = KIDS_GROUP_TIERS.find(
    (t) => totalSessions >= t.min && (t.max === null || totalSessions <= t.max)
  )

  if (!tier) {
    // Fallback to highest tier
    const highest = KIDS_GROUP_TIERS[KIDS_GROUP_TIERS.length - 1]
    return {
      sessions: totalSessions,
      package_price: highest.package_price,
      per_session: highest.per_session,
      tier_label: `${highest.min}+ ครั้ง/เดือน`,
      sibling_discount: sessionsPerChild.length > 1,
      total_children: sessionsPerChild.length,
    }
  }

  return {
    sessions: totalSessions,
    package_price: tier.package_price,
    per_session: tier.per_session,
    tier_label: tier.max === null
      ? `${tier.min}+ ครั้ง/เดือน`
      : tier.min === tier.max
        ? `${tier.min} ครั้ง`
        : `${tier.min}-${tier.max} ครั้ง/เดือน`,
    sibling_discount: sessionsPerChild.length > 1,
    total_children: sessionsPerChild.length,
  }
}

/**
 * Calculate adult group pricing
 */
export function calculateAdultGroupPrice(sessions: number) {
  const tier = ADULT_GROUP_TIERS.find((t) => sessions >= t.min && sessions <= t.max)
    || ADULT_GROUP_TIERS[0]

  return {
    sessions,
    package_price: tier.package_price,
    per_session: tier.per_session,
    expiry_months: tier.expiry_months,
    tier_label: sessions === 1 ? 'รายครั้ง' : `${sessions} ครั้ง`,
  }
}

/**
 * Calculate private pricing
 */
export function calculatePrivatePrice(hours: number) {
  const tier = PRIVATE_TIERS.find((t) => hours >= t.min && hours <= t.max)
    || PRIVATE_TIERS[0]

  return {
    hours,
    package_price: tier.package_price,
    per_hour: tier.per_hour,
    tier_label: hours === 1 ? 'รายชั่วโมง' : `${hours} ชั่วโมง`,
  }
}

/**
 * Get all pricing tiers for display
 */
export function getKidsGroupTiers() {
  return KIDS_GROUP_TIERS.map((t) => ({
    ...t,
    label: t.max === null
      ? `${t.min}+ ครั้ง/เดือน`
      : t.min === t.max
        ? `${t.min} ครั้ง`
        : `${t.min}-${t.max} ครั้ง/เดือน`,
  }))
}

export function getAdultGroupTiers() {
  return ADULT_GROUP_TIERS.map((t) => ({
    ...t,
    label: t.min === 1 ? 'รายครั้ง' : `${t.min} ครั้ง`,
  }))
}

export function getPrivateTiers() {
  return PRIVATE_TIERS.map((t) => ({
    ...t,
    label: t.min === 1 ? 'รายชั่วโมง' : `${t.min} ชั่วโมง`,
  }))
}
