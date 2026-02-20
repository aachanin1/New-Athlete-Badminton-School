// รอบเรียนของแต่ละสาขา ตาม CMS
// dayOfWeek: 0=อา, 1=จ, 2=อ, 3=พ, 4=พฤ, 5=ศ, 6=ส

export interface TimeSlot {
  start: string // "17:00"
  end: string   // "19:00"
}

export interface BranchSchedule {
  branchSlug: string
  courseType: 'kids_group' | 'adult_group' | 'private'
  dayOfWeek: number // 0-6
  slots: TimeSlot[]
}

// Day-of-week mapping (Thai)
export const DAY_LABELS: Record<number, string> = {
  0: 'อา.',
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
  6: 'ส.',
}

export const DAY_LABELS_FULL: Record<number, string> = {
  0: 'อาทิตย์',
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
}

// ─── แจ้งวัฒนะ ───────────────────────────────────────
const chaengwattana_kids: BranchSchedule[] = [
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 1, slots: [{ start: '17:00', end: '19:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 3, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '09:00', end: '11:00' }, { start: '13:00', end: '15:00' }, { start: '16:00', end: '18:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '09:00', end: '11:00' }, { start: '13:00', end: '15:00' }, { start: '16:00', end: '18:00' }] },
]

const chaengwattana_adult: BranchSchedule[] = [
  { branchSlug: 'chaengwattana', courseType: 'adult_group', dayOfWeek: 3, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'adult_group', dayOfWeek: 4, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'adult_group', dayOfWeek: 5, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '11:00', end: '13:00' }, { start: '18:00', end: '20:00' }] },
  { branchSlug: 'chaengwattana', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '20:00' }] },
]

const chaengwattana_private: BranchSchedule[] = [
  { branchSlug: 'chaengwattana', courseType: 'private', dayOfWeek: 1, slots: [{ start: '09:00', end: '17:00' }, { start: '21:00', end: '23:00' }] },
]

// ─── พระราม 2 ─────────────────────────────────────────
const rama2_kids: BranchSchedule[] = [
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 1, slots: [{ start: '10:00', end: '12:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 3, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '09:00', end: '11:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'rama2', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '09:00', end: '11:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
]

const rama2_adult: BranchSchedule[] = [
  { branchSlug: 'rama2', courseType: 'adult_group', dayOfWeek: 1, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'rama2', courseType: 'adult_group', dayOfWeek: 3, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'rama2', courseType: 'adult_group', dayOfWeek: 5, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'rama2', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
  { branchSlug: 'rama2', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '13:00', end: '15:00' }, { start: '19:00', end: '21:00' }] },
]

// ─── รามอินทรา ────────────────────────────────────────
const ramintra_kids: BranchSchedule[] = [
  { branchSlug: 'ram-intra', courseType: 'kids_group', dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ram-intra', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ram-intra', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ram-intra', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '10:00', end: '12:00' }, { start: '13:00', end: '15:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ram-intra', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '10:00', end: '12:00' }, { start: '13:00', end: '15:00' }, { start: '17:00', end: '19:00' }] },
]

const ramintra_adult: BranchSchedule[] = [
  { branchSlug: 'ram-intra', courseType: 'adult_group', dayOfWeek: 2, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'ram-intra', courseType: 'adult_group', dayOfWeek: 4, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'ram-intra', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '15:00', end: '17:00' }] },
  { branchSlug: 'ram-intra', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '15:00', end: '17:00' }] },
]

// ─── สุวรรณภูมิ ───────────────────────────────────────
const suvarnabhumi_kids: BranchSchedule[] = [
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 1, slots: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 3, slots: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '10:00', end: '12:00' }, { start: '14:00', end: '16:00' }, { start: '16:00', end: '18:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }, { start: '16:00', end: '18:00' }] },
]

const suvarnabhumi_adult: BranchSchedule[] = [
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 1, slots: [{ start: '19:00', end: '21:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 3, slots: [{ start: '19:00', end: '21:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 4, slots: [{ start: '19:00', end: '21:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 5, slots: [{ start: '19:00', end: '21:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '11:00', end: '13:00' }] },
  { branchSlug: 'suvarnabhumi', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '11:00', end: '13:00' }] },
]

// ─── เทพารักษ์ ────────────────────────────────────────
const theparak_kids: BranchSchedule[] = [
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 1, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 2, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 3, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '09:00', end: '11:00' }, { start: '13:00', end: '15:00' }, { start: '16:00', end: '18:00' }] },
  { branchSlug: 'theparak', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '09:00', end: '11:00' }, { start: '13:00', end: '15:00' }, { start: '16:00', end: '18:00' }] },
]

