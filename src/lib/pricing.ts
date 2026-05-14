// Pricing engine for New Athlete Badminton School.
// DB pricing_tiers are the source of truth; defaults keep old flows safe when rows are missing.

export type CourseCategory = 'kids_group' | 'adult_group' | 'private'

export interface PricingTierConfig {
  id?: string
  course_type_id?: string
  course_type_name: CourseCategory
  min_sessions: number
  max_sessions: number | null
  price_per_session: number
  package_price: number
  valid_from?: string | null
  valid_to?: string | null
  created_at?: string | null
}

export interface PricingTierInput {
  id?: string
  course_type_id?: string
  course_type_name?: CourseCategory | string | null
  min_sessions: number
  max_sessions: number | null
  price_per_session: number | string
  package_price: number | string
  valid_from?: string | null
  valid_to?: string | null
  created_at?: string | null
  course_types?: { name?: CourseCategory | string | null } | null
}

export type PricingCatalog = Record<CourseCategory, PricingTierConfig[]>

export interface PricingResult {
  sessions: number
  package_price: number
  per_session: number
  tier_label: string
  sibling_discount: boolean
  total_children: number
}

export interface TotalPriceResult {
  total: number
  perSession: number
  tierLabel: string
}

const COURSE_ORDER: CourseCategory[] = ['kids_group', 'adult_group', 'private']

export const DEFAULT_PRICING_TIERS: PricingCatalog = {
  kids_group: [
    { course_type_name: 'kids_group', min_sessions: 1, max_sessions: 1, price_per_session: 700, package_price: 700 },
    { course_type_name: 'kids_group', min_sessions: 2, max_sessions: 6, price_per_session: 625, package_price: 2500 },
    { course_type_name: 'kids_group', min_sessions: 7, max_sessions: 10, price_per_session: 500, package_price: 4000 },
    { course_type_name: 'kids_group', min_sessions: 11, max_sessions: 14, price_per_session: 433, package_price: 5200 },
    { course_type_name: 'kids_group', min_sessions: 15, max_sessions: 18, price_per_session: 406, package_price: 6500 },
    { course_type_name: 'kids_group', min_sessions: 19, max_sessions: null, price_per_session: 350, package_price: 7000 },
  ],
  adult_group: [
    { course_type_name: 'adult_group', min_sessions: 1, max_sessions: 1, price_per_session: 600, package_price: 600 },
    { course_type_name: 'adult_group', min_sessions: 10, max_sessions: 10, price_per_session: 550, package_price: 5500 },
    { course_type_name: 'adult_group', min_sessions: 16, max_sessions: 16, price_per_session: 500, package_price: 8000 },
  ],
  private: [
    { course_type_name: 'private', min_sessions: 1, max_sessions: 1, price_per_session: 900, package_price: 900 },
    { course_type_name: 'private', min_sessions: 10, max_sessions: 10, price_per_session: 800, package_price: 8000 },
  ],
}

function emptyCatalog(): PricingCatalog {
  return { kids_group: [], adult_group: [], private: [] }
}

function isCourseCategory(value: unknown): value is CourseCategory {
  return COURSE_ORDER.includes(value as CourseCategory)
}

