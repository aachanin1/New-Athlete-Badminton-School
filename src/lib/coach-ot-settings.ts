import { COACH_OVERTIME } from '@/constants/pricing'

export const COACH_OT_SETTING_KEY = 'coach_overtime_settings'

export interface CoachOtSettings {
  weeklyThreshold: number
  privateRate: number
  groupRate: number
}

export const DEFAULT_COACH_OT_SETTINGS: CoachOtSettings = {
  weeklyThreshold: COACH_OVERTIME.weeklyThreshold,
  privateRate: COACH_OVERTIME.privateRate,
  groupRate: COACH_OVERTIME.groupRate,
}

function toNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function normalizeCoachOtSettings(value: unknown): CoachOtSettings {
  if (!value || typeof value !== 'object') return DEFAULT_COACH_OT_SETTINGS

  const settings = value as Partial<Record<keyof CoachOtSettings, unknown>>
  return {
    weeklyThreshold: toPositiveNumber(settings.weeklyThreshold, DEFAULT_COACH_OT_SETTINGS.weeklyThreshold),
    privateRate: toNonNegativeNumber(settings.privateRate, DEFAULT_COACH_OT_SETTINGS.privateRate),
    groupRate: toNonNegativeNumber(settings.groupRate, DEFAULT_COACH_OT_SETTINGS.groupRate),
  }
}