const theparak_adult: BranchSchedule[] = [
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 1, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 2, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 4, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 5, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '11:00', end: '13:00' }, { start: '18:00', end: '20:00' }] },
  { branchSlug: 'theparak', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '11:00', end: '13:00' }, { start: '18:00', end: '20:00' }] },
]

// ─── รัชดา ────────────────────────────────────────────
const ratchada_kids: BranchSchedule[] = [
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 2, slots: [{ start: '16:30', end: '18:00' }] },
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 3, slots: [{ start: '16:30', end: '18:00' }] },
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '16:30', end: '18:00' }] },
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '16:30', end: '18:00' }] },
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '10:00', end: '12:00' }] },
  { branchSlug: 'ratchada', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '10:00', end: '12:00' }, { start: '14:00', end: '16:00' }, { start: '16:00', end: '18:00' }] },
]

// ─── ราชพฤกษ์-ตลิ่งชัน ───────────────────────────────
const ratchaphruek_kids: BranchSchedule[] = [
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'kids_group', dayOfWeek: 4, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'kids_group', dayOfWeek: 5, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }, { start: '17:00', end: '19:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'kids_group', dayOfWeek: 6, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'kids_group', dayOfWeek: 0, slots: [{ start: '10:00', end: '12:00' }, { start: '15:00', end: '17:00' }] },
]

const ratchaphruek_adult: BranchSchedule[] = [
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'adult_group', dayOfWeek: 4, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'adult_group', dayOfWeek: 5, slots: [{ start: '13:00', end: '15:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'adult_group', dayOfWeek: 6, slots: [{ start: '12:00', end: '14:00' }, { start: '20:00', end: '22:00' }] },
  { branchSlug: 'ratchaphruek-talingchan', courseType: 'adult_group', dayOfWeek: 0, slots: [{ start: '12:00', end: '14:00' }, { start: '20:00', end: '22:00' }] },
]

// ─── ALL SCHEDULES ────────────────────────────────────
export const ALL_BRANCH_SCHEDULES: BranchSchedule[] = [
  ...chaengwattana_kids, ...chaengwattana_adult, ...chaengwattana_private,
  ...rama2_kids, ...rama2_adult,
  ...ramintra_kids, ...ramintra_adult,
  ...suvarnabhumi_kids, ...suvarnabhumi_adult,
  ...theparak_kids, ...theparak_adult,
  ...ratchada_kids,
  ...ratchaphruek_kids, ...ratchaphruek_adult,
]

/**
 * Break a time range into 1-hour slots (for private courses)
 */
function expandToHourlySlots(slots: TimeSlot[]): TimeSlot[] {
  const result: TimeSlot[] = []
  for (const slot of slots) {
    const [startH, startM] = slot.start.split(':').map(Number)
    const [endH, endM] = slot.end.split(':').map(Number)
    const startMin = startH * 60 + startM
    const endMin = endH * 60 + endM
    for (let m = startMin; m + 60 <= endMin; m += 60) {
      const h1 = Math.floor(m / 60)
      const m1 = m % 60
      const h2 = Math.floor((m + 60) / 60)
      const m2 = (m + 60) % 60
      result.push({
        start: `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`,
        end: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`,
      })
    }
  }
  return result
}

/**
 * Get available time slots for a specific branch, course type, and day of week
 * For private courses, big time ranges are broken into 1-hour slots automatically.
 */
export function getAvailableSlots(
  branchSlug: string,
  courseType: 'kids_group' | 'adult_group' | 'private',
  dayOfWeek: number
): TimeSlot[] {
  const schedule = ALL_BRANCH_SCHEDULES.find(
    (s) => s.branchSlug === branchSlug && s.courseType === courseType && s.dayOfWeek === dayOfWeek
  )
  if (!schedule) return []
  // Private courses: expand ranges to 1-hour slots
  if (courseType === 'private') {
    return expandToHourlySlots(schedule.slots)
  }
  return schedule.slots
}

/**
 * Check if a specific date has available slots for a branch+courseType
 */
export function hasAvailableSlots(
  branchSlug: string,
  courseType: 'kids_group' | 'adult_group' | 'private',
  date: Date
): boolean {
  const dayOfWeek = date.getDay()
  return getAvailableSlots(branchSlug, courseType, dayOfWeek).length > 0
}

/**
 * Get all days of week that have slots for a branch+courseType
 */
export function getAvailableDays(
  branchSlug: string,
  courseType: 'kids_group' | 'adult_group' | 'private'
): number[] {
  return ALL_BRANCH_SCHEDULES
    .filter((s) => s.branchSlug === branchSlug && s.courseType === courseType)
    .map((s) => s.dayOfWeek)
}