function toNumber(value: number | string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTier(row: PricingTierInput): PricingTierConfig | null {
  const courseName = row.course_type_name || row.course_types?.name
  if (!isCourseCategory(courseName)) return null

  return {
    id: row.id,
    course_type_id: row.course_type_id,
    course_type_name: courseName,
    min_sessions: Number(row.min_sessions),
    max_sessions: row.max_sessions === null ? null : Number(row.max_sessions),
    price_per_session: toNumber(row.price_per_session),
    package_price: toNumber(row.package_price),
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    created_at: row.created_at,
  }
}

function isCurrentlyValid(tier: PricingTierConfig) {
  const today = new Date().toISOString().slice(0, 10)
  if (tier.valid_from && tier.valid_from > today) return false
  if (tier.valid_to && tier.valid_to < today) return false
  return true
}

export function buildPricingCatalog(rows?: PricingTierInput[] | PricingCatalog | null): PricingCatalog {
  if (!rows) return DEFAULT_PRICING_TIERS
  if (!Array.isArray(rows)) return rows

  const catalog = emptyCatalog()
  for (const row of rows) {
    const tier = normalizeTier(row)
    if (tier && isCurrentlyValid(tier)) {
      catalog[tier.course_type_name].push(tier)
    }
  }

  for (const course of COURSE_ORDER) {
    if (catalog[course].length === 0) {
      catalog[course] = DEFAULT_PRICING_TIERS[course]
    } else {
      catalog[course].sort((a, b) => a.min_sessions - b.min_sessions)
    }
  }

  return catalog
}

function getCourseTiers(courseType: CourseCategory, pricing?: PricingTierInput[] | PricingCatalog | null) {
  return buildPricingCatalog(pricing)[courseType]
}

function formatTierLabel(tier: PricingTierConfig, unit = 'ครั้ง') {
  if (tier.max_sessions === null) return `${tier.min_sessions}+ ${unit}`
  if (tier.min_sessions === tier.max_sessions) return `${tier.min_sessions} ${unit}`
  return `${tier.min_sessions}-${tier.max_sessions} ${unit}`
}

function findRangeTier(tiers: PricingTierConfig[], sessions: number) {
  return tiers.find((tier) => sessions >= tier.min_sessions && (tier.max_sessions === null || sessions <= tier.max_sessions))
    || tiers[tiers.length - 1]
}

function findPackageTier(tiers: PricingTierConfig[], sessions: number) {
  const eligible = tiers.filter((tier) => sessions >= tier.min_sessions)
  return eligible[eligible.length - 1] || tiers[0]
}

export function calculateKidsGroupPrice(
  sessionsPerChild: { childId: string; sessions: number }[],
  pricing?: PricingTierInput[] | PricingCatalog | null
): PricingResult {
  const totalSessions = sessionsPerChild.reduce((sum, child) => sum + child.sessions, 0)
  const tier = findRangeTier(getCourseTiers('kids_group', pricing), totalSessions)

  return {
    sessions: totalSessions,
    package_price: tier.package_price,
    per_session: tier.price_per_session,
    tier_label: formatTierLabel(tier),
    sibling_discount: sessionsPerChild.length > 1,
    total_children: sessionsPerChild.length,
  }
}

export function calculateAdultGroupPrice(sessions: number, pricing?: PricingTierInput[] | PricingCatalog | null) {
  const tier = findPackageTier(getCourseTiers('adult_group', pricing), sessions)
  return {
    sessions,
    package_price: tier.package_price,
    per_session: tier.price_per_session,
    expiry_months: tier.min_sessions > 1 ? 10 : null,
    tier_label: tier.min_sessions === 1 ? 'รายครั้ง' : formatTierLabel(tier),
  }
}

export function calculatePrivatePrice(hours: number, pricing?: PricingTierInput[] | PricingCatalog | null) {
  const tier = findPackageTier(getCourseTiers('private', pricing), hours)
  return {
    hours,
    package_price: tier.package_price,
    per_hour: tier.price_per_session,
    tier_label: tier.min_sessions === 1 ? 'รายชั่วโมง' : formatTierLabel(tier, 'ชั่วโมง'),
  }
}

export const SESSION_STATUS_LABELS: { min: number; label: string; emoji: string }[] = [
  { min: 24, label: 'นักกีฬาระดับประเทศ', emoji: '🏆' },
  { min: 19, label: 'นักกีฬา', emoji: '🥇' },
  { min: 16, label: 'นักกีฬา', emoji: '💪' },
  { min: 12, label: 'เริ่มต้นเป็นนักกีฬา', emoji: '🏸' },
  { min: 8, label: 'ออกกำลังกาย', emoji: '🏃' },
  { min: 4, label: 'เรียนขั้นต่ำ', emoji: '📚' },
]

export function getSessionStatusLabel(sessions: number): { label: string; emoji: string; warning?: string } {
  if (sessions < 4) {
    return {
      label: 'ต่ำกว่าขั้นต่ำ',
      emoji: '⚠️',
      warning: 'ควรหาวันเรียนเพิ่ม เพื่อความต่อเนื่องของทักษะแบดมินตัน',
    }
  }
  const status = SESSION_STATUS_LABELS.find((item) => sessions >= item.min)
  return status || { label: 'เรียนขั้นต่ำ', emoji: '📚' }
}

export function getKidsGroupTotal(
  totalSessions: number,
  pricing?: PricingTierInput[] | PricingCatalog | null
): TotalPriceResult {
  const tier = findRangeTier(getCourseTiers('kids_group', pricing), totalSessions)
  return {
    total: Math.round(tier.price_per_session * totalSessions),
    perSession: tier.price_per_session,
    tierLabel: formatTierLabel(tier),
  }
}

export function getKidsGroupIncremental(
  existingSessionsThisMonth: number,
  existingPaidThisMonth: number,
  newSessions: number,
  pricing?: PricingTierInput[] | PricingCatalog | null
) {
  const totalSessionsForMonth = existingSessionsThisMonth + newSessions
  const { perSession, tierLabel } = getKidsGroupTotal(totalSessionsForMonth, pricing)
  const totalCostForMonth = Math.round(perSession * totalSessionsForMonth)
  const incrementalPrice = Math.max(0, totalCostForMonth - existingPaidThisMonth)
  const effectivePerSession = newSessions > 0 ? Math.round(incrementalPrice / newSessions) : 0

  return {
    incrementalPrice,
    perSession,
    tierLabel,
    totalSessionsForMonth,
    totalCostForMonth,
    effectivePerSession,
  }
}

export function getAdultGroupTotal(
  totalSessions: number,
  pricing?: PricingTierInput[] | PricingCatalog | null
): TotalPriceResult {
  const tier = findPackageTier(getCourseTiers('adult_group', pricing), totalSessions)
  if (tier.min_sessions === 1) {
    return {
      total: Math.round(totalSessions * tier.price_per_session),
      perSession: tier.price_per_session,
      tierLabel: 'รายครั้ง',
    }
  }

  return {
    total: tier.package_price,
    perSession: tier.price_per_session,
    tierLabel: formatTierLabel(tier),
  }
}

export function getPrivateTotal(
  totalHours: number,
  pricing?: PricingTierInput[] | PricingCatalog | null
): TotalPriceResult {
  const tier = findPackageTier(getCourseTiers('private', pricing), totalHours)
  if (tier.min_sessions === 1) {
    return {
      total: Math.round(totalHours * tier.price_per_session),
      perSession: tier.price_per_session,
      tierLabel: 'รายชั่วโมง',
    }
  }

  return {
    total: tier.package_price,
    perSession: tier.price_per_session,
    tierLabel: formatTierLabel(tier, 'ชั่วโมง'),
  }
}

export function getKidsGroupTiers(pricing?: PricingTierInput[] | PricingCatalog | null) {
  return getCourseTiers('kids_group', pricing).map((tier) => ({
    ...tier,
    min: tier.min_sessions,
    max: tier.max_sessions,
    per_session: tier.price_per_session,
    label: `${formatTierLabel(tier)}/เดือน`,
  }))
}

export function getAdultGroupTiers(pricing?: PricingTierInput[] | PricingCatalog | null) {
  return getCourseTiers('adult_group', pricing).map((tier) => ({
    ...tier,
    min: tier.min_sessions,
    max: tier.max_sessions,
    per_session: tier.price_per_session,
    expiry_months: tier.min_sessions > 1 ? 10 : null,
    label: tier.min_sessions === 1 ? 'รายครั้ง' : formatTierLabel(tier),
  }))
}

export function getPrivateTiers(pricing?: PricingTierInput[] | PricingCatalog | null) {
  return getCourseTiers('private', pricing).map((tier) => ({
    ...tier,
    min: tier.min_sessions,
    max: tier.max_sessions,
    per_hour: tier.price_per_session,
    label: tier.min_sessions === 1 ? 'รายชั่วโมง' : formatTierLabel(tier, 'ชั่วโมง'),
  }))
}
