// No server clients here: shared by form validation and server API.
export const KIDS_MAKEUP_MINIMUM_KEY = 'kids_makeup_destination_minimum_sessions'
export const KIDS_MAKEUP_BOOTSTRAP_MINIMUM = 2

export interface KidsMakeupSettings {
  id: string
  minimum: number
  revision: number
  updatedAt: string | null
}

export function parseKidsMakeupMinimum(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 1 ? number : null
}
