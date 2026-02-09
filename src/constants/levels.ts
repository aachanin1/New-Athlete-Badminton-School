import type { LevelCategory } from '@/types/database'

export interface LevelRange {
  category: LevelCategory
  label: string
  emoji: string
  minLevel: number
  maxLevel: number
  description: string
}

export const LEVEL_RANGES: LevelRange[] = [
  {
    category: 'basic',
    label: 'ชุดพื้นฐาน',
    emoji: '👶',
    minLevel: 1,
    maxLevel: 30,
    description: 'ฝึกวิธีการรับลูกจากคู่แข่ง',
  },
  {
    category: 'athlete_1',
    label: 'ชุดนักกีฬา',
    emoji: '🔨',
    minLevel: 31,
    maxLevel: 39,
    description: 'ฝึกวิธีการตีลูกทำแต้ม',
  },
  {
    category: 'athlete_2',
    label: 'ชุดนักกีฬา',
    emoji: '🧠',
    minLevel: 40,
    maxLevel: 43,
    description: 'ฝึกวิสัยทัศน์การเล่นเกมแบดมินตัน + แข่งได้ในระดับสโมสร',
  },
  {
    category: 'athlete_3',
    label: 'ชุดนักกีฬา',
    emoji: '💪',
    minLevel: 44,
    maxLevel: 60,
    description: 'ฝึกเทคนิคขั้นสูง ของนักกีฬาระดับทีมชาติ',
  },
]

export const MAX_LEVEL = 60
