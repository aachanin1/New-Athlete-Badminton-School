import type { LevelCategory } from '@/types/database'

export interface LevelRange {
  category: LevelCategory
  label: string
  emoji: string
  minLevel: number
  maxLevel: number
  description: string
  color: string
}

export const EXTENDED_LEVEL_MAX = Number.MAX_SAFE_INTEGER

export const LEVEL_RANGES: LevelRange[] = [
  {
    category: 'basic',
    label: 'พื้นฐาน',
    emoji: 'LV',
    minLevel: 1,
    maxLevel: 34,
    description: 'พื้นฐานการรับ ตี และเคลื่อนตัวเพื่อเอาไปตีเกมได้',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    category: 'athlete_1',
    label: 'เตรียมนักกีฬา C',
    emoji: 'C',
    minLevel: 35,
    maxLevel: 58,
    description: 'วินิจฉัย แก้ท่า วางรูปเกม และเตรียมทักษะสำหรับการแข่งขัน',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    category: 'athlete_2',
    label: 'นักกีฬา B',
    emoji: 'B',
    minLevel: 59,
    maxLevel: 70,
    description: 'เทคนิคและแทคติกขั้นสูงเพื่อลดแต้มเสียและทำแต้มได้มากขึ้น',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    category: 'athlete_3',
    label: 'นักกีฬา A',
    emoji: 'A',
    minLevel: 71,
    maxLevel: EXTENDED_LEVEL_MAX,
    description: 'ระดับต่อยอดหลัง LV 70 สำหรับเจ้าของระบบเพิ่ม Level ได้เองในอนาคต',
    color: 'bg-rose-100 text-rose-700',
  },
]

export const DEFAULT_EXTENDED_LEVEL_CATEGORY: LevelCategory = 'athlete_3'
export const MIN_LEVEL = 0
export const UNASSESSED_LEVEL = 0
export const UNASSESSED_LEVEL_LABEL = 'ยังไม่ประเมิน'

export function formatLevelRange(range: LevelRange) {
  return range.maxLevel === EXTENDED_LEVEL_MAX
    ? `${range.minLevel}+`
    : `${range.minLevel}-${range.maxLevel}`
}

export function getLevelRange(level: number) {
  return LEVEL_RANGES.find((range) => level >= range.minLevel && level <= range.maxLevel) || LEVEL_RANGES[LEVEL_RANGES.length - 1]
}

export function getLevelRangeByCategory(category: LevelCategory) {
  return LEVEL_RANGES.find((range) => range.category === category) || LEVEL_RANGES[0]
}

export function getLevelDisplay(level: number | null | undefined) {
  const normalizedLevel = level ?? UNASSESSED_LEVEL

  if (normalizedLevel <= UNASSESSED_LEVEL) {
    return {
      level: UNASSESSED_LEVEL,
      label: UNASSESSED_LEVEL_LABEL,
      color: 'bg-gray-100 text-gray-600',
      range: null,
    }
  }

  const range = getLevelRange(normalizedLevel)
  return {
    level: normalizedLevel,
    label: range.label,
    color: range.color,
    range,
  }
}
