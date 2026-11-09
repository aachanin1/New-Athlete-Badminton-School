/** Immutable terms captured by the server; purchased quantity lives on the bill. */
export interface BookingPurchaseTerms {
  quantity: number
  validity_months: number
  purchaseMode?: 'per_session' | 'package'
  policyVersion?: number
  lessonMonth?: string
  unitRate?: number
  tierEvidence?: {
    id: string
    min_sessions: number
    max_sessions: number | null
    price_per_session: number | string
    package_price: number | string
    valid_from: string | null
    valid_to: string | null
  }
}

export function isPerSessionPurchase(terms: BookingPurchaseTerms | null | undefined): boolean {
  return Boolean(terms && (terms.purchaseMode === 'per_session' || (!terms.purchaseMode && terms.quantity <= 1)))
}

export function isBillSinglePurchase(terms: BookingPurchaseTerms | null | undefined): boolean {
  return terms?.policyVersion === 2 && terms.purchaseMode === 'per_session'
}

export function recommendBookingPackage<T extends { quantity: number; course: string }>(catalog: T[], course: string, selectedQuantity: number): T | null {
  if (!Number.isSafeInteger(selectedQuantity) || selectedQuantity < 1) return null
  return catalog.filter(p => p.course === course && p.quantity > 1 && p.quantity >= selectedQuantity && p.quantity - selectedQuantity <= 2)
    .sort((a, b) => a.quantity - b.quantity)[0] || null
}
